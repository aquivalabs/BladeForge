#!/usr/bin/env python3
"""Unit tests for docs-check.py.

Runs green under Python 3.9 (the target-project floor) with one version-
guarded exception. docs-check.py has a hyphen in its filename, so it is
loaded with importlib.util.spec_from_file_location rather than `import`.

Three tests near the bottom (InvocationLineIdentityTest, StarterConfig
VacuityTest, SkillBodyHonestyTest) read sibling artifacts rather than build
their own: the templates and the skill's sources file. They carry no skip
guard on purpose — a missing artifact must fail loudly, not pass quietly.
"""
import ast
import contextlib
import importlib.util
import io
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_MODULE_PATH = _HERE / "docs-check.py"
_ALLOWLIST_PATH = _HERE / "import-allowlist.txt"


def _load_docs_check():
    spec = importlib.util.spec_from_file_location("docs_check", _MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


docs_check = _load_docs_check()

sys.path.insert(0, str(_HERE / "fixtures"))
import scratch_repo  # noqa: E402


def _read_allowlist():
    return {
        line.strip() for line in _ALLOWLIST_PATH.read_text().splitlines() if line.strip()
    }


def _finding_texts(findings):
    return [str(f) for f in findings]


# ---------------------------------------------------------------------------
# One test per shipped fixture
# ---------------------------------------------------------------------------

class WellFormedFixtureTest(unittest.TestCase):
    def test_zero_findings(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_well_formed_tree(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, [])
            self.assertEqual(findings, [], _finding_texts(findings))


class MissingIndexRowFixtureTest(unittest.TestCase):
    def test_orphan_file_reported_as_not_linked_from_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_missing_index_row(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, [])
            self.assertTrue(any(
                f.job == "structure"
                and "0002-orphan.md" in f.path
                and "not linked from index" in f.message
                for f in findings
            ), _finding_texts(findings))


class MissingRequiredFieldFixtureTest(unittest.TestCase):
    def test_missing_consequences_heading_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_missing_required_field(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, [])
            self.assertTrue(any(
                f.job == "structure"
                and "0001-example.md" in f.path
                and "Consequences" in f.message
                for f in findings
            ), _finding_texts(findings))


class DeadLinkFixtureTest(unittest.TestCase):
    def test_dead_relative_link_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_dead_link(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, [])
            self.assertTrue(any(
                f.job == "structure"
                and "widget-loader.md" in f.path
                and "dead relative link" in f.message
                for f in findings
            ), _finding_texts(findings))


class UnpairedChangeFixtureTest(unittest.TestCase):
    def test_changed_source_without_doc_change_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_unpaired_change(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, ["src/widget/loader.py"])
            self.assertEqual(len(findings), 1, _finding_texts(findings))
            self.assertEqual(findings[0].job, "paired-docs")
            self.assertIn("widget-loader", findings[0].message)


class ExemptedPairFixtureTest(unittest.TestCase):
    def test_exempt_mechanism_produces_no_finding_and_prints_exemption(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_exempted_pair(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                findings = docs_check.run_all(config, repo, ["src/widget/loader.py"])
            self.assertEqual(findings, [], _finding_texts(findings))
            printed = buffer.getvalue()
            self.assertIn("widget-loader", printed)
            self.assertIn("widget rewrite tracked in a separate migration doc", printed)


class FrozenLiveBoundaryFixtureTest(unittest.TestCase):
    def test_only_live_layer_paths_are_named(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_frozen_live_boundary(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, [])
            self.assertTrue(findings, "expected the check to fail")

            texts = _finding_texts(findings)
            self.assertTrue(any("doc-with-dead-link.md" in t for t in texts), texts)
            self.assertTrue(any("docs/mechanisms/README.md" in t for t in texts), texts)

            for text in texts:
                self.assertNotIn("frozen", text.lower())
                self.assertNotIn("docs/specs", text)


class DanglingMechanismFixtureTest(unittest.TestCase):
    def test_unreachable_doc_fails_even_with_a_quiet_diff(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_dangling_mechanism(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.run_all(config, repo, [])
            self.assertEqual(len(findings), 1, _finding_texts(findings))
            self.assertEqual(findings[0].job, "declared-docs-resolve")
            self.assertIn("missing-doc.md", findings[0].message)


class PrefixCollisionFixtureTest(unittest.TestCase):
    def test_both_colliding_roots_are_named(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_prefix_collision(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.config_sanity(config, repo, [])
            self.assertEqual(len(findings), 1, _finding_texts(findings))
            message = findings[0].message
            self.assertIn("docs/", message)
            self.assertIn("docs/adr/", message)


class SurfaceRulesViolationFixtureTest(unittest.TestCase):
    def test_declared_path_over_cap_flagged_undeclared_path_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_surface_rules_violation(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.surface_rules(config, repo, [])
            self.assertEqual(len(findings), 1, _finding_texts(findings))
            self.assertIn("AGENTS.md", findings[0].path)
            self.assertTrue(all("random-notes.md" not in f.path for f in findings))


class SchemaSkewFixtureTest(unittest.TestCase):
    def test_exact_skew_message_with_real_mechanisms(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_schema_skew(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.config_sanity(config, repo, [])
            messages = [f.message for f in findings]
            self.assertIn(
                "config schema version mismatch: config seeded against 0, schema is now 1",
                messages,
            )

    def test_absent_schema_version_reports_literal_absent(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_schema_skew_absent(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            findings = docs_check.config_sanity(config, repo, [])
            messages = [f.message for f in findings]
            self.assertIn(
                "config schema version mismatch: config seeded against absent, schema is now 1",
                messages,
            )


class AcknowledgedEmptyFixtureTest(unittest.TestCase):
    def test_acknowledged_flag_suppresses_finding_and_is_named(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_acknowledged_empty(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                findings = docs_check.config_sanity(config, repo, [])
            self.assertEqual(findings, [], _finding_texts(findings))
            self.assertIn("acknowledgedEmptyMechanisms", buffer.getvalue())


# ---------------------------------------------------------------------------
# Diff-scoped end-to-end pair, in a scratch repo (not a bundled fixture)
# ---------------------------------------------------------------------------

class DiffScopedEndToEndTest(unittest.TestCase):
    def test_fails_then_passes_across_the_same_base(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_basic_repo(Path(tmp) / "repo")
            config = docs_check.load_config(repo)
            base = docs_check.resolve_base(repo, config)

            (repo / "src" / "widget" / "loader.py").write_text("def load():\n    return False\n")
            scratch_repo._commit_all(repo, "change loader without touching its doc")

            changed = docs_check.compute_changed_paths(repo, base)
            findings = docs_check.run_all(config, repo, changed)
            self.assertTrue(any(f.job == "paired-docs" for f in findings), _finding_texts(findings))

            (repo / "docs" / "mechanisms" / "widget-loader.md").write_text(
                "# Widget loader\n\nLoads the demo widget on startup. Updated.\n"
            )
            scratch_repo._commit_all(repo, "update the doc in the same range")

            changed_again = docs_check.compute_changed_paths(repo, base)
            findings_again = docs_check.run_all(config, repo, changed_again)
            self.assertFalse(
                any(f.job == "paired-docs" for f in findings_again), _finding_texts(findings_again),
            )


# ---------------------------------------------------------------------------
# Dedicated no-remote base-resolution test
# ---------------------------------------------------------------------------

class BaseResolutionNoRemoteTest(unittest.TestCase):
    def test_falls_back_to_root_commit_and_diff_lists_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_basic_repo(Path(tmp) / "repo")

            verify = subprocess.run(
                ["git", "rev-parse", "--verify", "-q", "origin/main"],
                cwd=str(repo), capture_output=True, text=True,
            )
            self.assertNotEqual(verify.returncode, 0, "fixture repo must have no origin/main")

            root_commits = subprocess.run(
                ["git", "rev-list", "--max-parents=0", "HEAD"],
                cwd=str(repo), capture_output=True, text=True, check=True,
            )
            expected_root = root_commits.stdout.strip().splitlines()[-1]

            base = docs_check.resolve_base(repo, {})
            self.assertEqual(base, expected_root)

            (repo / "docs" / "mechanisms" / "widget-loader.md").write_text(
                "# Widget loader\n\nUpdated.\n"
            )
            scratch_repo._commit_all(repo, "touch the doc")

            changed = docs_check.compute_changed_paths(repo, base)
            self.assertIn("docs/mechanisms/widget-loader.md", changed)

    def test_config_base_override_wins(self):
        """An override is honoured, and resolved to the commit it names.

        The resolve step is what makes the override safe: a value that names no commit
        is rejected rather than handed to git as a positional argument.
        """
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_basic_repo(Path(tmp) / "repo")
            base = docs_check.resolve_base(repo, {"base": "HEAD"})
            head = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=str(repo), capture_output=True, text=True, check=True,
            ).stdout.strip()
            self.assertEqual(base, head)

    def test_option_shaped_base_is_rejected(self):
        """A config `base` that looks like a git flag must never reach git.

        `git diff --name-only <base> HEAD` takes base positionally, so `--output=<path>`
        would be read as a flag and write a file. Reproduced before the guard existed.
        """
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_basic_repo(Path(tmp) / "repo")
            victim = Path(tmp) / "written-by-injection"
            with self.assertRaises(SystemExit) as caught:
                docs_check.resolve_base(repo, {"base": "--output={}".format(victim)})
            self.assertIn("may not start with", str(caught.exception))
            self.assertFalse(victim.exists())

    def test_links_the_check_deliberately_ignores(self):
        """External, mail and fragment-only links are not resolved, so they never go dead.

        Asserted here rather than by reading the code, because the whole licence to block on
        link health rests on the check never touching the network.
        """
        with tempfile.TemporaryDirectory() as tmp:
            doc = Path(tmp) / "page.md"
            doc.write_text(
                "[web](https://example.invalid/gone)\n"
                "[mail](mailto:nobody@example.invalid)\n"
                "[anchor](#a-heading-here)\n"
                "[real](neighbour.md)\n"
            )
            for ignored in ("https://example.invalid/gone", "mailto:nobody@example.invalid", "#a-heading-here"):
                self.assertIsNone(
                    docs_check.resolve_relative_link(doc, ignored)[0],
                    "{!r} should not be resolved at all".format(ignored),
                )
            self.assertIsNotNone(
                docs_check.resolve_relative_link(doc, "neighbour.md")[0],
                "a genuine relative link stopped resolving",
            )
            dead = docs_check.find_dead_links(doc)
            self.assertEqual(
                [d for d in dead if "example.invalid" in str(d) or "#" in str(d)], [],
                "an ignored link was reported dead",
            )
            self.assertTrue(
                any("neighbour.md" in str(d) for d in dead),
                "the one genuinely missing target was not reported",
            )

    def test_bang_exclusion_narrows_a_mechanism(self):
        """A `!`-prefixed pattern removes a path the includes would otherwise claim."""
        matches = docs_check._mechanism_matches(
            ["src/widget/*.py", "!src/widget/generated.py"], ["src/widget/generated.py"]
        )
        self.assertFalse(matches, "an excluded path still matched")
        self.assertTrue(
            docs_check._mechanism_matches(
                ["src/widget/*.py", "!src/widget/generated.py"], ["src/widget/loader.py"]
            ),
            "exclusion swallowed a path it should not have",
        )

    def test_every_matching_mechanism_fires_not_just_the_last(self):
        """The spec's deliberate divergence from CODEOWNERS, which is last-match-wins.

        A file claimed by two mechanisms obliges both docs. Under last-match-wins a shared
        seam would silently lose coverage — and a seam used in many places is the spec's own
        motivating example.
        """
        config = {"mechanisms": [
            {"id": "first", "paths": ["src/shared/*.py"], "doc": "docs/mechanisms/first.md"},
            {"id": "second", "paths": ["src/shared/*.py"], "doc": "docs/mechanisms/second.md"},
        ]}
        findings = docs_check.paired_docs(config, Path("."), ["src/shared/seam.py"])
        ids = " ".join(str(f) for f in findings)
        self.assertIn("first", ids)
        self.assertIn("second", ids)
        self.assertEqual(len(findings), 2, "only one mechanism fired; last-match-wins crept in")

    def test_surface_rule_glob_cannot_escape_the_repo(self):
        """A project-supplied glob must not turn the check into a reader of the host.

        `surfaceRules.paths` is config, so `../../..` would otherwise walk out of the repo
        and report on files that are none of the check's business.
        """
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_basic_repo(Path(tmp) / "repo")
            outsider = Path(tmp) / "outside.md"
            outsider.write_text("one\ntwo\nthree\n")
            findings = docs_check.surface_rules(
                {"surfaceRules": {"lineCap": 1, "paths": ["../*.md"]}}, repo, []
            )
            self.assertEqual(
                [f for f in findings if "outside.md" in str(f)], [],
                "a glob climbed out of the repo root",
            )

    def test_unresolvable_base_is_rejected(self):
        """A base naming no commit fails loudly instead of producing a wrong diff."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = scratch_repo.build_basic_repo(Path(tmp) / "repo")
            with self.assertRaises(SystemExit) as caught:
                docs_check.resolve_base(repo, {"base": "no-such-ref-anywhere"})
            self.assertIn("does not resolve to a commit", str(caught.exception))


# ---------------------------------------------------------------------------
# ast import allow-list, plus the version-guarded stdlib_module_names check
# ---------------------------------------------------------------------------

class ImportAllowlistTest(unittest.TestCase):
    def test_every_top_level_import_is_allowlisted(self):
        tree = ast.parse(_MODULE_PATH.read_text())
        modules = set()
        for node in tree.body:
            if isinstance(node, ast.Import):
                for alias in node.names:
                    modules.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    modules.add(node.module.split(".")[0])

        self.assertTrue(modules, "expected at least one top-level import")
        allowlist = _read_allowlist()
        self.assertTrue(
            modules.issubset(allowlist),
            "not in import-allowlist.txt: {}".format(modules - allowlist),
        )

    def test_forbidden_apis_absent_from_source_text(self):
        source = _MODULE_PATH.read_text()
        for forbidden in ("urllib", "requests", "http", "stdlib_module_names"):
            self.assertNotIn(forbidden, source)


class StdlibModuleNamesCompanionTest(unittest.TestCase):
    @unittest.skipUnless(
        sys.version_info >= (3, 10),
        "sys.stdlib_module_names is a 3.10+ API — this is the reason docs-check-tests.yml runs on 3.12",
    )
    def test_allowlist_is_a_subset_of_the_real_stdlib(self):
        allowlist = _read_allowlist()
        self.assertTrue(allowlist.issubset(sys.stdlib_module_names))


# ---------------------------------------------------------------------------
# Cross-artifact tests — the hook template and the CI workflow must invoke the check
# with a byte-identical line, or the two sites can disagree on the same branch.
# ---------------------------------------------------------------------------

_INVOCATION_LINE_RE = re.compile(r"^.*python3 scripts/docs-check\.py.*$", re.MULTILINE)


def _extract_invocation_line(text):
    match = _INVOCATION_LINE_RE.search(text)
    if not match:
        raise AssertionError("no 'python3 scripts/docs-check.py' invocation line found")
    return match.group(0).strip()


class InvocationLineIdentityTest(unittest.TestCase):
    """Criterion 34. Reads plugins/docs/templates/pre-push-hook and
    plugins/docs/templates/docs-check.yml, owned by a parallel task."""

    def test_hook_and_ci_invocation_lines_are_byte_identical(self):
        hook_text = (_HERE / "templates" / "pre-push-hook").read_text()
        ci_text = (_HERE / "templates" / "docs-check.yml").read_text()
        self.assertEqual(
            _extract_invocation_line(hook_text),
            _extract_invocation_line(ci_text),
        )


class StarterConfigVacuityTest(unittest.TestCase):
    """Criterion 25. Reads plugins/docs/templates/starter.docs.config.json,
    owned by a parallel task."""

    def test_starter_config_yields_no_mechanisms_declared(self):
        starter_path = _HERE / "templates" / "starter.docs.config.json"
        starter_config = json.loads(starter_path.read_text())

        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            claude_dir = repo_root / ".claude"
            claude_dir.mkdir(parents=True)
            (claude_dir / "docs.config.json").write_text(json.dumps(starter_config))
            (claude_dir / "docs.config.schema.json").write_text(
                json.dumps({"version": starter_config.get("schemaVersion", "1")})
            )
            findings = docs_check.run_all(starter_config, repo_root, [])

        self.assertTrue(
            any("no mechanisms declared" in f.message for f in findings),
            _finding_texts(findings),
        )


class SkillBodyHonestyTest(unittest.TestCase):
    """Criterion 19. Reads this repo's own plugins/docs/skills/standard/
    SKILL.md and references/sources.md, the real build artifacts — not
    fixtures. references/sources.md is owned by a parallel task."""

    def test_skill_body_is_short_link_clean_and_anchors_resolve(self):
        skill_path = _HERE / "skills" / "standard" / "SKILL.md"
        text = skill_path.read_text()
        lines = text.splitlines()
        self.assertLess(len(lines), 200, "SKILL.md must be under 200 lines")

        for line in lines:
            for match in re.finditer(r"https?://\S+", line):
                preceding = line[max(0, match.start() - 2):match.start()]
                self.assertEqual(
                    preceding, "](",
                    "bare URL outside markdown link syntax: {}".format(match.group(0)),
                )

        sources_path = _HERE / "skills" / "standard" / "references" / "sources.md"
        sources_headings = {
            docs_check.slugify_heading(heading)
            for heading in docs_check._extract_heading_texts(sources_path.read_text())
        }

        for target in docs_check._extract_links(text):
            path_part, fragment = docs_check._split_fragment(target)
            if fragment and "sources.md" in path_part:
                self.assertIn(
                    fragment, sources_headings,
                    "anchor #{} does not resolve to a heading in sources.md".format(fragment),
                )


if __name__ == "__main__":
    unittest.main()
