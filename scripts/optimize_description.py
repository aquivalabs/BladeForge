#!/usr/bin/env python3.14
"""Optimize a skill's `description` for triggering accuracy — HYBRID harness.

Reuses Anthropic's skill-creator optimization loop WHOLESALE (train/test split,
LLM-driven `improve_description`, best-by-held-out selection, HTML report) and
swaps ONLY the triggering primitive: skill-creator registers the tested skill as
a slash-command (`.claude/commands/`); we register it as a REAL project-local
skill (`.claude/skills/<name>/SKILL.md`), which is how a marketplace skill
actually reaches Claude in production (via the Skill tool + available_skills).

The stream-detection and timeout logic below is deliberately ADAPTED FROM
upstream's run_eval.run_single_query (select-based reads so a silent child
can't hang us; input_json_delta accumulation because the tool name and the
skill argument arrive in SEPARATE stream events). Do not "simplify" it back
to line-substring matching — that was tried and produces systematic false
negatives.

Why a wrapper and not an upstream edit: skill-creator lives in the read-only
plugin marketplace cache and is overwritten by `/plugin update`. We import its
modules and monkeypatch `run_loop.run_eval` in THIS process only (threads, not
processes, so the patch survives).

Works for marketplace skills (plugins/<plugin>/skills/<skill>/) and
project-local ones (.claude/skills/<skill>/) alike: the skill's identity is its
FOLDER name (our skills carry no `name:` frontmatter), suffixed with a unique
id per probe so detection can't collide with the user's global skills, which
`claude -p` still loads.

Run with the real Python (system 3.9 is too old):
  /opt/homebrew/bin/python3.14 scripts/optimize_description.py \
      --skill-path plugins/salesforce/skills/data-router \
      --model opus [--max-iterations 5] [--runs 5] [--apply] [--report]

Default eval set: <skill-path>/evals/trigger-eval.json (9 should + 9 should-not).
"""
import argparse
import concurrent.futures
import glob
import hashlib
import json
import os
import select
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path


def _skill_creator_scripts_parent():
    """Locate skill-creator's `scripts` package parent, marketplace first."""
    roots = [
        os.path.expanduser("~/.claude/plugins/marketplaces/claude-plugins-official"),
        os.path.expanduser("~/.claude/plugins/cache/claude-plugins-official"),
    ]
    for root in roots:
        hits = glob.glob(os.path.join(root, "**/skill-creator/scripts/__init__.py"),
                         recursive=True)
        if hits:
            return os.path.dirname(os.path.dirname(hits[0]))
    sys.exit("skill-creator plugin not found — is claude-plugins-official installed?")


# Import upstream modules. Their package is `scripts`; our own file is a loose
# module (its dir has no `scripts/` subpackage), so `import scripts.*` resolves
# to skill-creator once its parent is at the front of the path.
sys.path.insert(0, _skill_creator_scripts_parent())
from scripts import run_loop as sc_loop            # noqa: E402
from scripts.generate_report import generate_html  # noqa: E402
from scripts.utils import parse_skill_md           # noqa: E402


def _all_known_plugins():
    """EVERY plugin id in the local plugin cache, across ALL marketplaces
    (xaaalera, accountingseed, claude-plugins-official, ...). The sandbox
    disables them all — any that loads may contain the REAL copy of the skill
    under test, and the model then invokes the real skill's name instead of
    the probe's, scoring a false miss (2026-07-04: ockham measured 0 recall
    while its globally-enabled twin was firing). Enumerating the cache beats
    reading enabledPlugins from settings: it is source-independent, so a
    plugin enabled at ANY scope stays dead in the sandbox."""
    global _PLUGINS_CACHE
    if _PLUGINS_CACHE is None:
        found = set()
        cache = os.path.expanduser("~/.claude/plugins/cache")
        for market in glob.glob(os.path.join(cache, "*")):
            for plugin in glob.glob(os.path.join(market, "*")):
                if os.path.isdir(plugin):
                    found.add(f"{os.path.basename(plugin)}@{os.path.basename(market)}")
        try:
            settings = json.load(open(os.path.expanduser("~/.claude/settings.json")))
            found.update((settings.get("enabledPlugins") or {}).keys())
        except Exception:
            pass
        _PLUGINS_CACHE = sorted(found)
    return _PLUGINS_CACHE


