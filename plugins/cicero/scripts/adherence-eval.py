#!/usr/bin/env python3
"""CICERO style-adherence eval.

Measures whether replies produced UNDER the CICERO output style actually follow its rules.
Companion to (not a replacement for) meta:skill-eval, which measures trigger accuracy of
skill descriptions; CICERO is an always-on output style, so what needs measuring is adherence.

Protocol, and why it is shaped this way:
- Each case in evals/style-adherence.json probes named rules with two kinds of checks:
  deterministic 'mechanical' checks run here (the IFEval move - a checkable rule gets a
  checker, not an opinion), and binary 'judge' questions answered by an LLM judge.
- Judge questions are BINARY on purpose: preference-style judging prefers the longer answer
  >90% of the time once lengths differ >20% (Saito 2023, arXiv:2310.10076). Factual yes/no
  questions per rule sidestep the length bias instead of fighting it.
- The subject runs in a throwaway sandbox project with `--setting-sources project`, so the
  ONLY styling influence is the sandbox's own settings: with the CICERO style installed
  (subject), or bare (--baseline). Without that flag a user-level cicero plugin would force
  the style into the baseline too and the comparison would measure nothing.
- Spawns `claude -p` (an LLM). Run LOCALLY, on demand - never in CI.

Usage:
  python3 plugins/cicero/scripts/adherence-eval.py [--model sonnet] [--judge-model sonnet]
      [--case <id>] [--baseline] [--out result.json]
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLUGIN = HERE.parent
STYLE = PLUGIN / "output-styles" / "cicero.md"
CASES = PLUGIN / "evals" / "style-adherence.json"

FENCE_RE = re.compile(r"^```(\S*)\s*$")


def env_for_claude():
    return {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}


def make_sandbox(with_style):
    root = Path(tempfile.mkdtemp(prefix="cicero-eval-"))
    dot = root / ".claude"
    dot.mkdir()
    if with_style:
        styles = dot / "output-styles"
        styles.mkdir()
        # Drop plugin-only frontmatter keys; a project output style needs only name/description.
        text = STYLE.read_text()
        text = re.sub(r"^(keep-coding-instructions|force-for-plugin):.*\n", "", text, flags=re.M)
        (styles / "cicero.md").write_text(text)
        (dot / "settings.json").write_text(json.dumps({"outputStyle": "CICERO"}))
    else:
        (dot / "settings.json").write_text("{}")
    return root


def run_claude(project, prompt, model, resume=None, timeout=240):
    cmd = ["claude", "-p", prompt, "--output-format", "json",
           "--setting-sources", "project", "--model", model]
    if resume:
        cmd += ["--resume", resume]
    out = subprocess.run(cmd, cwd=project, env=env_for_claude(), text=True,
                         capture_output=True, timeout=timeout)
    if out.returncode != 0:
        raise RuntimeError(f"claude -p failed: {out.stderr.strip()[:400]}")
    data = json.loads(out.stdout)
    usage = data.get("usage", {}) or {}
    return {
        "text": data.get("result", ""),
        "session_id": data.get("session_id"),
        "cost_usd": data.get("total_cost_usd", 0) or 0,
        "tokens": {
            "input": usage.get("input_tokens", 0),
            "output": usage.get("output_tokens", 0),
            "cache_read": usage.get("cache_read_input_tokens", 0),
            "cache_write": usage.get("cache_creation_input_tokens", 0),
        },
    }


# --- text dissection ---------------------------------------------------------

def split_fences(text):
    """Return (prose_lines, fence_blocks) where each block is (tag, body_lines)."""
    prose, blocks = [], []
    tag, body, inside = None, [], False
    for line in text.splitlines():
        m = FENCE_RE.match(line.strip())
        if m and not inside:
            inside, tag, body = True, m.group(1), []
        elif m and inside:
            blocks.append((tag, body))
            inside = False
        elif inside:
            body.append(line)
        else:
            prose.append(line)
    if inside:                      # unterminated fence - treat as a block
        blocks.append((tag, body))
    return prose, blocks


def first_sentence(text):
    prose, _ = split_fences(text)
    flat = " ".join(l for l in prose if l.strip())
    m = re.search(r"[.!?…](\s|$)", flat)
    return flat[: m.end()] if m else flat


# --- mechanical checks -------------------------------------------------------

def run_mechanical(check, replies):
    t = check["type"]
    turn = check.get("turn", 1)
    text = replies[turn - 1]
    prose, blocks = split_fences(text)
    prose_flat = "\n".join(prose)

    if t == "first_sentence_not_matches":
        hit = re.search(check["pattern"], first_sentence(text))
        return hit is None, (f"first sentence matches {hit.group(0)!r}" if hit else "")
    if t == "must_match":
        return bool(re.search(check["pattern"], text)), f"missing /{check['pattern']}/"
    if t == "must_not_match":
        hit = re.search(check["pattern"], prose_flat)
        return hit is None, (f"prose matches {hit.group(0)!r}" if hit else "")
    if t == "count_matches_max":
        n = len(re.findall(check["pattern"], text))
        return n <= check["max"], f"{n} matches > max {check['max']}"
    if t == "max_prose_words":
        n = len(re.findall(r"\S+", prose_flat))
        return n <= check["max"], f"{n} prose words > max {check['max']}"
    if t == "no_untagged_fence":
        bad = [tag for tag, _ in blocks if not tag]
        return not bad, f"{len(bad)} untagged fence(s)"
    if t == "no_box_drawing_in_fence":
        bad = [tag for tag, body in blocks if re.search(r"[│├└]", "\n".join(body))]
        return not bad, f"box-drawing inside fence(s): {bad}"
    if t == "cyrillic_prose_ratio_min":
        letters = re.findall(r"[^\W\d_]", prose_flat)
        cyr = [c for c in letters if "\u0400" <= c <= "\u04FF"]
        ratio = len(cyr) / len(letters) if letters else 0
        return ratio >= check["min"], f"cyrillic ratio {ratio:.2f} < {check['min']}"
    raise ValueError(f"unknown mechanical check: {t}")


# --- judge -------------------------------------------------------------------

JUDGE_PREAMBLE = (
    "You audit ONE assistant reply against binary criteria. Judge ONLY the stated criteria. "
    "Ignore length, eloquence, and whether you would have answered differently - a short plain "
    "answer and a long polished one are equal if both satisfy the criterion. "
    'Output STRICT JSON only: {"answers":[{"q":<n>,"verdict":"pass"|"fail","reason":"<short>"}]}'
)


def extract_json(raw):
    """First parseable JSON object in raw text (judges wrap JSON in prose or fences)."""
    dec = json.JSONDecoder()
    for start in [m.start() for m in re.finditer(r"\{", raw)]:
        try:
            obj, _ = dec.raw_decode(raw[start:])
            if isinstance(obj, dict) and "answers" in obj:
                return obj
        except json.JSONDecodeError:
            continue
    return None


def run_judge(questions, replies, prompt, model, timeout=180, retries=1):
    convo = f"USER PROMPT:\n{prompt}\n\nASSISTANT REPLY (turn 1):\n{replies[0]}"
    if len(replies) > 1:
        convo += f"\n\nASSISTANT REPLY (turn 2, after the user's follow-up):\n{replies[1]}"
    qs = "\n".join(f"{i + 1}. {q} (pass = yes)" for i, q in enumerate(questions))
    cost = 0.0
    for _ in range(retries + 1):
        out = subprocess.run(
            ["claude", "-p", f"{JUDGE_PREAMBLE}\n\n{convo}\n\nCRITERIA:\n{qs}",
             "--output-format", "json", "--setting-sources", "project", "--model", model],
            env=env_for_claude(), text=True, capture_output=True, timeout=timeout)
        data = json.loads(out.stdout)
        cost += data.get("total_cost_usd", 0) or 0
        obj = extract_json(data.get("result", ""))
        if obj is not None:
            return obj["answers"], cost
    return [{"q": 0, "verdict": "fail", "reason": "judge output unparseable after retry"}], cost


# --- main --------------------------------------------------------------------

def run_case(case, sandbox, model, judge_model):
    replies, cost = [], 0.0
    r1 = run_claude(sandbox, case["prompt"], model)
    replies.append(r1["text"])
    cost += r1["cost_usd"]
    if case.get("second_turn"):
        r2 = run_claude(sandbox, case["second_turn"], model, resume=r1["session_id"])
        replies.append(r2["text"])
        cost += r2["cost_usd"]

    failures = []
    for chk in case.get("mechanical", []):
        ok, why = run_mechanical(chk, replies)
        if not ok:
            failures.append(f"mech:{chk['type']}: {why}")

    judge_answers = []
    if case.get("judge"):
        judge_answers, jcost = run_judge(case["judge"], replies, case["prompt"], judge_model)
        cost += jcost
        for a in judge_answers:
            if a.get("verdict") != "pass":
                q = case["judge"][a["q"] - 1] if 0 < a.get("q", 0) <= len(case["judge"]) else "?"
                failures.append(f"judge:q{a.get('q')}: {a.get('reason', '')} [{q[:60]}]")

    return {
        "id": case["id"], "rules": case["rules"], "passed": not failures,
        "failures": failures, "replies": replies, "judge": judge_answers,
        "cost_usd": round(cost, 4),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--judge-model", default="sonnet")
    ap.add_argument("--case", help="run a single case id")
    ap.add_argument("--baseline", action="store_true",
                    help="ALSO run every case without the style, to confirm the eval discriminates")
    ap.add_argument("--out", help="write full results JSON here")
    args = ap.parse_args()

    cases = json.loads(CASES.read_text())["cases"]
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            sys.exit(f"no case {args.case!r}")

    results = {}
    for variant, styled in (("cicero", True),) + ((("baseline", False),) if args.baseline else ()):
        sandbox = make_sandbox(styled)
        try:
            rs = []
            for c in cases:
                try:
                    rs.append(run_case(c, sandbox, args.model, args.judge_model))
                except Exception as e:                      # one broken case must not kill the suite
                    rs.append({"id": c["id"], "rules": c["rules"], "passed": False,
                               "failures": [f"harness: {e}"], "replies": [], "judge": [],
                               "cost_usd": 0})
            results[variant] = rs
        finally:
            shutil.rmtree(sandbox, ignore_errors=True)

    width = max(len(c["id"]) for c in cases)
    for variant, rs in results.items():
        passed = sum(r["passed"] for r in rs)
        print(f"\n== {variant}: {passed}/{len(rs)} cases pass "
              f"(${sum(r['cost_usd'] for r in rs):.2f}) ==")
        for r in rs:
            mark = "PASS" if r["passed"] else "FAIL"
            print(f"  {mark}  {r['id']:<{width}}  rules {','.join(map(str, r['rules']))}")
            for f in r["failures"]:
                print(f"        - {f}")

    if args.out:
        Path(args.out).write_text(json.dumps(results, indent=2, ensure_ascii=False))
        print(f"\nfull results -> {args.out}")

    sys.exit(0 if all(r["passed"] for r in results.get("cicero", [])) else 1)


if __name__ == "__main__":
    main()
