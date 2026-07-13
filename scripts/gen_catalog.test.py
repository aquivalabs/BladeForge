#!/usr/bin/env python3
"""Unit tests for gen_catalog.py, using fixture marketplace trees in tempfile
dirs. Never touches the real repo tree (which has no metadata.yaml yet and
would fail loudly by design)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import gen_catalog  # noqa: E402


def write_marketplace(root: Path, marketplace_name: str = "fixture-market") -> None:
    manifest_dir = root / ".claude-plugin"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "marketplace.json").write_text(json.dumps({
        "name": marketplace_name,
        "owner": {"name": "Fixture Owner"},
        "plugins": [],
    }))


def write_plugin(root: Path, domain: str, version: str = "1.0.0", plugin_name=None) -> Path:
    """Create plugins/<domain>/.claude-plugin/plugin.json. plugin_name defaults
    to domain; pass a different value to simulate folder/name divergence."""
    plugin_dir = root / "plugins" / domain
    manifest_dir = plugin_dir / ".claude-plugin"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "plugin.json").write_text(json.dumps({
        "name": plugin_name if plugin_name is not None else domain,
        "description": f"{domain} fixture plugin.",
        "version": version,
        "author": {"name": "Fixture Owner"},
    }))
    return plugin_dir


def write_skill(
    plugin_dir: Path,
    skill_name: str,
    description: str = "Do the fixture thing.",
    metadata: dict = None,
    skip_metadata: bool = False,
) -> Path:
    skill_dir = plugin_dir / "skills" / skill_name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        "---\n"
        f"description: {json.dumps(description)}\n"
        "---\n\n"
        f"# {skill_name}\n\nBody text.\n"
    )
    if not skip_metadata:
        data = metadata if metadata is not None else {
            "schema-version": 1,
            "purpose": f"Fixture purpose for {skill_name}.",
            "best-for": "Fixture adoption fit.",
            "needs": [],
            "changes": {"tags": [], "notes": ""},
        }
        (skill_dir / "metadata.yaml").write_text(_to_yaml(data))
    return skill_dir


def _to_yaml(data: dict) -> str:
    import yaml
    return yaml.safe_dump(data, sort_keys=False)


def write_hooks_json(plugin_dir: Path, events: list) -> None:
    """Write a well-formed hooks.json declaring the given event names."""
    hooks_dir = plugin_dir / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    (hooks_dir / "hooks.json").write_text(json.dumps({
        "hooks": {event: [] for event in events},
    }))


def write_malformed_hooks_json(plugin_dir: Path) -> None:
    """Write an unparseable hooks.json (invalid JSON)."""
    hooks_dir = plugin_dir / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    (hooks_dir / "hooks.json").write_text("{ this is not valid json ")


class BuildsCorrectCatalog(unittest.TestCase):
    def test_multiple_skills_multiple_plugins(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root, "fixture-market")

            alpha_dir = write_plugin(root, "alpha", version="2.3.1")
            write_skill(alpha_dir, "one", description="Alpha one description, VERBATIM please.")
            write_skill(alpha_dir, "two", description="Alpha two description.")

            beta_dir = write_plugin(root, "beta", version="0.9.0")
            write_skill(beta_dir, "three", description="Beta three description.")

            out_path = root / "out" / "catalog.json"
            catalog = gen_catalog.generate_catalog(root)
            gen_catalog.write_catalog(catalog, out_path)

            self.assertTrue(out_path.is_file())
            on_disk = json.loads(out_path.read_text())
            self.assertEqual(on_disk, catalog)

            self.assertEqual(catalog["schema-version"], 1)
            self.assertEqual(catalog["marketplace"], "fixture-market")
            self.assertRegex(catalog["generated"], r"^\d{4}-\d{2}-\d{2}$")

            skills = catalog["skills"]
            self.assertEqual(len(skills), 3)

            by_name = {s["name"]: s for s in skills}
            self.assertEqual(set(by_name), {"alpha:one", "alpha:two", "beta:three"})

            one = by_name["alpha:one"]
            self.assertEqual(one["activates-when"], "Alpha one description, VERBATIM please.")
            self.assertEqual(one["plugin"], "alpha")
            self.assertEqual(one["plugin-version"], "2.3.1")
            self.assertEqual(one["purpose"], "Fixture purpose for one.")

            three = by_name["beta:three"]
            self.assertEqual(three["activates-when"], "Beta three description.")
            self.assertEqual(three["plugin"], "beta")
            self.assertEqual(three["plugin-version"], "0.9.0")

    def test_needs_and_changes_round_trip_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "gamma")
            write_skill(
                plugin_dir, "solo",
                metadata={
                    "schema-version": 1,
                    "purpose": "Solo purpose.",
                    "best-for": "Solo fit.",
                    "needs": ["alpha:one", "beta:three"],
                    "changes": {"tags": ["git", "network"], "notes": "Pushes and fetches."},
                },
            )

            catalog = gen_catalog.generate_catalog(root)
            entry = catalog["skills"][0]
            self.assertEqual(entry["needs"], ["alpha:one", "beta:three"])
            self.assertEqual(entry["changes"], {"tags": ["git", "network"], "notes": "Pushes and fetches."})

    def test_description_with_colon_space_is_tolerated_not_crashed(self):
        # Regression: a colon-space inside the (unquoted) description value
        # makes it invalid as a strict-YAML mapping value ("mapping values
        # are not allowed here"), but Claude Code's own frontmatter reader
        # is lenient about this — the generator must not be stricter than
        # the platform. See plugins/frontend-react/skills/component-placement.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "delta")
            skill_dir = plugin_dir / "skills" / "colon-desc"
            skill_dir.mkdir(parents=True, exist_ok=True)
            description = "Framework-agnostic: governs X. Activate whenever about to do Y."
            (skill_dir / "SKILL.md").write_text(
                "---\n"
                f"description: {description}\n"
                "---\n\n"
                "# colon-desc\n\nBody text.\n"
            )
            (skill_dir / "metadata.yaml").write_text(_to_yaml({
                "schema-version": 1,
                "purpose": "Fixture purpose for colon-desc.",
                "best-for": "Fixture adoption fit.",
                "needs": [],
                "changes": {"tags": [], "notes": ""},
            }))

            catalog = gen_catalog.generate_catalog(root)
            entry = catalog["skills"][0]
            self.assertEqual(entry["name"], "delta:colon-desc")
            self.assertEqual(entry["activates-when"], description)


class FailsLoudlyOnMissingMetadata(unittest.TestCase):
    def test_missing_metadata_yaml_exits_nonzero_and_names_skill(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "alpha")
            write_skill(plugin_dir, "good-one")
            write_skill(plugin_dir, "bad-one", skip_metadata=True)

            out_path = root / "out" / "catalog.json"
            with self.assertRaises(SystemExit) as ctx:
                catalog = gen_catalog.generate_catalog(root)
                gen_catalog.write_catalog(catalog, out_path)

            message = str(ctx.exception)
            self.assertIn("alpha:bad-one", message)
            self.assertIn("metadata.yaml", message)
            self.assertFalse(out_path.exists(), "no partial catalog should be written on failure")

    def test_no_partial_catalog_even_when_failure_is_not_first_skill(self):
        # Ensure failure partway through the walk still leaves no file behind,
        # since generate_catalog only returns (and the caller only writes)
        # after the full walk succeeds.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "alpha")
            write_skill(plugin_dir, "aaa-first")
            write_skill(plugin_dir, "zzz-last", skip_metadata=True)

            out_path = root / "catalog.json"
            with self.assertRaises(SystemExit):
                catalog = gen_catalog.generate_catalog(root)
                gen_catalog.write_catalog(catalog, out_path)
            self.assertFalse(out_path.exists())


class FailsLoudlyOnPluginNameDivergence(unittest.TestCase):
    def test_folder_name_not_equal_plugin_json_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            # Folder is "alpha" but plugin.json declares name "not-alpha".
            plugin_dir = write_plugin(root, "alpha", plugin_name="not-alpha")
            write_skill(plugin_dir, "one")

            with self.assertRaises(SystemExit) as ctx:
                gen_catalog.generate_catalog(root)

            message = str(ctx.exception)
            self.assertIn("alpha", message)
            self.assertIn("not-alpha", message)


class HookEnumeration(unittest.TestCase):
    def test_events_listed_for_every_skill_of_the_plugin(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "alpha")
            write_hooks_json(plugin_dir, ["PostToolUse", "SessionStart"])
            write_skill(plugin_dir, "one")
            write_skill(plugin_dir, "two")

            catalog = gen_catalog.generate_catalog(root)
            by_name = {s["name"]: s for s in catalog["skills"]}

            self.assertEqual(by_name["alpha:one"]["hooks"], ["PostToolUse", "SessionStart"])
            self.assertEqual(by_name["alpha:two"]["hooks"], ["PostToolUse", "SessionStart"])

    def test_malformed_hooks_json_yields_present_sentinel_and_does_not_crash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "beta")
            write_malformed_hooks_json(plugin_dir)
            write_skill(plugin_dir, "solo")

            catalog = gen_catalog.generate_catalog(root)
            entry = catalog["skills"][0]

            self.assertEqual(len(entry["hooks"]), 1)
            self.assertIn("present", entry["hooks"][0])

    def test_no_hooks_json_yields_empty_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root)
            plugin_dir = write_plugin(root, "gamma")
            write_skill(plugin_dir, "solo")

            catalog = gen_catalog.generate_catalog(root)
            entry = catalog["skills"][0]

            self.assertEqual(entry["hooks"], [])


class CliBehavior(unittest.TestCase):
    def test_main_writes_to_custom_out_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_marketplace(root, "cli-market")
            plugin_dir = write_plugin(root, "solo-domain")
            write_skill(plugin_dir, "only-skill", description="CLI path description.")

            out_path = root / "nested" / "does" / "not" / "exist" / "catalog.json"
            old_argv = sys.argv
            try:
                sys.argv = [
                    "gen_catalog.py",
                    "--root", str(root),
                    "--out", str(out_path),
                ]
                gen_catalog.main()
            finally:
                sys.argv = old_argv

            self.assertTrue(out_path.is_file())
            data = json.loads(out_path.read_text())
            self.assertEqual(data["marketplace"], "cli-market")
            self.assertEqual(len(data["skills"]), 1)
            self.assertEqual(data["skills"][0]["activates-when"], "CLI path description.")


if __name__ == "__main__":
    unittest.main()
