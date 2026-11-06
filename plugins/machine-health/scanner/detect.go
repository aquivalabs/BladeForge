package main

import (
	"fmt"
	"sort"
)

const (
	gib = uint64(1) << 30
	mib = uint64(1) << 20

	orphanGrace     = 24 * 3600 // zclean's default; per-class graces wait for the two-week log
	pressureMinGap  = 5 * 60    // two pressure readings must be this far apart to count as sustained
	afterWake       = 3 * 60    // pressure right after wake is normal and resolves on its own
	windowMax       = 60 * 60   // older snapshots are too stale to pair with the current one
	swapGrowth      = gib       // swap growth across the window that is worth a note
	fseventsMinGap  = 10 * 60
	fseventsWarn    = 500 * mib // claude-code #98769 users' guard
	fseventsRunaway = 2 * gib
	checkoutQuiet   = 15 * 60 // fseventsd legitimately grows right after a checkout
	topConsumers    = 3
	maxOrphansShown = 5
)

// Snapshot is one entry of the history ring: small, so 120 of them stay near 240 KB.
type Snapshot struct {
	T           int64   `json:"t"`
	Busy        uint64  `json:"busy"`
	Total       uint64  `json:"total"`
	Pressure    int     `json:"pressure"`
	SwapUsed    uint64  `json:"swapUsed"`
	SwapTotal   uint64  `json:"swapTotal"`
	Wake        int64   `json:"wake"`
	FseventsRSS uint64  `json:"fseventsRss,omitempty"`
	FseventsCPU float64 `json:"fseventsCpu,omitempty"`
}

// Proc is what the scanner knows about one process. Tool is a tool id from the allowlist, or "".
type Proc struct {
	Pid       int32
	Ppid      int32
	Start     int64
	Own       bool
	Tool      string // an agent or test tool id: the only processes D1 may call orphaned
	App       string // an app id for naming a memory consumer; never makes a process a kill candidate
	Footprint uint64
	comm      string // used to classify, never rendered
}

// Machine is a full read: a snapshot plus the parts that never enter the ring.
type Machine struct {
	Snapshot
	Procs       []Proc
	FseventsPid int32
	DiskFree    uint64
	DiskTotal   uint64
}

// Finding is one "You should know" item. Suggest is a step Claude may offer; "" means information only.
type Finding struct {
	ID      string
	Fact    string
	Suggest string
}

// Context holds the facts about the session the hook runs in.
type Context struct {
	Now            int64
	RepoIndexMTime int64 // 0 when the working directory is not a git checkout
}

func detect(m Machine, ring []Snapshot, ctx Context) []Finding {
	var out []Finding
	out = append(out, orphans(m, ctx)...)
	out = append(out, memory(m, ring, ctx)...)
	out = append(out, disk(m)...)
	out = append(out, fseventsd(m, ring, ctx)...)
	return out
}

// partner returns the newest snapshot that is at least minGap and at most windowMax older than now.
func partner(ring []Snapshot, now int64, minGap int64) (Snapshot, bool) {
	for i := len(ring) - 1; i >= 0; i-- {
		age := now - ring[i].T
		if age >= minGap && age <= windowMax {
			return ring[i], true
		}
	}
	return Snapshot{}, false
}

// oldest returns the oldest snapshot inside the window.
func oldest(ring []Snapshot, now int64) (Snapshot, bool) {
	for _, s := range ring {
		if now-s.T <= windowMax {
			return s, true
		}
	}
	return Snapshot{}, false
}

func label(p Proc) string {
	if p.Tool != "" {
		return fmt.Sprintf("`%s` (pid %d)", p.Tool, p.Pid)
	}
	if p.App != "" {
		return fmt.Sprintf("`%s` (pid %d)", p.App, p.Pid)
	}
	return fmt.Sprintf("`unknown #%d`", p.Pid)
}

