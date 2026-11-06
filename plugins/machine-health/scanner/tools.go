package main

import (
	"path/filepath"
	"sort"
	"strings"
)

// toolMarkers maps a fragment of a process's executable path or arguments to the tool id rendered in
// Claude's context. Only these ids ever reach Claude: a process name or path is never printed, so a
// hostile name cannot inject (plan § Privacy). Order matters: the first match wins.
var toolMarkers = []struct{ marker, tool string }{
	{"/vitest", "vitest"},
	{"/jest", "jest"},
	{"/tsc", "tsc"},
	{"typescript/bin", "tsc"},
	{"next-server", "next-dev"},
	{"/next/dist", "next-dev"},
	{"/vite/bin", "vite"},
	{"/storybook", "storybook"},
	{"/tsx/", "tsx"},
	{"/nodemon", "nodemon"},
	{"/esbuild", "esbuild"},
	{"/playwright", "playwright"},
	{"/stryker", "stryker"},
	{"mcp", "mcp-server"},
}

// appMarkers maps a process name prefix to an app id, for naming the largest memory consumers.
var appMarkers = []struct{ prefix, tool string }{
	{"Google Chrome", "chrome"},
	{"Safari", "safari"},
	{"com.apple.WebKi", "safari"},
	{"firefox", "firefox"},
	{"Code Helper", "vscode"},
	{"Electron", "electron-app"},
	{"idea", "jetbrains-ide"},
	{"webstorm", "jetbrains-ide"},
	{"com.docker", "docker"},
	{"Docker", "docker"},
	{"limactl", "lima-vm"},
	{"com.apple.Virtua", "vm"},
	{"node", "node"},
	{"python", "python"},
	{"java", "java"},
	{"Slack", "slack"},
	{"Claude", "claude-desktop"},
}

// classifyLargest names the topConsumers own processes by footprint, so a memory finding says what
// they are without printing a real process name.
func classifyLargest(procs []Proc, args func(Proc) []string) {
	idx := make([]int, 0, len(procs))
	for i, p := range procs {
		if p.Footprint > 0 {
			idx = append(idx, i)
		}
	}
	sort.Slice(idx, func(a, b int) bool { return procs[idx[a]].Footprint > procs[idx[b]].Footprint })
	for n, i := range idx {
		if n == topConsumers {
			break
		}
		p := &procs[i]
		if p.Tool != "" {
			continue
		}
		if tool := classify(p.comm, args(*p)); tool != "" {
			p.App = tool
			continue
		}
		for _, a := range appMarkers {
			if strings.HasPrefix(p.comm, a.prefix) {
				p.App = a.tool
				break
			}
		}
	}
}

// classify returns the tool id for a process, or "" when it is not a known agent or test tool.
func classify(comm string, argv []string) string {
	switch comm {
	case "claude":
		return "claude"
	case "tsserver":
		return "tsserver"
	}
	if strings.HasPrefix(comm, "python") && len(argv) > 0 && argv[len(argv)-1] == "-" {
		return "python-stdin" // a heredoc script whose shell is gone
	}
	limit := len(argv)
	if limit > 4 {
		limit = 4
	}
	for _, arg := range argv[:limit] {
		for _, m := range toolMarkers {
			if strings.Contains(arg, m.marker) {
				return m.tool
			}
		}
	}
	if len(argv) > 0 && filepath.Base(argv[0]) == "claude" {
		return "claude"
	}
	return ""
}
