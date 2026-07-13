# scripts/scout_validate.test.py
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = str(Path(__file__).with_name("scout_validate.py"))


def run(skill_dir):
    return subprocess.run(
        [sys.executable, SCRIPT, str(skill_dir)], capture_output=True, text=True
    )


VALID_META = """\
schema-version: 1
purpose: Does a thing that helps.
best-for: When you need the thing.
needs: []
changes:
  tags: [none_placeholder]
  notes: ""
"""


def make_skill(root: Path, name="myskill", plugin="myplugin"):
    """Build plugins/<plugin>/skills/<name>/ under root and return the skill dir."""
    skill_dir = root / "plugins" / plugin / "skills" / name
    skill_dir.mkdir(parents=True)
    return skill_dir


def write_meta(skill_dir: Path, tags, notes="", purpose="Does a thing.",
               schema_version=1, needs=None, best_for=""):
    needs = needs if needs is not None else []
    tags_yaml = "[]" if not tags else "[" + ", ".join(tags) + "]"
    needs_yaml = "[]" if not needs else "[" + ", ".join(needs) + "]"
    content = (
        f"schema-version: {schema_version}\n"
        f"purpose: {purpose}\n"
        f"best-for: {best_for}\n"
        f"needs: {needs_yaml}\n"
        "changes:\n"
        f"  tags: {tags_yaml}\n"
        f"  notes: {notes!r}\n"
    )
    (skill_dir / "metadata.yaml").write_text(content)


def write_skill_md(skill_dir: Path, allowed_tools=None):
    front = "---\n"
    front += "description: A test skill.\n"
    if allowed_tools is not None:
        if isinstance(allowed_tools, list):
            joined = ", ".join(allowed_tools)
            front += f"allowed-tools: [{joined}]\n"
        else:
            front += f"allowed-tools: {allowed_tools}\n"
    front += "---\n\n# Test Skill\n"
    (skill_dir / "SKILL.md").write_text(front)


class ContradictionLiveHookTests(unittest.TestCase):
    """Weighted arm 1: the owning plugin's hooks/hooks.json (cerberus-shaped)."""

    def test_declared_hook_with_none_tags_is_self_asserted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root, plugin="cerberuslike")
            hooks_dir = skill_dir.parent.parent / "hooks"
            hooks_dir.mkdir(parents=True)
            (hooks_dir / "hooks.json").write_text(
                '{"hooks": {"PostToolUse": [{"matcher": "Edit|Write|MultiEdit", '
                '"hooks": [{"type": "command", "command": "python3 on-skill-edit.py"}]}]}}'
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)
            self.assertIn(str(skill_dir), r.stdout)
            self.assertIn("hook", r.stdout)

    def test_declared_hook_with_matching_tag_is_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root, plugin="cerberuslike2")
            hooks_dir = skill_dir.parent.parent / "hooks"
            hooks_dir.mkdir(parents=True)
            (hooks_dir / "hooks.json").write_text(
                '{"hooks": {"PostToolUse": [{"matcher": "Edit", '
                '"hooks": [{"type": "command", "command": "x"}]}]}}'
            )
            write_meta(skill_dir, tags=["files"], notes="edits files via hook")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("ok", r.stdout)

    def test_empty_hooks_json_no_declared_hooks_is_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root, plugin="nohooksreally")
            hooks_dir = skill_dir.parent.parent / "hooks"
            hooks_dir.mkdir(parents=True)
            (hooks_dir / "hooks.json").write_text('{"hooks": {}}')
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_no_hooks_json_at_all_is_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root, plugin="plainplugin")
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)


class RealScoutSkillAcceptanceTest(unittest.TestCase):
    """Pins the acceptance fixture from the spec/plan: scout's own real skill
    directory (tags: [], owning plugin has a live PostToolUse hook) must report
    self-asserted, never FAIL. Synthetic fixtures above cover the same code path
    in isolation, but only this test runs against the actual committed
    plugins/scout/skills/scout — so a future edit to scout's own metadata.yaml
    or hooks.json that regresses the hook -> self-asserted downgrade is caught
    automatically instead of relying on manual verification."""

    def test_real_scout_skill_is_self_asserted_not_fail(self):
        repo_root = Path(__file__).resolve().parent.parent
        skill_dir = repo_root / "plugins" / "scout" / "skills" / "scout"
        self.assertTrue(
            skill_dir.is_dir(),
            f"expected real fixture at {skill_dir} — repo layout changed?",
        )

        r = run(skill_dir)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("self-asserted:", r.stdout)
        self.assertIn(str(skill_dir), r.stdout)
        self.assertIn("hook", r.stdout)