_PLUGINS_CACHE = None


def _register_skill(sandbox, probe_name, description):
    """Write the description as a real project-local skill in the sandbox,
    and ISOLATE the sandbox: project-level settings disable every globally
    enabled plugin (no duplicate/competing marketplace skills) and all hooks
    (no SessionStart noise, no PostToolUse spend). json.dumps gives a valid
    YAML double-quoted scalar — colons/quotes/backslashes can't break it."""
    skill_dir = Path(sandbox, ".claude", "skills", probe_name)
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {probe_name}\ndescription: {json.dumps(description)}\n---\n"
        f"# {probe_name}\nConsult before related work.\n")
    Path(sandbox, ".claude", "settings.json").write_text(json.dumps({
        "disableAllHooks": True,
        "enabledPlugins": {plugin: False for plugin in _all_known_plugins()},
    }))


def _watch_stream(process, probe_name, timeout):
    """Watch claude's stream-json for a Skill/Read tool-use naming our probe.

    select() enforces the deadline even when the child goes silent; the tool's
    input JSON is accumulated across input_json_delta events because the tool
    name and the skill argument never share a stream line.

    Watches the WHOLE probe conversation (until the `result` event or timeout),
    not just the first tool. Do NOT restore upstream's first-tool-decides
    shortcut: on do-it-style queries the model's first move is often TodoWrite/
    Bash/planning and the Skill call comes on a LATER turn — the shortcut
    misscored 17 skills as 0-recall (2026-07-04 fleet triage incident).
    """
    deadline = time.time() + timeout
    buffer = b""
    pending_tool = False
    accumulated = ""
    while time.time() < deadline:
        if process.poll() is None:
            ready, _, _ = select.select([process.stdout], [], [], 1.0)
            if ready:
                chunk = os.read(process.stdout.fileno(), 8192)
                if chunk:
                    buffer += chunk
                elif process.poll() is not None:
                    break
        else:
            buffer += process.stdout.read() or b""
        while b"\n" in buffer:
            line, buffer = buffer.split(b"\n", 1)
            try:
                event = json.loads(line.decode("utf-8", errors="replace"))
            except json.JSONDecodeError:
                continue
            if event.get("type") == "stream_event":
                se = event.get("event", {})
                se_type = se.get("type", "")
                if se_type == "content_block_start":
                    cb = se.get("content_block", {})
                    is_probe_tool = (cb.get("type") == "tool_use"
                                     and cb.get("name") in ("Skill", "Read"))
                    pending_tool, accumulated = is_probe_tool, ""
                elif se_type == "content_block_delta" and pending_tool:
                    delta = se.get("delta", {})
                    if delta.get("type") == "input_json_delta":
                        accumulated += delta.get("partial_json", "")
                        if probe_name in accumulated:
                            return True
                elif se_type == "content_block_stop" and pending_tool:
                    if probe_name in accumulated:
                        return True
                    pending_tool = False
            elif event.get("type") == "assistant":
                for item in event.get("message", {}).get("content", []):
                    if item.get("type") != "tool_use":
                        continue
                    if item.get("name") in ("Skill", "Read") and \
                            probe_name in json.dumps(item.get("input", {})):
                        return True
            elif event.get("type") == "result":
                # A result CAN itself be an API failure (rate-limit burst, 5xx).
                # That is NOT "the skill didn't fire" — raise so the caller
                # retries instead of silently recording a miss (bug #5,
                # 2026-07-04: a burst limit turned 11 skills into fake zeros).
                if event.get("is_error") or event.get("subtype") not in (None, "success"):
                    raise ProbeError(f"probe errored: subtype={event.get('subtype')}")
                return False
        if process.poll() is not None and b"\n" not in buffer:
            break
    return False


class ProbeError(RuntimeError):
    """The probe itself failed (throttled/API error) — result is unknowable."""


