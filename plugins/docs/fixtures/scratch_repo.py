#!/usr/bin/env python3
"""Shared scratch-git-repo builders for the docs-check test suite and for a
later task's derivation-procedure operator run.

Stdlib only, plain functions, no test-framework imports. Never adds an
`origin` remote: that is the measured shape the diff-base fallback exists
for — `git merge-base origin/main HEAD` exits 128 in a fresh `git init` repo
with no remote, which is exactly the shape every builder here produces.
"""
import json
import subprocess
from pathlib import Path


def _run_git(repo, *args):
    subprocess.run(
        ["git"] + list(args), cwd=str(repo), check=True,
        capture_output=True, text=True,
    )


def _init_repo(repo):
    repo.mkdir(parents=True, exist_ok=True)
    _run_git(repo, "init", "-q")
    _run_git(repo, "config", "user.name", "Docs Standard Fixture")
    _run_git(repo, "config", "user.email", "fixture@example.invalid")
    _run_git(repo, "config", "commit.gpgsign", "false")
    _run_git(repo, "config", "core.hooksPath", "/dev/null")


def _commit_all(repo, message):
    _run_git(repo, "add", "-A")
    _run_git(repo, "commit", "-q", "--no-verify", "-m", message)


_MECHANISM_README = (
    "# Mechanisms\n\n"
    "## Boundary\nLive mechanism docs for the demo product.\n\n"
    "## Shape\nOne worked example per mechanism.\n\n"
    "## Update trigger\nA change to the mechanism's source.\n\n"
    "## Exclusions\nDecisions go to docs/adr/ instead.\n\n"
    "## Acceptance criteria\nEvery mechanism in config names a doc that exists.\n"
)


def build_basic_repo(dest):
    """A `git init` repo, one commit, a config declaring one mechanism, that
    mechanism's doc, and the source file its `paths` match. Enough for the
    diff-scoped end-to-end test and the base-resolution test.

    Returns the repo path.
    """
    repo = Path(dest)
    _init_repo(repo)

    (repo / ".claude").mkdir(parents=True, exist_ok=True)
    config = {
        "$schema": "./docs.config.schema.json",
        "schemaVersion": "1",
        "layers": {"mechanisms": "docs/mechanisms/"},
        "acknowledgedEmptyMechanisms": False,
        "mechanisms": [
            {
                "id": "widget-loader",
                "paths": ["src/widget/**"],
                "doc": "docs/mechanisms/widget-loader.md",
            }
        ],
        "surfaceRules": {"lineCap": 200, "paths": []},
    }
    (repo / ".claude" / "docs.config.json").write_text(json.dumps(config, indent=2) + "\n")
    (repo / ".claude" / "docs.config.schema.json").write_text(
        json.dumps({"version": "1"}, indent=2) + "\n"
    )

    (repo / "docs" / "mechanisms").mkdir(parents=True, exist_ok=True)
    (repo / "docs" / "mechanisms" / "README.md").write_text(_MECHANISM_README)
    (repo / "docs" / "mechanisms" / "widget-loader.md").write_text(
        "# Widget loader\n\nLoads the demo widget on startup.\n"
    )

    (repo / "src" / "widget").mkdir(parents=True, exist_ok=True)
    (repo / "src" / "widget" / "loader.py").write_text("def load():\n    return True\n")

    _commit_all(repo, "seed basic fixture repo")
    return repo


