package main

import (
	"bytes"
	"encoding/binary"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
	"golang.org/x/sys/unix"
)

const (
	rusageInfoV4    = 4
	footprintOffset = 72 // rusage_info_v4.ri_phys_footprint
	hostCPULoadInfo = 3
	dataVolume      = "/System/Volumes/Data"
	fseventsdComm   = "fseventsd"
)

var (
	libOnce       sync.Once
	libErr        error
	procPidRusage func(pid int32, flavor int32, buf unsafe.Pointer) int32
	machHostSelf  func() uint32
	hostStats     func(host uint32, flavor int32, info unsafe.Pointer, count *uint32) int32
)

func loadLib() error {
	libOnce.Do(func() {
		lib, err := purego.Dlopen("/usr/lib/libSystem.B.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			libErr = err
			return
		}
		purego.RegisterLibFunc(&procPidRusage, lib, "proc_pid_rusage")
		purego.RegisterLibFunc(&machHostSelf, lib, "mach_host_self")
		purego.RegisterLibFunc(&hostStats, lib, "host_statistics")
	})
	return libErr
}

// readMachine reads the cheap system signals; full adds the process table, disk and fseventsd.
func readMachine(full bool) (Machine, error) {
	var m Machine
	if err := loadLib(); err != nil {
		return m, err
	}
	var ticks [4]uint32 // user, system, idle, nice
	count := uint32(4)
	if hostStats(machHostSelf(), hostCPULoadInfo, unsafe.Pointer(&ticks[0]), &count) == 0 {
		m.Busy = uint64(ticks[0]) + uint64(ticks[1]) + uint64(ticks[3])
		m.Total = m.Busy + uint64(ticks[2])
	}
	if level, err := unix.SysctlUint32("kern.memorystatus_vm_pressure_level"); err == nil {
		m.Pressure = int(level)
	}
	if raw, err := unix.SysctlRaw("vm.swapusage"); err == nil && len(raw) >= 24 {
		m.SwapTotal = binary.LittleEndian.Uint64(raw[0:8])
		m.SwapUsed = binary.LittleEndian.Uint64(raw[16:24])
	}
	if tv, err := unix.SysctlTimeval("kern.waketime"); err == nil {
		m.Wake = tv.Sec
	}
	if !full {
		return m, nil
	}

	procs, err := unix.SysctlKinfoProcSlice("kern.proc.all")
	if err != nil {
		return m, err
	}
	uid := uint32(os.Getuid())
	for _, kp := range procs {
		p := Proc{
			Pid:   kp.Proc.P_pid,
			Ppid:  kp.Eproc.Ppid,
			Start: kp.Proc.P_starttime.Sec,
			Own:   kp.Eproc.Ucred.Uid == uid,
		}
		comm := unix.ByteSliceToString(kp.Proc.P_comm[:])
		if comm == fseventsdComm {
			m.FseventsPid = p.Pid
		}
		if !p.Own {
			continue
		}
		p.Footprint = footprint(p.Pid)
		p.comm = comm
		if p.Ppid == 1 {
			p.Tool = classify(comm, argv(p.Pid))
		}
		m.Procs = append(m.Procs, p)
	}
	classifyLargest(m.Procs, func(p Proc) []string { return argv(p.Pid) })
	if m.FseventsPid != 0 {
		m.FseventsRSS, m.FseventsCPU = psRSSAndTime(m.FseventsPid)
	}
	var st unix.Statfs_t
	if unix.Statfs(dataVolume, &st) == nil || unix.Statfs("/", &st) == nil {
		m.DiskFree = st.Bavail * uint64(st.Bsize)
		m.DiskTotal = st.Blocks * uint64(st.Bsize)
	}
	return m, nil
}

func footprint(pid int32) uint64 {
	buf := make([]byte, 512)
	if procPidRusage(pid, rusageInfoV4, unsafe.Pointer(&buf[0])) != 0 {
		return 0
	}
	return binary.LittleEndian.Uint64(buf[footprintOffset : footprintOffset+8])
}

// argv reads a process's arguments through kern.procargs2. They are used to classify the process
// and are never rendered.
func argv(pid int32) []string {
	raw, err := unix.SysctlRaw("kern.procargs2", int(pid))
	if err != nil || len(raw) < 4 {
		return nil
	}
	argc := int(binary.LittleEndian.Uint32(raw[:4]))
	rest := raw[4:]
	if i := bytes.IndexByte(rest, 0); i >= 0 {
		rest = rest[i:] // skip the exec path
	}
	rest = bytes.TrimLeft(rest, "\x00")
	var args []string
	for len(args) < argc && len(rest) > 0 {
		i := bytes.IndexByte(rest, 0)
		if i < 0 {
			break
		}
		args = append(args, string(rest[:i]))
		rest = rest[i+1:]
	}
	return args
}

// psRSSAndTime reads a root process's RSS and CPU time from /bin/ps, which is setuid root on macOS;
// proc_pid_rusage and PROC_PIDTASKINFO are denied for root processes without root.
func psRSSAndTime(pid int32) (uint64, float64) {
	out, err := exec.Command("/bin/ps", "-o", "rss=,time=", "-p", strconv.Itoa(int(pid))).Output()
	if err != nil {
		return 0, 0
	}
	fields := strings.Fields(string(out))
	if len(fields) < 2 {
		return 0, 0
	}
	kb, _ := strconv.ParseUint(fields[0], 10, 64)
	return kb * 1024, parseCPUTime(fields[1])
}

// parseCPUTime turns ps TIME ("12:34.56" or "1:02:03.45") into seconds.
func parseCPUTime(s string) float64 {
	total := 0.0
	for _, part := range strings.Split(s, ":") {
		v, err := strconv.ParseFloat(part, 64)
		if err != nil {
			return 0
		}
		total = total*60 + v
	}
	return total
}