def _probe_once(query, skill_name, description, model, timeout):
    """One claude -p run in a throwaway sandbox; True iff our skill fired.
    The probe name gets a unique suffix so it can't be confused with the
    user's GLOBAL skills, which claude -p loads even inside the sandbox."""
    probe_name = f"{skill_name}-{uuid.uuid4().hex[:8]}"
    sandbox = tempfile.mkdtemp(prefix="opt-desc-")
    process = None
    try:
        _register_skill(sandbox, probe_name, description)
        cmd = ["claude", "-p", query, "--output-format", "stream-json",
               "--verbose", "--include-partial-messages"]
        if model:
            cmd += ["--model", model]
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        # own process group so the kill reaps claude's children too, not just it
        process = subprocess.Popen(cmd, cwd=sandbox, env=env,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL,
                                   start_new_session=True)
        fired = _watch_stream(process, probe_name, timeout)
        if not fired and process.poll() not in (None, 0):
            # claude -p died without a clean result (auth/throttle/crash):
            # unknowable, not a miss
            raise ProbeError(f"claude -p exited {process.poll()}")
        return fired
    finally:
        if process is not None:
            if process.poll() is None:
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    process.kill()
            try:
                process.wait(timeout=5)
            except Exception:
                pass
            process.stdout.close()
        shutil.rmtree(sandbox, ignore_errors=True)


def make_run_eval(folder_name):
    """Build the drop-in replacement for skill-creator's run_eval, closed over
    the FOLDER-derived skill name (our skills carry no name: frontmatter, so
    upstream's parse_skill_md name — which run_loop passes as skill_name — would
    be ''). Signature must keep upstream's exact keyword names: run_loop calls
    run_eval(eval_set=..., skill_name=..., ...) by keyword."""

    def run_eval(eval_set, skill_name, description, num_workers, timeout,
                 project_root, runs_per_query=5, trigger_threshold=0.5, model=None):
        # skill_name (upstream's parsed frontmatter name) and project_root are
        # deliberately ignored: folder_name is the identity, probes self-sandbox.
        triggers = {i: [] for i in range(len(eval_set))}   # index-keyed: duplicate
        jobs = [(i, item) for i, item in enumerate(eval_set)  # query strings survive
                for _ in range(runs_per_query)]
        def probe_with_retry(query):
            """Retry throttled/errored probes with backoff; only a probe that
            fails 3 times is surfaced — and even then as ERROR, never as a
            silent miss."""
            for attempt, pause in enumerate((0, 20, 60)):
                if pause:
                    time.sleep(pause)
                try:
                    return _probe_once(query, skill_name, description, model, timeout)
                except ProbeError as e:
                    last = e
            raise last

        errors = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as ex:
            futs = {ex.submit(probe_with_retry, item["query"]): i
                    for (i, item) in jobs}
            for fut in concurrent.futures.as_completed(futs):
                try:
                    triggers[futs[fut]].append(fut.result())
                except Exception as e:
                    errors += 1
                    print(f"PROBE-ERROR (counted, not a miss): {e}", file=sys.stderr)
                    triggers[futs[fut]].append(False)
        if errors:
            print(f"UNRELIABLE RESULT: {errors} probe(s) errored after retries "
                  f"— treat this skill's numbers as suspect", file=sys.stderr)
        results = []
        for i, item in enumerate(eval_set):
            fired = triggers[i]
            rate = sum(fired) / len(fired) if fired else 0.0
            should = item["should_trigger"]
            results.append({"query": item["query"], "should_trigger": should,
                            "trigger_rate": rate, "triggers": sum(fired),
                            "runs": len(fired),
                            "pass": (rate >= trigger_threshold) == should})
        passed = sum(1 for r in results if r["pass"])
        return {"skill_name": skill_name, "description": description,
                "results": results,
                "summary": {"total": len(results), "passed": passed,
                            "failed": len(results) - passed}}

    return run_eval


def replace_description(skill_md: Path, new_desc: str):
    """Surgical frontmatter rewrite — no regex. Handles inline values, block
    scalars (>, |, with chomping modifiers) and description-as-last-field.
    Writes the new value as a JSON/YAML double-quoted scalar (escape-safe)."""
    lines = skill_md.read_text().split("\n")
    if lines[0].strip() != "---":
        sys.exit(f"{skill_md}: no frontmatter — cannot --apply")
    fence = next(i for i, ln in enumerate(lines[1:], 1) if ln.strip() == "---")
    start = next((i for i in range(1, fence) if lines[i].startswith("description:")), None)
    if start is None:
        sys.exit(f"{skill_md}: no description field — cannot --apply")
    end = start + 1                      # swallow block-scalar continuation lines
    while end < fence and (lines[end].startswith((" ", "\t")) or not lines[end].strip()):
        end += 1
    new_lines = lines[:start] + [f"description: {json.dumps(new_desc)}"] + lines[end:]
    skill_md.write_text("\n".join(new_lines))


