#!/usr/bin/env python3
"""The docs domain's deterministic pre-push check.

Vendored into a target project at scripts/docs-check.py. Standard library
only, no network call, runs under Python 3.9 — no API newer than that may
appear in this file, and no networking module of any kind is imported.

Reads .claude/docs.config.json at the target root plus the plugin-owned
.claude/docs.config.schema.json beside it, resolves the diff base against
git, computes the changed-path list once, and dispatches six independent
jobs — structure, paired-docs, declared-docs-resolve, config-sanity,
section-readmes, surface-rules — each a pure function

    (config: dict, repo_root: Path, changed_paths: list[str]) -> list[Finding]

aggregated by run_all(). Only base resolution touches git, so every bundled
fixture is exercised by calling a job (or run_all) with a synthetic
changed_paths list. main() takes no arguments — the canonical invocation is
`python3 scripts/docs-check.py` — ignores anything a hook passes on stdin,
prints one line per finding, and exits non-zero if any finding exists. No
judgement, no severity, no score: every finding is binary.
"""
import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

FROZEN_LAYER_KEY = "frozen"

SECTION_HEADINGS = [
    "Boundary",
    "Shape",
    "Update trigger",
    "Exclusions",
    "Acceptance criteria",
]

_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
_HEADING_RE = re.compile(r"^#{1,6}\s+(.*)\s*$", re.MULTILINE)
_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")
_NUMBER_PREFIX_RE = re.compile(r"^(\d{4})-")


class Finding:
    """One binary check failure: which job found it, which path it names,
    and a one-line human message. Deliberately has no severity/score field —
    the spec is explicit that this artifact carries none."""

    __slots__ = ("job", "path", "message")

    def __init__(self, job, path, message):
        self.job = job
        self.path = path
        self.message = message

    def __str__(self):
        return "[{}] {}: {}".format(self.job, self.path, self.message)

    def __repr__(self):
        return "Finding({!r}, {!r}, {!r})".format(self.job, self.path, self.message)


# ---------------------------------------------------------------------------
# Shared helpers: config/schema loading, layer normalization, markdown parsing
# ---------------------------------------------------------------------------