func orphans(m Machine, ctx Context) []Finding {
	var found []Proc
	for _, p := range m.Procs {
		if p.Own && p.Tool != "" && p.Ppid == 1 && ctx.Now-p.Start >= orphanGrace {
			found = append(found, p)
		}
	}
	sort.Slice(found, func(i, j int) bool { return found[i].Start < found[j].Start })
	var out []Finding
	for i, p := range found {
		if i == maxOrphansShown {
			out = append(out, Finding{ID: "orphan", Fact: fmt.Sprintf("%d more orphaned tool processes are not listed.", len(found)-maxOrphansShown)})
			break
		}
		hours := (ctx.Now - p.Start) / 3600
		out = append(out, Finding{
			ID:      "orphan",
			Fact:    fmt.Sprintf("%s has run for %d h with no parent session.", label(p), hours),
			Suggest: fmt.Sprintf("kill %d", p.Pid),
		})
	}
	return out
}

func memory(m Machine, ring []Snapshot, ctx Context) []Finding {
	var out []Finding
	if m.Pressure >= 2 && ctx.Now-m.Wake >= afterWake {
		if prev, ok := partner(ring, ctx.Now, pressureMinGap); ok && prev.Pressure >= 2 {
			out = append(out, Finding{
				ID:   "memory",
				Fact: fmt.Sprintf("Memory pressure has stayed high for at least %d min. Largest of your processes: %s.", (ctx.Now-prev.T)/60, top(m.Procs)),
			})
		}
	}
	if first, ok := oldest(ring, ctx.Now); ok && m.SwapUsed > first.SwapUsed && m.SwapUsed-first.SwapUsed >= swapGrowth {
		out = append(out, Finding{
			ID:   "swap",
			Fact: fmt.Sprintf("Swap grew by %.1f GB in %d min, to %.1f of %.1f GB.", gb(m.SwapUsed-first.SwapUsed), (ctx.Now-first.T)/60, gb(m.SwapUsed), gb(m.SwapTotal)),
		})
	}
	return out
}

func top(procs []Proc) string {
	own := make([]Proc, 0, len(procs))
	for _, p := range procs {
		if p.Own && p.Footprint > 0 {
			own = append(own, p)
		}
	}
	sort.Slice(own, func(i, j int) bool { return own[i].Footprint > own[j].Footprint })
	s := ""
	for i, p := range own {
		if i == topConsumers {
			break
		}
		if i > 0 {
			s += ", "
		}
		s += fmt.Sprintf("%s %.1f GB", label(p), gb(p.Footprint))
	}
	if s == "" {
		return "none readable"
	}
	return s
}

func disk(m Machine) []Finding {
	if m.DiskTotal == 0 {
		return nil
	}
	share := float64(m.DiskFree) / float64(m.DiskTotal)
	var level string
	switch {
	case share < 0.08 && m.DiskFree < 10*gib:
		level = "very low"
	case share < 0.15 && m.DiskFree < 25*gib:
		level = "low"
	default:
		return nil
	}
	return []Finding{{
		ID:   "disk",
		Fact: fmt.Sprintf("Free disk space is %s: %.1f GB of %.0f GB (%.0f%%).", level, gb(m.DiskFree), gb(m.DiskTotal), share*100),
	}}
}

func fseventsd(m Machine, ring []Snapshot, ctx Context) []Finding {
	if m.FseventsPid == 0 || m.FseventsRSS < fseventsWarn {
		return nil
	}
	if ctx.RepoIndexMTime != 0 && ctx.Now-ctx.RepoIndexMTime < checkoutQuiet {
		return nil
	}
	prev, ok := partner(ring, ctx.Now, fseventsMinGap)
	if !ok || prev.FseventsRSS < fseventsWarn {
		return nil
	}
	cores := 0.0
	if elapsed := float64(ctx.Now - prev.T); elapsed > 0 && m.FseventsCPU >= prev.FseventsCPU {
		cores = (m.FseventsCPU - prev.FseventsCPU) / elapsed
	}
	state := "is larger than it should be"
	if m.FseventsRSS >= fseventsRunaway || cores >= 0.5 {
		state = "is running away"
	}
	return []Finding{{
		ID: "fseventsd",
		Fact: fmt.Sprintf("`fseventsd` %s: %.1f GB resident (its budget is 30 MB), %.2f cores over the last %d min. A restart frees it; open dev tools may need a restart after.",
			state, gb(m.FseventsRSS), cores, (ctx.Now-prev.T)/60),
		Suggest: fmt.Sprintf("sudo kill -TERM %d", m.FseventsPid),
	}}
}

func gb(b uint64) float64 { return float64(b) / float64(gib) }