def build_result_payload(skill_name, model, runs, holdout, out, queryset_bytes, applied):
    """Machine-readable measurement record persisted next to the queryset. The
    two hashes key the record to the EXACT queryset + description measured, so a
    later edit to either marks the eval-gate's freshness check stale."""
    import datetime
    return {
        "skill": skill_name,
        "measured_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "model": model,
        "runs_per_query": runs,
        "holdout": holdout,
        "best_score": out["best_score"],
        "best_train_score": out.get("best_train_score"),
        "exit_reason": out["exit_reason"],
        "description_hash": hashlib.sha256(out["best_description"].encode()).hexdigest(),
        "queryset_hash": hashlib.sha256(queryset_bytes).hexdigest(),
        "applied": bool(applied),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skill-path", required=True,
                    help="marketplace (plugins/*/skills/<name>) or local (.claude/skills/<name>)")
    ap.add_argument("--eval-set", help="default: <skill-path>/evals/trigger-eval.json")
    ap.add_argument("--model", default="opus",
                    help="model for the claude -p probes AND the improver")
    ap.add_argument("--max-iterations", type=int, default=5)
    ap.add_argument("--runs", type=int, default=5,
                    help="runs per query (more = less variance, more token spend)")
    ap.add_argument("--workers", type=int, default=6,
                    help="concurrent claude -p probes")
    ap.add_argument("--holdout", type=float, default=0.4,
                    help="fraction held out for test (guards against overfitting)")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument("--apply", action="store_true",
                    help="write best_description back into SKILL.md")
    ap.add_argument("--report", action="store_true", help="write an HTML report")
    args = ap.parse_args()
    if args.runs < 1:
        sys.exit("--runs must be >= 1")

    skill_path = Path(os.path.abspath(args.skill_path))
    skill_name = skill_path.name          # folder is the identity, NOT frontmatter
    eval_set_path = args.eval_set or (skill_path / "evals" / "trigger-eval.json")
    if not Path(eval_set_path).is_file():
        sys.exit(f"no eval set at {eval_set_path} — create one first")
    eval_set = json.loads(Path(eval_set_path).read_text())
    if not eval_set or not any(e["should_trigger"] for e in eval_set) \
            or not any(not e["should_trigger"] for e in eval_set):
        sys.exit("eval set needs at least one should-trigger AND one should-not query")

    # THE swap: run the upstream loop with our production-faithful eval primitive.
    sc_loop.run_eval = make_run_eval(skill_name)

    report_path = None
    if args.report:
        report_path = Path(tempfile.gettempdir()) / \
            f"optimize_{skill_name}_{time.strftime('%Y%m%d_%H%M%S')}.html"

    out = sc_loop.run_loop(
        eval_set=eval_set, skill_path=skill_path, description_override=None,
        num_workers=args.workers, timeout=args.timeout,
        max_iterations=args.max_iterations, runs_per_query=args.runs,
        trigger_threshold=0.5, holdout=args.holdout, model=args.model,
        verbose=True, live_report_path=report_path, log_dir=None)

    print("\n" + "=" * 70)
    print(f"  {skill_name}   —   best test score: {out['best_score']}   "
          f"(train {out.get('best_train_score')})   [{out['exit_reason']}]")
    print("-" * 70)
    print(f"  BEFORE: {out['original_description']}")
    print(f"  AFTER : {out['best_description']}")
    print("=" * 70)

    applied = bool(args.apply and out["best_description"] != out["original_description"])
    result_path = skill_path / "evals" / "result.json"
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(
        build_result_payload(skill_name, args.model, args.runs, args.holdout,
                             out, Path(eval_set_path).read_bytes(), applied),
        indent=2) + "\n")
    print(f"  result: {result_path}")

    if report_path:
        report_path.write_text(generate_html(out, auto_refresh=False,
                                             skill_name=skill_name))
        print(f"  report: {report_path}")

    if args.apply and out["best_description"] != out["original_description"]:
        replace_description(skill_path / "SKILL.md", out["best_description"])
        print(f"  applied best_description to {skill_path}/SKILL.md")
    elif args.apply:
        print("  --apply: no change (best == original)")


if __name__ == "__main__":
    main()
