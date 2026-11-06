#!/usr/bin/env python3
"""Unit tests for affected_plugins.py: which changed paths bump a plugin version. RMA-415."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from affected_plugins import affected  # noqa: E402


class AffectedPlugins(unittest.TestCase):
    def test_payload_changes_bump_their_plugin(self):
        paths = [
            "plugins/whose-turn/skills/whose-turn/SKILL.md",
            "plugins/whose-turn/skills/whose-turn/references/capabilities.md",
            "plugins/whose-turn/bin/mcp.mjs",
            "plugins/cicero/hooks/session-start.sh",
            "plugins/whose-turn/monitor-version",
        ]
        self.assertEqual(affected(paths), ["cicero", "whose-turn"])

    def test_tests_evals_metadata_and_managed_files_bump_nothing(self):
        paths = [
            "plugins/whose-turn/bin/mcp.test.mjs",
            "plugins/scout/tests/plugins-installed-check.test.mjs",
            "plugins/critique/tests/schema-composability.test.py",
            "plugins/whose-turn/skills/whose-turn/evals/result.json",
            "plugins/whose-turn/skills/whose-turn/metadata.yaml",
            "plugins/whose-turn/.claude-plugin/plugin.json",
            "plugins/scout/skills/scout/catalog.json",
            "scripts/gen_catalog.py",
            "README.md",
        ]
        self.assertEqual(affected(paths), [])

    def test_one_payload_path_among_test_paths_still_bumps(self):
        paths = ["plugins/whose-turn/bin/mcp.test.mjs", "plugins/whose-turn/bin/lib.mjs"]
        self.assertEqual(affected(paths), ["whose-turn"])


if __name__ == "__main__":
    unittest.main()
