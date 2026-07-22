#!/usr/bin/env python3.14
"""Score a skill's `description` by trigger-eval accuracy, on a 0-10 scale, and
explain — in plain terms — WHY the score is what it is and what's missing.

score = (test prompts handled correctly / total) x 10, over a saved set of
9 should-trigger + 9 should-not queries. Compares CURRENT (working tree) vs a
BASELINE description (git HEAD by default) so you see prev-vs-current before merge.

Gate: PASS iff current >= --bar AND current >= baseline (no regression).

The expensive part is the eval (each query x 3 runs of `claude -p`). The cheap part
is formatting. Use --from-result <run_eval.json> to re-render a saved result with
ZERO new eval spend while iterating on the report.

NB: an isolated eval under-measures a CONTEXT-DEPENDENT skill (one that only makes
sense with the real repo / a file it consults / CLAUDE.md routing — e.g. git:commit,
hooks-registry). For those, only the no-regression check is meaningful; the report
says so. Apply the absolute >=7 bar to SELF-CONTAINED skills (the description alone
should pull the model to them).

Usage:
  python3.14 plugins/meta/skills/skill-eval/scripts/score-description.py --skill-path plugins/meta/skills/ockham
  python3.14 plugins/meta/skills/skill-eval/scripts/score-description.py --from-result /path/to/run_eval.json   # free re-render
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


import concurrent.futures
import time


def description_from_text(text):
    m = re.search(r"^---\n(.*?)\n---", text, re.S)
    frontmatter = m.group(1) if m else text
    m2 = re.search(r"^description:\s*(.*)$", frontmatter, re.M)
    if not m2:
        return None
    inline = m2.group(1).strip()
    # YAML block scalar (`description: >` folded / `description: |` literal): the real
    # text is the indented lines that follow. Without this we'd capture just ">" and
    # eval an empty description — silently scoring every such skill on nothing.
    if inline in (">", "|", ">-", "|-", ">+", "|+"):
        lines = frontmatter.splitlines()
        idx = next(i for i, ln in enumerate(lines) if re.match(r"^description:\s", ln))
        body = []
        for ln in lines[idx + 1:]:
            if ln.strip() and not ln.startswith((" ", "\t")):
                break  # next top-level key → block ended
            body.append(ln.strip())
        folded = inline.startswith(">")
        return (" " if folded else "\n").join(b for b in body).strip()
    return inline.strip('"').strip("'")


def git_head_description(skill_path):
    repo = subprocess.run(["git", "-C", skill_path, "rev-parse", "--show-toplevel"],
                          capture_output=True, text=True).stdout.strip()
    if not repo:
        return None
    rel = os.path.relpath(os.path.join(skill_path, "SKILL.md"), repo)
    out = subprocess.run(["git", "-C", repo, "show", f"HEAD:{rel}"],
                         capture_output=True, text=True)
    return description_from_text(out.stdout) if out.returncode == 0 else None


def _write_skill(project, clean_name, description):
    """Register the description as a REAL project-local skill (not a slash command),
    so it lands in Claude's available_skills and can auto-trigger via the Skill tool.
    (Registering it as a .claude/commands/ file — as skill-creator's run_eval does —
    does NOT auto-trigger, which silently scores every skill 0; that was the bug.)"""
    d = os.path.join(project, ".claude", "skills", clean_name)
    os.makedirs(d, exist_ok=True)
    Path(d, "SKILL.md").write_text(f"---\nname: {clean_name}\ndescription: {description}\n---\n"
                                   f"# {clean_name}\nConsult before related work.\n")


def _fired(project, query, model, timeout=40):
    """True if the model reached for the (only) skill in this sandbox via the Skill tool."""
    cmd = ["claude", "-p", query, "--output-format", "stream-json",
           "--verbose", "--include-partial-messages"]
    if model:
        cmd += ["--model", model]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    p = subprocess.Popen(cmd, cwd=project, env=env, text=True,
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    end = time.time() + timeout
    fired = False
    try:
        for line in p.stdout:
            if '"name":"Skill"' in line:      # only one skill exists here → it's ours
                fired = True
                break
            if time.time() > end:
                break
    finally:
        p.kill()
        try:
            p.wait(timeout=5)
        except Exception:
            pass
    return fired


def eval_description(project, clean_name, description, queries, model, runs=5, workers=10):
    """Return run_eval-shaped dict for a description over the query set."""
    _write_skill(project, clean_name, description)
    jobs = [(i, q) for i, q in enumerate(queries) for _ in range(runs)]
    fires = {i: 0 for i in range(len(queries))}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_fired, project, q["query"], model): i for (i, q) in jobs}
        for fut in concurrent.futures.as_completed(futs):
            if fut.result():
                fires[futs[fut]] += 1
    results = []
    for i, q in enumerate(queries):
        rate = fires[i] / runs
        should = bool(q["should_trigger"])
        results.append({"query": q["query"], "should_trigger": should,
                        "triggers": fires[i], "runs": runs, "trigger_rate": rate,
                        "pass": (rate >= 0.5) == should})
    passed = sum(1 for r in results if r["pass"])
    return {"skill_name": clean_name, "description": description, "results": results,
            "summary": {"total": len(results), "passed": passed, "failed": len(results) - passed}}


def rows_of(result):
    rows = []
    for r in result.get("results", []):
        rows.append({
            "query": r.get("query", ""),
            "should_trigger": bool(r.get("should_trigger")),
            "triggers": r.get("triggers", 0),
            "runs": r.get("runs", 3),
            "rate": r.get("trigger_rate", 0.0),
            "passed": bool(r.get("pass", r.get("passed", False))),
        })
    return rows


def accuracy(rows):
    return sum(1 for r in rows if r["passed"]) / len(rows) if rows else 0.0


def why(rows):
    """Deterministic, plain-language explanation of the score."""
    pos = [r for r in rows if r["should_trigger"]]
    neg = [r for r in rows if not r["should_trigger"]]
    fired_ok = [r for r in pos if r["passed"]]
    misses = [r for r in pos if not r["passed"]]
    false_fires = [r for r in neg if not r["passed"]]
    lines = []
    if pos and not fired_ok:
        lines.append(
            f"The skill did NOT activate on ANY of the {len(pos)} 'should-use-it' prompts. "
            "Two possible causes: (a) the description is too weak a signal — make it name the exact "
            "user phrasings / concrete cues; or (b) it's a task Claude does directly, so the skill "
            "only fires via CLAUDE.md routing in a real repo and this isolated score can't measure it "
            "(context-dependent skill — judge it by no-regression only).")
    elif misses:
        lines.append(
            f"Fires on {len(fired_ok)}/{len(pos)} should-use-it prompts but MISSES {len(misses)} — "
            "the description doesn't signal for those phrasings. Add cues that cover them (see the "
            "MISSED list below).")
    elif pos:
        lines.append(f"Activates on all {len(pos)} should-use-it prompts. 👍")
    if false_fires:
        lines.append(
            f"WRONGLY fired on {len(false_fires)}/{len(neg)} prompts that should stay silent — the "
            "description is too broad and overlaps neighbours. Narrow it away from those topics.")
    elif neg:
        lines.append(f"No false fires — correctly ignored all {len(neg)} near-miss prompts.")
    return lines


def verdict(rows, skill_type, score10, bar):
    """Return (emoji, headline, means, todo) — a decisive one-glance verdict."""
    pos = [r for r in rows if r["should_trigger"]]
    neg = [r for r in rows if not r["should_trigger"]]
    fired_ok = sum(1 for r in pos if r["passed"])
    misses = [r for r in pos if not r["passed"]]
    ffires = [r for r in neg if not r["passed"]]

    if ffires and fired_ok == 0:
        return ("❌", "broken — fires on the WRONG prompts and misses the right ones",
                f"It stayed silent on all the requests that need it, yet fired on {len(ffires)} it "
                "should have ignored. The wording points at the wrong things.",
                "Rewrite the description around what this skill is actually for; see both lists below.")
    if fired_ok == 0 and pos:
        if skill_type == "context-dependent":
            return ("⚠️", "can't be judged by this test (needs the real repo)",
                    "The skill never switched on — but that's expected: it only makes sense with the "
                    "actual project (a file it reads, or the project's CLAUDE.md telling Claude to use "
                    "it). A standalone test can't fairly score it.",
                    "Leave the description. For this skill only check it didn't get WORSE than before "
                    "(no regression).")
        return ("❌", "the description is too weak — the skill never turns on",
                "Even on requests that clearly need it, Claude didn't reach for the skill. The wording "
                "isn't a strong enough signal.",
                "Strengthen it: name the exact user phrasings / concrete cues it missed (list below), "
                "then re-score.")
    if misses:
        return ("⚠️", f"partial — works on {fired_ok}/{len(pos)}, misses {len(misses)}",
                "It fires for some requests but not others — the description covers part of the ground.",
                "Add wording for the missed phrasings (list below), then re-score.")
    if ffires:
        return ("⚠️", "too broad — fires when it should stay silent",
                f"It correctly handles the right requests but also fired on {len(ffires)} it should "
                "ignore.", "Narrow the description away from the neighbours it collides with (list below).")
    ok = score10 >= bar
    return ("✅" if ok else "⚠️", "solid" if ok else "ok, but below the bar",
            "Fires on the right requests, stays silent on the rest.",
            "Ship it." if ok else f"Fine, but under the {bar}/10 bar — tighten if you want it higher.")


def recommendations(rows, skill_type, bar, score10):
    """Deterministic, concrete next-steps keyed to the failure pattern."""
    pos = [r for r in rows if r["should_trigger"]]
    neg = [r for r in rows if not r["should_trigger"]]
    fired_ok = sum(1 for r in pos if r["passed"])
    misses = [r for r in pos if not r["passed"]]
    ffires = [r for r in neg if not r["passed"]]
    ex = lambda items: "; ".join(f'"{r["query"]}"' for r in items[:3])

    if fired_ok == 0 and pos and skill_type == "context-dependent":
        return [
            "Do NOT edit the description — the wording isn't the bottleneck here.",
            "Make sure the consuming repo's CLAUDE.md lists this skill so Claude gets routed to it.",
            "After future edits, only re-check no-regression (this isolated score can't climb).",
        ]
    if fired_ok == 0 and pos:
        return [
            f"Name the exact user phrasings it missed, e.g. {ex(misses)}.",
            "Be pushier about WHEN: open with \"Use whenever the user …\" and add "
            "\"even if they don't explicitly say <keyword>\".",
            "Keep it about WHEN to use it, not what it does.",
            "Re-run with --suggest to get a concrete rewritten description, then re-score.",
        ]
    if misses:
        return [
            f"Extend the description to cover the missed phrasings: {ex(misses)}.",
            f"Re-run with --suggest for a proposed rewrite; aim for no-regression AND >= {bar}/10.",
        ]
    if ffires:
        return [
            f"Narrow the wording away from what wrongly fired: {ex(ffires)}.",
            "Add a short \"not for X\" clause that separates it from those neighbours.",
        ]
    if score10 >= bar:
        return ["No change needed — the description triggers cleanly."]
    return [f"Solid but under {bar}/10 — optional: tighten wording to catch the borderline cases."]


def suggest_description(claude_bin, name, description, misses, ffires, model):
    prompt = (
        f"Rewrite the `description` frontmatter for a Claude Code skill '{name}' so it triggers better. "
        "The description is the ONLY signal Claude uses to decide whether to open the skill; it must say "
        "WHEN to use it (triggering conditions), never summarize the workflow.\n"
        f"Current: \"{description}\"\n"
        f"It FAILED to trigger on: {json.dumps([r['query'] for r in misses])}\n"
        f"It WRONGLY triggered on: {json.dumps([r['query'] for r in ffires])}\n"
        "Output ONLY the single-line rewritten description, nothing else.")
    try:
        out = subprocess.run([claude_bin, "-p", prompt, "--model", model],
                             capture_output=True, text=True, timeout=120,
                             env={k: v for k, v in os.environ.items() if k != "CLAUDECODE"})
        return out.stdout.strip()
    except Exception as e:
        return f"(suggestion skipped: {e})"


def render(name, description, result, bar, base_acc=None, skill_type="self-contained",
           suggest=False):
    rows = rows_of(result)
    acc = accuracy(rows)
    s10 = round(acc * 10, 1)
    pos = [r for r in rows if r["should_trigger"]]
    neg = [r for r in rows if not r["should_trigger"]]
    fired_ok = sum(1 for r in pos if r["passed"])
    silent_ok = sum(1 for r in neg if r["passed"])
    emoji, headline, means, todo = verdict(rows, skill_type, s10, bar)

    print()
    print(f"{emoji}  {name or '(skill)'}   —   {s10}/10   —   {headline}")
    print("─" * 70)
    mark_on = "✓" if fired_ok == len(pos) else "← the problem" if fired_ok == 0 else "← partial"
    print(f"  when users clearly want it :  turned ON  {fired_ok} of {len(pos)}   {mark_on}")
    print(f"  when it should stay off    :  stayed off {silent_ok} of {len(neg)}   "
          f"{'✓' if silent_ok == len(neg) else '← false alarms'}")
    if base_acc is not None:
        b10 = round(base_acc * 10, 1)
        gate = s10 >= bar and acc >= base_acc
        print(f"  vs previous description    :  was {b10}/10  →  now {s10}/10  ({s10 - b10:+.1f})   "
              f"gate: {'PASS' if gate else 'FAIL'}")
    print()
    print(f"  WHAT IT MEANS:  {means}")
    print(f"  WHAT TO DO:     {todo}")

    print("\n  RECOMMENDATIONS:")
    for i, rec in enumerate(recommendations(rows, skill_type, bar, s10), 1):
        print(f"    {i}. {rec}")

    misses = [r for r in pos if not r["passed"]]
    ffires = [r for r in neg if not r["passed"]]

    if suggest and (misses or ffires):
        claude_bin = shutil.which("claude") or "/opt/homebrew/bin/claude"
        proposed = suggest_description(claude_bin, name, description, misses, ffires, "opus")
        print(f"\n  SUGGESTED DESCRIPTION (try, then re-score):\n    {proposed}")
    if misses:
        print(f"\n  requests it MISSED (should have fired):")
        for r in misses:
            print(f"    · \"{r['query']}\"   (fired {r['triggers']}/{r['runs']})")
    if ffires:
        print(f"\n  wrongly fired on (should have stayed silent):")
        for r in ffires:
            print(f"    · \"{r['query']}\"   (fired {r['triggers']}/{r['runs']})")
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skill-path", help="skill dir (required unless --from-result)")
    ap.add_argument("--from-result", help="render a saved run_eval JSON, no new eval")
    ap.add_argument("--queryset", help="default: <skill>/evals/trigger-eval.json")
    ap.add_argument("--baseline-description", help="default: the git HEAD version")
    ap.add_argument("--model", default="opus")
    ap.add_argument("--runs", type=int, default=5,
                    help="runs per query (more = less run-to-run variance, more token spend)")
    ap.add_argument("--bar", type=float, default=7.0)
    ap.add_argument("--type", choices=["self-contained", "context-dependent"],
                    default="self-contained",
                    help="context-dependent = only fires with the real repo/routing; "
                         "then absolute score is informational, judge by no-regression")
    ap.add_argument("--suggest", action="store_true",
                    help="also propose a rewritten description via one LLM call")
    args = ap.parse_args()

    if args.from_result:
        result = json.load(open(args.from_result))
        name = result.get("skill_name", "") or os.path.basename(os.path.dirname(os.path.dirname(args.from_result)))
        render(name, result.get("description", "(from saved result)"), result, args.bar,
               skill_type=args.type, suggest=args.suggest)
        return

    if not args.skill_path:
        sys.exit("--skill-path is required (or use --from-result)")
    skill_path = os.path.abspath(args.skill_path)
    queryset = args.queryset or os.path.join(skill_path, "evals", "trigger-eval.json")
    if not os.path.isfile(queryset):
        sys.exit(f"no queryset at {queryset} — create one first")

    current = description_from_text(Path(skill_path, "SKILL.md").read_text())
    baseline = args.baseline_description or git_head_description(skill_path)
    queries = json.load(open(queryset))
    clean = re.sub(r"[^a-z0-9-]", "-", os.path.basename(skill_path).lower()) + "-probe"

    with tempfile.TemporaryDirectory() as ws:
        cur_result = eval_description(ws, clean, current, queries, args.model, runs=args.runs)
        base_acc = None
        if baseline and baseline != current:
            base_acc = accuracy(rows_of(eval_description(ws, clean, baseline, queries, args.model, runs=args.runs)))

    render(os.path.basename(skill_path), current, cur_result, args.bar, base_acc,
           skill_type=args.type, suggest=args.suggest)


if __name__ == "__main__":
    main()