def load_config(repo_root):
    """Read .claude/docs.config.json at repo_root. Fails loudly (SystemExit)
    if it is missing or not valid JSON — there is nothing sensible to check
    without it."""
    config_path = Path(repo_root) / ".claude" / "docs.config.json"
    if not config_path.is_file():
        raise SystemExit("docs-check: missing config at {}".format(config_path))
    try:
        return json.loads(config_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit("docs-check: cannot read/parse {} ({})".format(config_path, exc))


def _read_schema_version(repo_root):
    schema_path = Path(repo_root) / ".claude" / "docs.config.schema.json"
    if not schema_path.is_file():
        raise SystemExit("docs-check: missing schema at {}".format(schema_path))
    try:
        data = json.loads(schema_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit("docs-check: cannot read/parse {} ({})".format(schema_path, exc))
    return data.get("version") if isinstance(data, dict) else None


def _normalize_layers(config):
    """A layers value is either a bare root string, or an object with a
    required root and optional index/requiredFields/numbered. Normalize both
    shapes to one dict shape so every job reads the same fields."""
    layers = config.get("layers") or {}
    normalized = {}
    for name, value in layers.items():
        if isinstance(value, str):
            normalized[name] = {
                "root": value,
                "index": None,
                "requiredFields": [],
                "numbered": False,
            }
        elif isinstance(value, dict):
            normalized[name] = {
                "root": value.get("root"),
                "index": value.get("index"),
                "requiredFields": value.get("requiredFields") or [],
                "numbered": bool(value.get("numbered", False)),
            }
        else:
            raise SystemExit("docs-check: layer {!r} has an invalid value".format(name))
    return normalized


def _non_frozen(layers):
    return {name: layer for name, layer in layers.items() if name != FROZEN_LAYER_KEY}


def _root_components(root):
    return [part for part in root.strip("/").split("/") if part]


def _is_prefix(shorter, longer):
    return len(shorter) <= len(longer) and longer[: len(shorter)] == shorter


def contained_path(repo_root, value):
    """Join a config-supplied path onto the repo root, or None if it escapes.

    Every path in config is project-supplied, and two shapes climb out of the repo: an
    absolute value, which wins the `/` join outright, and a `../..` prefix. This check reads
    files and reports their names, so a config must not be able to turn it into a reader of
    the whole host. Callers treat None as "not present" — the same answer they already give
    for a missing path — so an escaping value degrades to a finding rather than a traversal.
    """
    candidate = (repo_root / value).resolve()
    try:
        candidate.relative_to(repo_root.resolve())
    except ValueError:
        return None
    return repo_root / value


def _rel(path, repo_root):
    try:
        return str(Path(path).resolve().relative_to(Path(repo_root).resolve()))
    except ValueError:
        return str(path)


def _iter_md_files(root_path):
    if not root_path.is_dir():
        return []
    return sorted(p for p in root_path.rglob("*.md") if p.is_file())


def _extract_links(text):
    return [match.group(1).strip() for match in _LINK_RE.finditer(text)]


def _extract_heading_texts(text):
    return [match.group(1).strip() for match in _HEADING_RE.finditer(text)]


def slugify_heading(text):
    """The anchor-slug rule from the run contract: lowercase, drop everything
    outside [a-z0-9 -], collapse whitespace runs to single hyphens."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9 -]", "", text)
    return re.sub(r"\s+", "-", text.strip())


def _split_fragment(target):
    if "#" in target:
        path_part, fragment = target.split("#", 1)
        return path_part, fragment
    return target, None


def _has_scheme(target):
    return bool(_SCHEME_RE.match(target))


def resolve_relative_link(linking_file, target):
    """Resolve a markdown link target relative to linking_file's directory.

    Returns `(path, fragment)`. `path` is None for empty targets, scheme-qualified
    targets (mailto:, a web protocol, ...), or a fragment-only target — none of those
    are resolved by this check. `fragment` is the part after `#`, or None, and it is
    returned rather than discarded so a link into a heading that does not exist can be
    caught as well as a link to a file that does not exist.
    """
    path_part, fragment = _split_fragment(target)
    if not path_part or _has_scheme(path_part):
        return None, fragment
    return (Path(linking_file).parent / path_part).resolve(), fragment


def find_dead_links(md_file):
    """Every relative link in md_file that does not resolve — file or heading.

    Two ways a relative link is dead, and both are the same defect to a reader who
    clicks it: the file is not there, or the file is there and the `#heading` is not.
    The second is the one a rename of a heading produces, which is why the anchor is
    compared rather than dropped.

    Called by the structure job only. External links are never checked: they are the
    documented source of false blocking, and nothing here needs them.
    """
    dead = []
    text = Path(md_file).read_text()
    for target in _extract_links(text):
        resolved, fragment = resolve_relative_link(md_file, target)
        if resolved is None:
            continue
        if not resolved.exists():
            dead.append(target)
            continue
        if fragment and resolved.is_file() and resolved.suffix.lower() == ".md":
            try:
                headings = _extract_heading_texts(resolved.read_text())
            except OSError:
                continue
            if slugify_heading(fragment) not in {slugify_heading(h) for h in headings}:
                dead.append(target)
    return dead


# ---------------------------------------------------------------------------
# Job 1: config-sanity — prefix collision, schema-version skew, vacuous-green
# ---------------------------------------------------------------------------

def config_sanity(config, repo_root, changed_paths):
    findings = []
    layers = _normalize_layers(config)

    names = list(layers.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            root_a, root_b = layers[names[i]]["root"], layers[names[j]]["root"]
            comp_a, comp_b = _root_components(root_a), _root_components(root_b)
            if _is_prefix(comp_a, comp_b) or _is_prefix(comp_b, comp_a):
                findings.append(Finding(
                    "config-sanity",
                    "{} , {}".format(root_a, root_b),
                    "layer roots collide: {!r} and {!r}".format(root_a, root_b),
                ))

    schema_version = _read_schema_version(repo_root)
    config_version = config.get("schemaVersion")
    seeded_against = config_version if config_version is not None else "absent"
    if str(seeded_against) != str(schema_version):
        findings.append(Finding(
            "config-sanity",
            _rel(Path(repo_root) / ".claude" / "docs.config.json", repo_root),
            "config schema version mismatch: config seeded against {}, schema is now {}".format(
                seeded_against, schema_version,
            ),
        ))

    mechanisms = config.get("mechanisms") or []
    if not mechanisms:
        if config.get("acknowledgedEmptyMechanisms") is True:
            print("config-sanity: acknowledgedEmptyMechanisms is set — empty mechanism list accepted.")
        else:
            findings.append(Finding("config-sanity", "mechanisms", "no mechanisms declared"))

    return findings


# ---------------------------------------------------------------------------
# Job 2: structure — index agreement, required fields, numbering, dead links
#         (declared non-frozen layers only)
# ---------------------------------------------------------------------------

def _check_index_agreement(root_path, index_name, repo_root):
    findings = []
    index_path = root_path / index_name
    if not index_path.is_file():
        findings.append(Finding(
            "structure", _rel(index_path, repo_root),
            "declared index file is missing",
        ))
        return findings

    resolved_targets = set()
    for target in _extract_links(index_path.read_text()):
        resolved, _fragment = resolve_relative_link(index_path, target)
        if resolved is None:
            continue
        resolved_targets.add(resolved)

    for md_file in _iter_md_files(root_path):
        if md_file.resolve() == index_path.resolve() or md_file.name.lower() == "readme.md":
            continue
        if md_file.resolve() not in resolved_targets:
            findings.append(Finding(
                "structure", _rel(md_file, repo_root),
                "file not linked from index {}".format(_rel(index_path, repo_root)),
            ))
    return findings


def _check_required_fields(root_path, index_name, required_fields, repo_root):
    findings = []
    if not required_fields:
        return findings
    for md_file in _iter_md_files(root_path):
        if md_file.name.lower() == "readme.md":
            continue
        if index_name and md_file.name == index_name:
            continue
        headings = {h.lower() for h in _extract_heading_texts(md_file.read_text())}
        for field in required_fields:
            if field.lower() not in headings:
                findings.append(Finding(
                    "structure", _rel(md_file, repo_root),
                    "missing required field heading: {}".format(field),
                ))
    return findings


def _check_numbered(root_path, index_name, repo_root):
    findings = []
    index_path = root_path / index_name if index_name else None
    index_text = index_path.read_text() if index_path and index_path.is_file() else ""

    for md_file in _iter_md_files(root_path):
        if md_file.name.lower() == "readme.md":
            continue
        if index_name and md_file.name == index_name:
            continue
        match = _NUMBER_PREFIX_RE.match(md_file.name)
        if not match:
            findings.append(Finding(
                "structure", _rel(md_file, repo_root),
                "numbered layer file name does not start with NNNN-",
            ))
            continue
        number = match.group(1)
        matching_line = next(
            (line for line in index_text.splitlines() if md_file.name in line), None,
        )
        if matching_line is None or number not in matching_line:
            findings.append(Finding(
                "structure", _rel(md_file, repo_root),
                "index row for this numbered file does not carry the matching number {}".format(number),
            ))
    return findings


def _check_internal_links(root_path, repo_root):
    findings = []
    for md_file in _iter_md_files(root_path):
        for target in find_dead_links(md_file):
            findings.append(Finding(
                "structure", _rel(md_file, repo_root),
                "dead relative link to {}".format(target),
            ))
    return findings


def structure(config, repo_root, changed_paths):
    findings = []
    repo_root = Path(repo_root)
    for layer in _non_frozen(_normalize_layers(config)).values():
        root_path = contained_path(repo_root, layer["root"])
        if root_path is None:
            findings.append(Finding(
                "structure", layer["root"],
                "declared layer root resolves outside the repository",
            ))
            continue
        if not root_path.is_dir():
            findings.append(Finding("structure", layer["root"], "declared layer root does not exist"))
            continue

        if layer["index"]:
            findings.extend(_check_index_agreement(root_path, layer["index"], repo_root))
            if layer["numbered"]:
                findings.extend(_check_numbered(root_path, layer["index"], repo_root))

        findings.extend(_check_required_fields(root_path, layer["index"], layer["requiredFields"], repo_root))
        findings.extend(_check_internal_links(root_path, repo_root))
    return findings


# ---------------------------------------------------------------------------
# Job 3: paired-docs — diff-scoped, the only job with a skip route (exempt)
# ---------------------------------------------------------------------------

def _mechanism_matches(patterns, changed_paths):
    includes = [p for p in patterns if not p.startswith("!")]
    excludes = [p[1:] for p in patterns if p.startswith("!")]
    for path in changed_paths:
        if any(fnmatch.fnmatchcase(path, pattern) for pattern in includes):
            if not any(fnmatch.fnmatchcase(path, pattern) for pattern in excludes):
                return True
    return False


def paired_docs(config, repo_root, changed_paths):
    findings = []
    changed_set = set(changed_paths)

    for mechanism in config.get("mechanisms") or []:
        mechanism_id = mechanism.get("id", "<unnamed>")
        if not _mechanism_matches(mechanism.get("paths") or [], changed_paths):
            continue

        exempt = mechanism.get("exempt")
        if exempt:
            print("paired-docs: {} exempt — {}".format(mechanism_id, exempt))
            continue

        doc = mechanism.get("doc")
        if doc not in changed_set:
            findings.append(Finding(
                "paired-docs", doc or mechanism_id,
                "mechanism {} changed without updating its doc {}".format(mechanism_id, doc),
            ))
    return findings


# ---------------------------------------------------------------------------
# Job 4: declared-docs-resolve — whole-tree, never diff-scoped
# ---------------------------------------------------------------------------

def declared_docs_resolve(config, repo_root, changed_paths):
    findings = []
    repo_root = Path(repo_root)
    for mechanism in config.get("mechanisms") or []:
        mechanism_id = mechanism.get("id", "<unnamed>")
        doc = mechanism.get("doc")
        doc_path = contained_path(repo_root, doc) if doc else None
        if doc_path is None or not doc_path.is_file():
            findings.append(Finding(
                "declared-docs-resolve", doc or mechanism_id,
                "mechanism {} declares a doc that does not exist: {}".format(mechanism_id, doc),
            ))
    return findings


# ---------------------------------------------------------------------------
# Job 5: section-readmes — every non-frozen layer root answers five questions
# ---------------------------------------------------------------------------

def section_readmes(config, repo_root, changed_paths):
    findings = []
    repo_root = Path(repo_root)
    for layer in _non_frozen(_normalize_layers(config)).values():
        root_path = contained_path(repo_root, layer["root"])
        if root_path is None:
            findings.append(Finding(
                "section-readmes", layer["root"],
                "declared layer root resolves outside the repository",
            ))
            continue
        readme_path = root_path / "README.md"
        if not readme_path.is_file():
            findings.append(Finding(
                "section-readmes", _rel(readme_path, repo_root),
                "layer root has no README.md",
            ))
            continue

        headings = {h.lower() for h in _extract_heading_texts(readme_path.read_text())}
        for question in SECTION_HEADINGS:
            if question.lower() not in headings:
                findings.append(Finding(
                    "section-readmes", _rel(readme_path, repo_root),
                    "README.md missing heading: {}".format(question),
                ))
    return findings


# ---------------------------------------------------------------------------
# Job 6: surface-rules — a line cap over configured paths, nothing else seen
# ---------------------------------------------------------------------------

def surface_rules(config, repo_root, changed_paths):
    findings = []
    repo_root = Path(repo_root)
    rules = config.get("surfaceRules") or {}
    line_cap = rules.get("lineCap")
    patterns = rules.get("paths") or []
    if not line_cap or not patterns:
        return findings

    for pattern in patterns:
        for path in repo_root.glob(pattern):
            if not path.is_file():
                continue
            # One containment rule for every config-supplied path in this file, so the four
            # join sites cannot drift apart — which is how three of them ended up unguarded.
            if contained_path(repo_root, path.relative_to(repo_root)) is None:
                continue
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                line_count = sum(1 for _ in handle)
            if line_count > line_cap:
                findings.append(Finding(
                    "surface-rules", _rel(path, repo_root),
                    "{} lines exceeds cap {}".format(line_count, line_cap),
                ))
    return findings


# ---------------------------------------------------------------------------
# Aggregation and git-facing plumbing
# ---------------------------------------------------------------------------

JOBS = (
    config_sanity,
    structure,
    paired_docs,
    declared_docs_resolve,
    section_readmes,
    surface_rules,
)


def run_all(config, repo_root, changed_paths):
    findings = []
    for job in JOBS:
        findings.extend(job(config, repo_root, changed_paths))
    return findings


def _git_repo_root():
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise SystemExit("docs-check: could not determine git repo root ({})".format(exc))
    return Path(result.stdout.strip())


def resolve_base(repo_root, config):
    """The run contract's three-branch guarded fallback, exactly:
    1. `git rev-parse --verify -q origin/main` succeeds -> base is
       `git merge-base origin/main HEAD`.
    2. it fails (measured: exit 128 in a fresh no-remote scratch repo) ->
       base is the root commit from `git rev-list --max-parents=0 HEAD`,
       taking the LAST line (the `| tail -1` shape).
    3. a `base` field in config overrides both branches.
    """
    override = config.get("base")
    if override:
        # A config-supplied base reaches `git diff` as a positional argument, so a value
        # like `--output=<path>` would be read by git as its own flag and write a file.
        # Reject anything option-shaped, then require it to resolve to a real commit.
        if str(override).startswith("-"):
            raise SystemExit(
                "docs-check: config `base` may not start with '-' (got {!r})".format(override)
            )
        resolved = subprocess.run(
            ["git", "rev-parse", "--verify", "-q", "{}^{{commit}}".format(override)],
            cwd=str(repo_root), capture_output=True, text=True,
        )
        if resolved.returncode != 0:
            raise SystemExit(
                "docs-check: config `base` does not resolve to a commit (got {!r})".format(override)
            )
        return resolved.stdout.strip()

    repo_root = str(repo_root)
    verify = subprocess.run(
        ["git", "rev-parse", "--verify", "-q", "origin/main"],
        cwd=repo_root, capture_output=True, text=True,
    )
    if verify.returncode == 0:
        merge_base = subprocess.run(
            ["git", "merge-base", "origin/main", "HEAD"],
            cwd=repo_root, capture_output=True, text=True, check=True,
        )
        return merge_base.stdout.strip()

    root_commits = subprocess.run(
        ["git", "rev-list", "--max-parents=0", "HEAD"],
        cwd=repo_root, capture_output=True, text=True, check=True,
    )
    lines = [line for line in root_commits.stdout.splitlines() if line.strip()]
    if not lines:
        raise SystemExit("docs-check: could not find a root commit")
    return lines[-1]


def compute_changed_paths(repo_root, base):
    result = subprocess.run(
        ["git", "diff", "--name-only", "--end-of-options", base, "HEAD"],
        cwd=str(repo_root), capture_output=True, text=True, check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main():
    repo_root = _git_repo_root()
    config = load_config(repo_root)
    base = resolve_base(repo_root, config)
    changed_paths = compute_changed_paths(repo_root, base)

    findings = run_all(config, repo_root, changed_paths)
    for finding in findings:
        print(str(finding))
    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