class ContradictionScriptScanTests(unittest.TestCase):
    """Weighted arm 2: recursive scan over skill root + references/ + scripts/,
    matching the REAL shapes (report.py at root, build.sh in references/)."""

    def test_mutating_script_in_skill_root_is_self_asserted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            (skill_dir / "report.sh").write_text(
                "#!/usr/bin/env bash\n"
                "curl -s https://example.com/report | tee out.txt\n"
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)
            self.assertIn("mutating pattern", r.stdout)

    def test_mutating_script_in_references_subdir_is_self_asserted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            refs = skill_dir / "references"
            refs.mkdir()
            (refs / "build.sh").write_text(
                "#!/usr/bin/env bash\n"
                "set -euo pipefail\n"
                "git commit -am 'auto build'\n"
                "git push origin main\n"
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)
            self.assertIn("mutating pattern", r.stdout)

    def test_scripts_only_glob_would_miss_this_root_script_but_ours_catches_it(self):
        # Regression guard for the CRITICAL scope note: no scripts/ dir exists
        # at all here, script sits at skill root (diogenes/fe-check/sf-run shape).
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root, name="fe-check")
            self.assertFalse((skill_dir / "scripts").exists())
            (skill_dir / "fe-check.sh").write_text(
                "#!/usr/bin/env bash\nrm -rf ./dist\n"
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)
            self.assertIn("mutating pattern", r.stdout)

    def test_mutating_script_under_scripts_subdir_also_caught(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            scripts = skill_dir / "scripts"
            scripts.mkdir()
            (scripts / "cleanup.py") .write_text(
                "import os\nos.system('rm -rf /tmp/foo')\n"
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)
            self.assertIn("mutating pattern", r.stdout)

    def test_scout_ignore_suppresses_false_positive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            (skill_dir / "helper.sh").write_text(
                "#!/usr/bin/env bash\n"
                "curl -s https://example.com/health  # scout-ignore\n"
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_mutating_mention_inside_comment_only_is_not_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            (skill_dir / "notes.py") .write_text(
                "# This script used to call curl but no longer does.\n"
                "print('hello')\n"
            )
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_no_scripts_no_grants_none_tags_is_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("ok", r.stdout)


class SelfAssertedTests(unittest.TestCase):
    def test_money_tag_present_is_self_asserted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=["money"], notes="processes a payment")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)

    def test_org_tag_present_is_self_asserted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=["org"], notes="deploys metadata")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)

    def test_unknown_tool_in_allowed_tools_is_self_asserted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir, allowed_tools=["FutureTool"])

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)
            self.assertIn("FutureTool", r.stdout)

    def test_broad_bash_grant_with_none_tags_is_self_asserted_not_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir, allowed_tools=["Bash"])

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("self-asserted:", r.stdout)

    def test_write_grant_with_none_tags_fails(self):
        # Future-facing: zero skills declare allowed-tools today, but this row
        # of the tool->tag map (Write is unambiguously mutating -> 'files')
        # must still enforce a clear contradiction once any skill does.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir, allowed_tools=["Write"])

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("Write", r.stderr)

    def test_webfetch_grant_with_none_tags_fails(self):
        # Network rows (WebFetch/WebSearch) are live members of the kept
        # allowed-tools FAIL arm -- NOT pruned, NOT downgraded.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[])
            write_skill_md(skill_dir, allowed_tools=["WebFetch"])

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("WebFetch", r.stderr)


class MetadataValidityTests(unittest.TestCase):
    def test_missing_metadata_yaml_fails_naming_skill(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root, name="nosidecar")
            write_skill_md(skill_dir)
            # deliberately no metadata.yaml written

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn(str(skill_dir), r.stderr)
            self.assertIn("missing metadata.yaml", r.stderr)

    def test_blank_purpose_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[], purpose="   ")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("purpose", r.stderr)

    def test_other_tag_without_notes_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=["other"], notes="")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("notes", r.stderr)

    def test_other_tag_with_notes_is_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=["other"], notes="rotates local cache files")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_unknown_changes_tag_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=["nonsense_tag"])
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("unknown tag", r.stderr)

    def test_bad_schema_version_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=[], schema_version=2)
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("schema-version", r.stderr)

    def test_missing_schema_version_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            (skill_dir / "metadata.yaml").write_text(
                "purpose: Does a thing.\n"
                "best-for: \n"
                "needs: []\n"
                "changes:\n"
                "  tags: []\n"
                "  notes: \"\"\n"
            )
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("schema-version", r.stderr)

    def test_fully_valid_sidecar_is_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill_dir = make_skill(root)
            write_meta(skill_dir, tags=["files"], notes="writes local files")
            write_skill_md(skill_dir)

            r = run(skill_dir)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("ok", r.stdout)


if __name__ == "__main__":
    unittest.main()
