#!/usr/bin/env python3
"""Fail if plugins/ on disk and .claude-plugin/marketplace.json disagree, in either of two ways.

catalog.json is kept current by scout-publish.yml (regenerated post-merge), so it needs
no PR gate. marketplace.json, by contrast, is hand-maintained and has no generator — the
exact gap where a shipped plugin can go unregistered (scout did). This check closes it:
every plugins/<name>/ with a plugin.json must have a marketplace entry, and vice-versa — AND
each entry's description must match that plugin's own plugin.json verbatim.

The second rule was added after a rule's one-sentence summary went out of step three times in a
row: it is written by hand in plugin.json, marketplace.json and README.md, generated into
catalog.json from metadata.yaml, and nothing compared them. Each time only some copies were
updated, and the stale ones were what a reader or a scouting agent actually saw.

Deterministic, stdlib-only. Exit 1 with a listing on any mismatch.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKET = ROOT / ".claude-plugin" / "marketplace.json"
PLUGINS = ROOT / "plugins"


def main() -> None:
    try:
        data = json.loads(MARKET.read_text(encoding="utf-8"))
    except Exception as e:
        sys.exit(f"check_marketplace_sync: cannot read/parse {MARKET} ({e})")

    listed = set()
    for entry in data.get("plugins", []):
        source = (entry.get("source") or "").rstrip("/")
        if source:
            listed.add(source.split("/")[-1])

    on_disk = {
        p.name
        for p in PLUGINS.iterdir()
        if p.is_dir() and (p / ".claude-plugin" / "plugin.json").is_file()
    }

    missing = sorted(on_disk - listed)   # ships on disk, absent from marketplace.json
    extra = sorted(listed - on_disk)     # listed in marketplace.json, no plugin on disk

    # Each entry's description against the plugin's own. A curly apostrophe in one copy and a
    # straight one in the other is a typographic difference, not a claim that differs, so both
    # are normalised before comparing.
    def normalise(text: str) -> str:
        return " ".join(text.replace("\u2019", "'").split())

    drifted = []
    for entry in data.get("plugins", []):
        name = (entry.get("source") or "").rstrip("/").split("/")[-1]
        if name not in on_disk:
            continue
        own = PLUGINS / name / ".claude-plugin" / "plugin.json"
        try:
            theirs = json.loads(own.read_text(encoding="utf-8")).get("description", "")
        except Exception as e:
            drifted.append(f"{name}: cannot read {own} ({e})")
            continue
        if normalise(entry.get("description", "")) != normalise(theirs):
            drifted.append(name)

    problems = []
    if missing:
        problems.append(f"plugins on disk but NOT registered in marketplace.json: {missing}")
    if extra:
        problems.append(f"marketplace.json entries with NO plugin on disk: {extra}")
    if drifted:
        problems.append(
            "marketplace.json descriptions that disagree with the plugin's own plugin.json: "
            f"{sorted(drifted)}"
        )

    if problems:
        print("marketplace sync check FAILED:")
        for line in problems:
            print("  - " + line)
        print("\nFix: add/remove the entry in .claude-plugin/marketplace.json so it matches plugins/.")
        sys.exit(1)

    print(f"marketplace sync OK — {len(on_disk)} plugins, all registered, all descriptions agree")


if __name__ == "__main__":
    main()
