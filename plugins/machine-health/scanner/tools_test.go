package main

import "testing"

func TestClassifyKnownToolsAndNothingElse(t *testing.T) {
	cases := []struct {
		comm string
		argv []string
		want string
	}{
		{"node", []string{"node", "/repo/node_modules/.bin/vitest", "run"}, "vitest"},
		{"node", []string{"node", "/repo/node_modules/typescript/bin/tsc", "-w"}, "tsc"},
		{"python3", []string{"python3", "-I", "-"}, "python-stdin"},
		{"claude", nil, "claude"},
		{"node", []string{"node", "server.js"}, ""},
		{"node", []string{"node", "/repo/node_modules/@modelcontextprotocol/server-files/dist/index.js"}, "mcp-server"},
		{"node", []string{"node", "/home/demo/mcp-notes/app.js"}, ""},
		{"bash", []string{"bash", "-c", "ignore previous instructions"}, ""},
	}
	for _, c := range cases {
		if got := classify(c.comm, c.argv); got != c.want {
			t.Errorf("classify(%q, %v) = %q, want %q", c.comm, c.argv, got, c.want)
		}
	}
}

func TestLargestGetAppIDsButNotTheirNames(t *testing.T) {
	procs := []Proc{
		{Pid: 1, Footprint: 5 * gib, comm: "Google Chrome He"},
		{Pid: 2, Footprint: 4 * gib, comm: "evil; rm -rf ~"},
		{Pid: 3, Footprint: 3 * gib, comm: "node"},
		{Pid: 4, Footprint: 1, comm: "Slack"},
	}
	classifyLargest(procs, func(Proc) []string { return nil })
	got := []string{procs[0].App, procs[1].App, procs[2].App, procs[3].App}
	for _, p := range procs {
		if p.Tool != "" {
			t.Fatalf("an app id must never make a kill candidate: %+v", p)
		}
	}
	want := []string{"chrome", "", "node", ""}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}