def build_derivation_repo(dest):
    """The discriminating harness a later task's derivation procedure is
    verified against. Three repeated-path candidates, seeded so exactly one
    survives:

    - `shared/format_money` is imported by three otherwise-unrelated files
      across two directories (billing/, reporting/) — a real candidate under
      the three-file repeat rule, and the one that must survive.
    - `shared/legacy_parser` is imported by three other files, but it is
      already the sole subject of a committed docs/adr/0001-example.md in
      this same repo — the candidate the ADR rule must drop.
    - `shared/rare_util` is imported by only two files, one short of the
      three-file threshold — the candidate the count rule must exclude.

    Returns the repo path.
    """
    repo = Path(dest)
    _init_repo(repo)

    (repo / ".claude").mkdir(parents=True, exist_ok=True)
    config = {
        "$schema": "./docs.config.schema.json",
        "schemaVersion": "1",
        "layers": {
            "adr": {
                "root": "docs/adr/",
                "index": "README.md",
                "requiredFields": ["Status", "Context", "Decision", "Consequences"],
                "numbered": True,
            },
            "mechanisms": "docs/mechanisms/",
        },
        "acknowledgedEmptyMechanisms": True,
        "mechanisms": [],
        "surfaceRules": {"lineCap": 200, "paths": []},
    }
    (repo / ".claude" / "docs.config.json").write_text(json.dumps(config, indent=2) + "\n")
    (repo / ".claude" / "docs.config.schema.json").write_text(
        json.dumps({"version": "1"}, indent=2) + "\n"
    )

    (repo / "docs" / "adr").mkdir(parents=True, exist_ok=True)
    (repo / "docs" / "adr" / "README.md").write_text(
        "# ADRs\n\n"
        "## Boundary\nArchitecture decisions for the demo product.\n\n"
        "## Shape\nStatus, Context, Decision, Consequences.\n\n"
        "## Update trigger\nA new architectural decision.\n\n"
        "## Exclusions\nMechanism docs go to docs/mechanisms/ instead.\n\n"
        "## Acceptance criteria\nEach decision is numbered and indexed here.\n\n"
        "## Decisions\n\n- [0001 — Example decision](0001-example.md)\n"
    )
    (repo / "docs" / "adr" / "0001-example.md").write_text(
        "# 0001 — Example decision\n\n"
        "## Status\nAccepted\n\n"
        "## Context\n`shared/legacy_parser` is the parser every reader already imports.\n\n"
        "## Decision\nKeep `shared/legacy_parser` as the one shared parser; do not re-derive it.\n\n"
        "## Consequences\nA future derivation pass must not propose it again.\n"
    )

    (repo / "docs" / "mechanisms").mkdir(parents=True, exist_ok=True)
    (repo / "docs" / "mechanisms" / "README.md").write_text(_MECHANISM_README)

    (repo / "shared").mkdir(parents=True, exist_ok=True)
    (repo / "shared" / "format_money.py").write_text("def format_money(cents):\n    return cents / 100\n")
    (repo / "shared" / "legacy_parser.py").write_text("def parse(raw):\n    return raw\n")
    (repo / "shared" / "rare_util.py").write_text("def rare():\n    return 1\n")

    (repo / "billing").mkdir(parents=True, exist_ok=True)
    (repo / "reporting").mkdir(parents=True, exist_ok=True)
    (repo / "ingest").mkdir(parents=True, exist_ok=True)

    # Candidate 1 — survives: 3 files, 2 directories.
    (repo / "billing" / "invoice.py").write_text("from shared.format_money import format_money\n")
    (repo / "billing" / "receipt.py").write_text("from shared.format_money import format_money\n")
    (repo / "reporting" / "summary.py").write_text("from shared.format_money import format_money\n")

    # Candidate 2 — dropped by the ADR rule: 3 files, but already documented.
    (repo / "ingest" / "csv_reader.py").write_text("from shared.legacy_parser import parse\n")
    (repo / "ingest" / "xml_reader.py").write_text("from shared.legacy_parser import parse\n")
    (repo / "ingest" / "json_reader.py").write_text("from shared.legacy_parser import parse\n")

    # Candidate 3 — excluded by the count threshold: only 2 files.
    (repo / "ingest" / "rare_a.py").write_text("from shared.rare_util import rare\n")
    (repo / "ingest" / "rare_b.py").write_text("from shared.rare_util import rare\n")

    _commit_all(repo, "seed derivation fixture repo")
    return repo


# ---------------------------------------------------------------------------
# Static-tree scenario builders for docs-check.test.py's per-fixture tests.
#
# None of these need a git repo: run_all/config_sanity/surface_rules take a
# plain directory and an explicit changed_paths list, they never shell out to
# git themselves. Each builder below is deliberate damage applied on top of
# one of two shared bases:
#
# - `build_well_formed_tree` — the full config (adr + mechanisms + frozen
#   layers, one declared mechanism, surface rule on AGENTS.md) plus every doc
#   and source file it names. Six scenarios are this tree with at most one
#   thing broken.
# - `_config(...)` — a single config-shape constructor the other, smaller
#   scenarios build from, so the config's key set is written once.
# ---------------------------------------------------------------------------

