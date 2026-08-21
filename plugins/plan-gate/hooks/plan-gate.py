#!/usr/bin/env python3
"""
PreToolUse gate: enforce the spec -> plan -> branch -> code workflow.

Fires on Edit/Write/MultiEdit. Blocks writing CODE unless the current work is on a
branch (not the base branch) and a plan exists for it. The spec/plan itself lives
under docs/, which is always writable, so the gate never blocks writing the plan.

Enforcement is OPT-IN per repo: a repo participates only if it has a
`.claude/plan-gate.config.json`. Any repo without that file is never gated.

Config (all optional, with defaults):
  {
    "baseBranch": "main",                    # code is forbidden here
    "plansDir": "docs/superpowers/plans",    # where plan files live
    "allowedPrefixes": ["docs/"],            # always-writable path prefixes
    "taskIdPattern": "[A-Z][A-Z0-9]+-\\d+"   # how a task id looks in a branch name
  }

Bypass: set AS_SKIP_PLAN_GATE=1 for a single conscious hotfix.

Fail-open: any unexpected error allows the edit — a workflow gate must never brick
the ability to work.
"""
import json
import os
import re
import subprocess
import sys

DEFAULTS = {
    "baseBranch": "main",
    "plansDir": "docs/superpowers/plans",
    "allowedPrefixes": ["docs/"],
    "taskIdPattern": r"[A-Z][A-Z0-9]+-\d+",
}


def allow():
    # No output + exit 0 == let the tool call through.
    sys.exit(0)


def deny(reason):
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(out, ensure_ascii=False))
    sys.exit(0)


def git(repo, *args):
    result = subprocess.run(
        ["git", "-C", repo, *args],
        capture_output=True,
        text=True,
        timeout=5,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git failed")
    return result.stdout.strip()


def find_repo_root(file_path):
    anchors = [os.path.dirname(file_path) or ".", os.getcwd()]
    for anchor in anchors:
        try:
            return git(anchor, "rev-parse", "--show-toplevel")
        except Exception:
            continue
    return None


def load_config(repo_root):
    path = os.path.join(repo_root, ".claude", "plan-gate.config.json")
    if not os.path.isfile(path):
        return None  # repo not opted in
    config = dict(DEFAULTS)
    try:
        with open(path) as handle:
            config.update(json.load(handle))
    except Exception:
        pass  # malformed config -> use defaults but still enforce
    return config


def plan_exists_for_task(repo_root, plans_dir, task_id):
    """A committed or working-tree plan file whose name contains the task id."""
    abs_plans = os.path.join(repo_root, plans_dir)
    if not os.path.isdir(abs_plans):
        return False
    needle = task_id.lower()
    for name in os.listdir(abs_plans):
        if name.endswith(".md") and needle in name.lower():
            return True
    return False


def plan_added_on_branch(repo_root, plans_dir, base_branch):
    """Fallback: any plan file NEW on this branch vs base, or uncommitted."""
    try:
        added = git(
            repo_root, "diff", "--name-only", "--diff-filter=A",
            f"{base_branch}...HEAD", "--", plans_dir,
        )
        if any(line.endswith(".md") for line in added.splitlines()):
            return True
    except Exception:
        pass
    try:
        dirty = git(repo_root, "status", "--porcelain", "--untracked-files=all", "--", plans_dir)
        for line in dirty.splitlines():
            # porcelain: "XY <path>"; treat any touched .md in plansDir as a plan-in-progress
            if line.strip().endswith(".md"):
                return True
    except Exception:
        pass
    return False


def main():
    if os.environ.get("AS_SKIP_PLAN_GATE") == "1":
        allow()

    try:
        data = json.load(sys.stdin)
    except Exception:
        allow()

    tool_input = data.get("tool_input", {}) or {}
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not file_path:
        allow()

    file_path = os.path.abspath(file_path)
    repo_root = find_repo_root(file_path)
    if not repo_root:
        allow()  # not a git repo -> nothing to gate

    config = load_config(repo_root)
    if config is None:
        allow()  # repo not opted in

    rel_path = os.path.relpath(file_path, repo_root)

    # 1. Always-writable prefixes (docs/ by default) -> the spec/plan is never blocked.
    for prefix in config["allowedPrefixes"]:
        if rel_path == prefix.rstrip("/") or rel_path.startswith(prefix):
            allow()

    # Current branch.
    try:
        branch = git(repo_root, "rev-parse", "--abbrev-ref", "HEAD")
    except Exception:
        allow()  # detached / no HEAD -> don't brick

    # 2. Never code on the base branch.
    if branch == config["baseBranch"]:
        deny(
            f"[plan-gate] `{rel_path}` — no code on `{config['baseBranch']}` "
            f"(the deploy branch). Create a feature branch first, then edit.\n"
            f"Bypass a genuine hotfix with AS_SKIP_PLAN_GATE=1."
        )

    # 3. A plan must exist for this work.
    plans_dir = config["plansDir"]
    match = re.search(config["taskIdPattern"], branch)
    if match:
        task_id = match.group(0)
        if not plan_exists_for_task(repo_root, plans_dir, task_id):
            deny(
                f"[plan-gate] `{rel_path}` — branch `{branch}` carries task "
                f"`{task_id}` but no plan `{plans_dir}/*{task_id}*.md` exists. "
                f"Write the plan first (brainstorming -> writing-plans).\n"
                f"Bypass with AS_SKIP_PLAN_GATE=1."
            )
    else:
        if not plan_added_on_branch(repo_root, plans_dir, config["baseBranch"]):
            deny(
                f"[plan-gate] `{rel_path}` — branch `{branch}` has no plan in "
                f"`{plans_dir}` (nothing new vs `{config['baseBranch']}`, nothing "
                f"in the working tree). Write the plan first "
                f"(brainstorming -> writing-plans).\nBypass with AS_SKIP_PLAN_GATE=1."
            )

    # 4. Off the base branch, plan present -> allowed.
    allow()


if __name__ == "__main__":
    main()
