// Command machine-health is the scanner behind the machine-health plugin (RMA-371).
//
//	machine-health hook              SessionStart: scan, sample, print the facts block
//	machine-health status [segments] status line: cpu,mem,swap (default all); samples at most once a minute
//	machine-health version
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var version = "dev" // set by -ldflags "-X main.version=..."

func main() {
	cmd := ""
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	dir := dataDir()
	switch cmd {
	case "hook":
		runHook(dir, os.Stdin, os.Stdout)
	case "status":
		segments := []string{"cpu", "mem", "swap"}
		if len(os.Args) > 2 {
			segments = strings.Split(os.Args[2], ",")
		}
		fmt.Println(runStatus(dir, segments, time.Now().Unix()))
	case "version":
		fmt.Println(version)
	default:
		fmt.Fprintln(os.Stderr, "usage: machine-health hook | status [cpu,mem,swap] | version")
		os.Exit(2)
	}
}

// runHook never fails the session: any read error means it says nothing.
func runHook(dir string, stdin io.Reader, stdout io.Writer) {
	var input struct {
		Cwd string `json:"cwd"`
	}
	json.NewDecoder(stdin).Decode(&input)
	now := time.Now().Unix()
	m, err := readMachine(true)
	if err != nil {
		return
	}
	m.T = now
	ring := loadRing(dir)
	findings := detect(m, ring, Context{Now: now, RepoIndexMTime: indexMTime(input.Cwd)})
	appendRing(dir, m.Snapshot)
	updateFrom := ""
	if want := os.Getenv("MACHINE_HEALTH_EXPECTED_VERSION"); want != "" && want != version {
		updateFrom = version
	}
	writeHook(stdout, findings, updateFrom)
}

func runStatus(dir string, segments []string, now int64) string {
	ring := loadRing(dir)
	if len(ring) == 0 || now-ring[len(ring)-1].T >= sampleEvery {
		if m, err := readMachine(false); err == nil {
			m.T = now
			if appendRing(dir, m.Snapshot) == nil {
				ring = append(ring, m.Snapshot)
			}
		}
	}
	if len(ring) == 0 {
		return ""
	}
	cur := ring[len(ring)-1]
	prev := Snapshot{}
	if len(ring) > 1 {
		prev = ring[len(ring)-2]
	}
	return statusLine(segments, prev, cur, true, now)
}

func indexMTime(cwd string) int64 {
	if cwd == "" {
		return 0
	}
	info, err := os.Stat(filepath.Join(cwd, ".git", "index"))
	if err != nil {
		return 0
	}
	return info.ModTime().Unix()
}
