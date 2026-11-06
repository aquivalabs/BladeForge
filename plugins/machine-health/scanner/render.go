package main

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

type hookOutput struct {
	HookSpecificOutput struct {
		HookEventName     string `json:"hookEventName"`
		AdditionalContext string `json:"additionalContext"`
	} `json:"hookSpecificOutput"`
}

// writeHook prints the SessionStart output: a facts block for Claude only. The plugin prints nothing
// to the user itself, because Claude tells them in their own language and the repository keeps its
// strings in English. Nothing is printed when there is nothing to say.
func writeHook(w io.Writer, findings []Finding, updateFrom string) error {
	if len(findings) == 0 && updateFrom == "" {
		return nil
	}
	var ctx strings.Builder
	ctx.WriteString("You should know (machine-health, at session start). Tell the user in your first reply, in the language they use with you.\n")
	for _, f := range findings {
		ctx.WriteString("- " + f.Fact)
		if f.Suggest != "" {
			ctx.WriteString(fmt.Sprintf(" Suggested step: `%s`.", f.Suggest))
		}
		ctx.WriteString("\n")
	}
	if len(findings) > 0 {
		ctx.WriteString("Offer each suggested step and run nothing without the user's explicit yes; a `sudo` step is " +
			"for the user to run. Findings without a step are information only.\n")
	}
	if updateFrom != "" {
		ctx.WriteString(fmt.Sprintf("- A machine-health update is available (installed %s). Suggest the user run `/machine-health:update`.\n", updateFrom))
	}
	var out hookOutput
	out.HookSpecificOutput.HookEventName = "SessionStart"
	out.HookSpecificOutput.AdditionalContext = ctx.String()
	return json.NewEncoder(w).Encode(out)
}

// statusLine renders the segments the user asked for from the newest two snapshots. Missing or
// stale data renders as an empty line, never as numbers that look current.
func statusLine(segments []string, prev, cur Snapshot, have bool, now int64) string {
	if !have || now-cur.T > 10*sampleEvery {
		return ""
	}
	var parts []string
	for _, seg := range segments {
		switch seg {
		case "cpu":
			if prev.Total > 0 && cur.Total > prev.Total && cur.Busy >= prev.Busy {
				parts = append(parts, fmt.Sprintf("cpu %.0f%%", 100*float64(cur.Busy-prev.Busy)/float64(cur.Total-prev.Total)))
			}
		case "mem":
			parts = append(parts, "mem "+pressureName(cur.Pressure))
		case "swap":
			if cur.SwapTotal > 0 {
				parts = append(parts, fmt.Sprintf("swap %.0f/%.0fG", gb(cur.SwapUsed), gb(cur.SwapTotal)))
			}
		}
	}
	return strings.Join(parts, " · ")
}

func pressureName(level int) string {
	switch {
	case level >= 4:
		return "critical"
	case level >= 2:
		return "warn"
	case level == 1:
		return "ok"
	default:
		return "?"
	}
}
