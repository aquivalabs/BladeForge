package main

import (
	"strings"
	"testing"
)

const now = int64(1_800_000_000)

func ids(fs []Finding) string {
	var s []string
	for _, f := range fs {
		s = append(s, f.ID)
	}
	return strings.Join(s, ",")
}

func TestOrphanNeedsKnownToolOwnUidReparentedAndOld(t *testing.T) {
	m := Machine{Procs: []Proc{
		{Pid: 10, Ppid: 1, Own: true, Tool: "vitest", Start: now - 30*3600},   // flagged
		{Pid: 11, Ppid: 1, Own: true, Tool: "vitest", Start: now - 3600},      // too young
		{Pid: 12, Ppid: 1, Own: true, Tool: "", Start: now - 90*3600},         // unknown tool
		{Pid: 13, Ppid: 1, Own: false, Tool: "vitest", Start: now - 90*3600},  // another user
		{Pid: 14, Ppid: 500, Own: true, Tool: "vitest", Start: now - 90*3600}, // parent alive
	}}
	got := orphans(m, Context{Now: now})
	if len(got) != 1 || !strings.Contains(got[0].Fact, "pid 10") || got[0].Suggest != "kill 10" {
		t.Fatalf("got %+v", got)
	}
}

func TestAnAppIsNeverAnOrphan(t *testing.T) {
	m := Machine{Procs: []Proc{{Pid: 20, Ppid: 1, Own: true, App: "vm", Start: now - 2000*3600}}}
	if got := orphans(m, Context{Now: now}); len(got) != 0 {
		t.Fatalf("a VM named for the memory report must not be offered for kill: %+v", got)
	}
}

func TestOrphanListIsCapped(t *testing.T) {
	var m Machine
	for i := int32(0); i < 8; i++ {
		m.Procs = append(m.Procs, Proc{Pid: 100 + i, Ppid: 1, Own: true, Tool: "tsc", Start: now - 48*3600})
	}
	got := orphans(m, Context{Now: now})
	if len(got) != maxOrphansShown+1 || got[len(got)-1].Suggest != "" {
		t.Fatalf("want %d listed and one summary, got %+v", maxOrphansShown, got)
	}
}

func TestPressureMustBeSustainedAndNotRightAfterWake(t *testing.T) {
	m := Machine{Snapshot: Snapshot{Pressure: 2, Wake: now - 3600}}
	if got := memory(m, []Snapshot{{T: now - 60, Pressure: 2}}, Context{Now: now}); len(got) != 0 {
		t.Fatalf("one minute apart is not sustained: %+v", got)
	}
	if got := memory(m, []Snapshot{{T: now - 600, Pressure: 2}}, Context{Now: now}); ids(got) != "memory" {
		t.Fatalf("ten minutes apart is sustained: %+v", got)
	}
	m.Wake = now - 60
	if got := memory(m, []Snapshot{{T: now - 600, Pressure: 2}}, Context{Now: now}); len(got) != 0 {
		t.Fatalf("right after wake: %+v", got)
	}
}

func TestSwapGrowthNotSwapLevel(t *testing.T) {
	m := Machine{Snapshot: Snapshot{SwapUsed: 17 * gib, SwapTotal: 18 * gib}}
	if got := memory(m, []Snapshot{{T: now - 1800, SwapUsed: 17 * gib}}, Context{Now: now}); len(got) != 0 {
		t.Fatalf("full but flat swap is not a finding: %+v", got)
	}
	if got := memory(m, []Snapshot{{T: now - 1800, SwapUsed: 15 * gib}}, Context{Now: now}); ids(got) != "swap" {
		t.Fatalf("2 GB growth is a finding: %+v", got)
	}
}

func TestDiskNeedsBothShareAndBytes(t *testing.T) {
	if got := disk(Machine{DiskFree: 40 * gib, DiskTotal: 4000 * gib}); len(got) != 0 {
		t.Fatalf("1%% free but 40 GB is fine: %+v", got)
	}
	if got := disk(Machine{DiskFree: 20 * gib, DiskTotal: 460 * gib}); len(got) != 1 || !strings.Contains(got[0].Fact, "low") {
		t.Fatalf("20 GB of 460 is low: %+v", got)
	}
	if got := disk(Machine{DiskFree: 5 * gib, DiskTotal: 460 * gib}); len(got) != 1 || !strings.Contains(got[0].Fact, "very low") {
		t.Fatalf("5 GB of 460 is very low: %+v", got)
	}
}

func TestFseventsdNeedsTwoReadingsAndQuietCheckout(t *testing.T) {
	m := Machine{Snapshot: Snapshot{FseventsRSS: 6 * gib, FseventsCPU: 1000}, FseventsPid: 331}
	if got := fseventsd(m, nil, Context{Now: now}); len(got) != 0 {
		t.Fatalf("one reading is not enough: %+v", got)
	}
	ring := []Snapshot{{T: now - 900, FseventsRSS: 5 * gib, FseventsCPU: 400}}
	got := fseventsd(m, ring, Context{Now: now})
	if len(got) != 1 || got[0].Suggest != "sudo kill -TERM 331" || !strings.Contains(got[0].Fact, "running away") {
		t.Fatalf("got %+v", got)
	}
	if got := fseventsd(m, ring, Context{Now: now, RepoIndexMTime: now - 60}); len(got) != 0 {
		t.Fatalf("right after a checkout: %+v", got)
	}
}

func TestUnknownProcessNeverShowsAName(t *testing.T) {
	s := top([]Proc{{Pid: 7, Own: true, Footprint: 3 * gib}})
	if s != "`unknown #7` 3.0 GB" {
		t.Fatalf("got %q", s)
	}
}