def _write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def _write_text(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def _config(layers=None, mechanisms=None, acknowledged_empty=False,
            schema_version="1", line_cap=200, surface_paths=None):
    config = {"$schema": "./docs.config.schema.json"}
    if schema_version is not None:
        config["schemaVersion"] = schema_version
    config["layers"] = layers if layers is not None else {}
    config["acknowledgedEmptyMechanisms"] = acknowledged_empty
    config["mechanisms"] = mechanisms if mechanisms is not None else []
    config["surfaceRules"] = {
        "lineCap": line_cap,
        "paths": surface_paths if surface_paths is not None else [],
    }
    return config


_ADR_README = (
    "# ADR index\n\n"
    "## Boundary\nArchitecture decisions for the demo product.\n\n"
    "## Shape\nEach decision states Status, Context, Decision, Consequences.\n\n"
    "## Update trigger\nA new architectural decision.\n\n"
    "## Exclusions\nMechanism docs go to docs/mechanisms/ instead.\n\n"
    "## Acceptance criteria\nEvery decision is numbered and indexed here.\n\n"
    "## Decisions\n\n- [0001 — Example decision](0001-example.md)\n"
)

_ADR_0001 = (
    "# 0001 — Example decision\n\n"
    "## Status\nAccepted\n\n"
    "## Context\nThe demo product needed a place to record decisions.\n\n"
    "## Decision\nAdopt this documentation standard.\n\n"
    "## Consequences\nFuture decisions follow the same shape.\n"
)

_AGENTS_MD = (
    "# AGENTS\n\n"
    "A short contributor note for the demo product. Well under the line cap.\n"
)

_FROZEN_NOTE = (
    "# Frozen note\n\n"
    "A frozen record, correct as of its date. Its own links are never checked.\n"
)

_WIDGET_LOADER_DOC = "# Widget loader\n\nLoads the demo widget on startup.\n"

_WIDGET_LOADER_SRC = "def load():\n    return True\n"


def _well_formed_config():
    return _config(
        layers={
            "adr": {
                "root": "docs/adr/",
                "index": "README.md",
                "requiredFields": ["Status", "Context", "Decision", "Consequences"],
                "numbered": True,
            },
            "mechanisms": "docs/mechanisms/",
            "frozen": "docs/specs/",
        },
        mechanisms=[
            {
                "id": "widget-loader",
                "paths": ["src/widget/**"],
                "doc": "docs/mechanisms/widget-loader.md",
            }
        ],
        surface_paths=["AGENTS.md"],
    )


def build_well_formed_tree(dest, config=None):
    """The shared base for the well-formed fixture family: the full config
    (adr + mechanisms + frozen layers, one declared mechanism, a surface
    rule on AGENTS.md) plus every doc and source file it names, all
    internally consistent. Scenario builders below call this first and then
    break exactly one thing.

    Returns the repo path.
    """
    repo = Path(dest)
    _write_json(repo / ".claude" / "docs.config.json",
                config if config is not None else _well_formed_config())
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    _write_text(repo / "AGENTS.md", _AGENTS_MD)
    _write_text(repo / "docs" / "adr" / "README.md", _ADR_README)
    _write_text(repo / "docs" / "adr" / "0001-example.md", _ADR_0001)
    _write_text(repo / "docs" / "mechanisms" / "README.md", _MECHANISM_README)
    _write_text(repo / "docs" / "mechanisms" / "widget-loader.md", _WIDGET_LOADER_DOC)
    _write_text(repo / "docs" / "specs" / "frozen-note.md", _FROZEN_NOTE)
    _write_text(repo / "src" / "widget" / "loader.py", _WIDGET_LOADER_SRC)
    return repo


def build_missing_index_row(dest):
    """well-formed plus one extra ADR that the index never links to."""
    repo = build_well_formed_tree(dest)
    _write_text(repo / "docs" / "adr" / "0002-orphan.md", (
        "# 0002 — Orphan decision\n\n"
        "## Status\nAccepted\n\n"
        "## Context\nThis decision exists but is never linked from the ADR index.\n\n"
        "## Decision\nLeave it unlinked so the structure job's index-agreement check fires.\n\n"
        "## Consequences\nThe check reports it as not linked from the index.\n"
    ))
    return repo


def build_missing_required_field(dest):
    """well-formed with 0001-example.md's Consequences heading dropped."""
    repo = build_well_formed_tree(dest)
    _write_text(repo / "docs" / "adr" / "0001-example.md", (
        "# 0001 — Example decision\n\n"
        "## Status\nAccepted\n\n"
        "## Context\nThe demo product needed a place to record decisions.\n\n"
        "## Decision\nAdopt this documentation standard.\n"
    ))
    return repo


def build_dead_link(dest):
    """well-formed with a relative link in widget-loader.md that resolves
    to nothing."""
    repo = build_well_formed_tree(dest)
    _write_text(repo / "docs" / "mechanisms" / "widget-loader.md", (
        "# Widget loader\n\n"
        "Loads the demo widget on startup. See [the missing companion doc](./no-such-file.md)\n"
        "for details that were never actually written.\n"
    ))
    return repo


def build_unpaired_change(dest):
    """well-formed, unmodified — the damage here is the changed_paths list
    the test passes in, not the tree."""
    return build_well_formed_tree(dest)


def build_exempted_pair(dest):
    """well-formed with the declared mechanism marked exempt."""
    config = _well_formed_config()
    config["mechanisms"][0]["exempt"] = "widget rewrite tracked in a separate migration doc"
    return build_well_formed_tree(dest, config=config)


def build_frozen_live_boundary(dest):
    """A live mechanisms doc and a frozen spec doc, each with a dead link and
    each missing its layer README — only the live one may be reported."""
    repo = Path(dest)
    config = _config(
        layers={"mechanisms": "docs/mechanisms/", "frozen": "docs/specs/"},
        acknowledged_empty=True,
    )
    _write_json(repo / ".claude" / "docs.config.json", config)
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    _write_text(repo / "docs" / "mechanisms" / "doc-with-dead-link.md", (
        "# Live doc with a dead link\n\n"
        "This is the live layer. It links to [a page that was never written](./nowhere.md).\n\n"
        "The live layer root also has no README.md in this fixture, on purpose.\n"
    ))
    _write_text(repo / "docs" / "specs" / "frozen-doc.md", (
        "# Frozen doc with a dead link\n\n"
        "This is the frozen layer, correct as of its date. It links to\n"
        "[a page that never existed even then](./nowhere-frozen.md), and that is not\n"
        "this check's problem: the frozen layer is exempt from structure and from\n"
        "section-readmes. The frozen root also has no README.md in this fixture, on\n"
        "purpose — that must not be reported either.\n"
    ))
    return repo


def build_dangling_mechanism(dest):
    """A declared mechanism whose doc path resolves to nothing on disk."""
    repo = Path(dest)
    config = _config(
        layers={"mechanisms": "docs/mechanisms/"},
        mechanisms=[
            {
                "id": "ghost-mechanism",
                "paths": ["src/ghost/**"],
                "doc": "docs/mechanisms/missing-doc.md",
            }
        ],
    )
    _write_json(repo / ".claude" / "docs.config.json", config)
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    _write_text(repo / "docs" / "mechanisms" / "README.md", _MECHANISM_README)
    return repo


def build_prefix_collision(dest):
    """Two declared layer roots where one is a path prefix of the other."""
    repo = Path(dest)
    config = _config(
        layers={"docs": "docs/", "docsAdr": "docs/adr/"},
        acknowledged_empty=True,
    )
    _write_json(repo / ".claude" / "docs.config.json", config)
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    return repo


def _build_schema_skew_tree(dest, schema_version):
    repo = Path(dest)
    config = _config(
        layers={"mechanisms": "docs/mechanisms/"},
        mechanisms=[
            {
                "id": "widget-loader",
                "paths": ["src/widget/**"],
                "doc": "docs/mechanisms/widget-loader.md",
            }
        ],
        schema_version=schema_version,
    )
    _write_json(repo / ".claude" / "docs.config.json", config)
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    _write_text(repo / "docs" / "mechanisms" / "README.md", _MECHANISM_README)
    _write_text(repo / "docs" / "mechanisms" / "widget-loader.md", _WIDGET_LOADER_DOC)
    return repo


def build_schema_skew(dest):
    """Config seeded against schema version 0, schema now at 1."""
    return _build_schema_skew_tree(dest, "0")


def build_schema_skew_absent(dest):
    """Config with no schemaVersion key at all, schema now at 1."""
    return _build_schema_skew_tree(dest, None)


def build_surface_rules_violation(dest):
    """A declared surface path over its line cap, and an undeclared path
    that is just as long and must be ignored."""
    repo = Path(dest)
    config = _config(acknowledged_empty=True, line_cap=5, surface_paths=["AGENTS.md"])
    _write_json(repo / ".claude" / "docs.config.json", config)
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    _write_text(repo / "AGENTS.md", (
        "# AGENTS\n\n"
        "Line two.\nLine three.\nLine four.\nLine five.\nLine six.\nLine seven.\n"
        "Line eight — over the fixture's cap of 5 lines.\n"
    ))
    _write_text(repo / "random-notes.md", (
        "# Random notes\n\n"
        "Also long, also over five lines, but no layer and no surface rule declares\n"
        "this path — so it must be ignored entirely.\n"
        "Line four.\nLine five.\nLine six.\nLine seven.\n"
    ))
    return repo


def build_acknowledged_empty(dest):
    """No layers, no mechanisms, acknowledgedEmptyMechanisms set — the
    emptiness is deliberate and must not be reported."""
    repo = Path(dest)
    config = _config(acknowledged_empty=True)
    _write_json(repo / ".claude" / "docs.config.json", config)
    _write_json(repo / ".claude" / "docs.config.schema.json", {"version": "1"})
    return repo
