package main

import "testing"

func TestStatusLineLabelsUseColons(t *testing.T) {
	prev := Snapshot{T: now - 60, Busy: 100, Total: 1000}
	cur := Snapshot{T: now, Busy: 500, Total: 2000, Pressure: 2, SwapUsed: 17 * gib, SwapTotal: 18 * gib}
	got := statusLine([]string{"cpu", "mem", "swap"}, prev, cur, now)
	if want := "🖥 cpu: 40% · 🧠 mem: warn · 💾 swap: 17/18G"; got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestStatusLineIsEmptyWhenStale(t *testing.T) {
	if got := statusLine([]string{"cpu"}, Snapshot{}, Snapshot{T: now - 3600}, now); got != "" {
		t.Fatalf("stale data must render empty, got %q", got)
	}
}
