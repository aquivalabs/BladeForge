#!/usr/bin/env python3
"""
Stop-hook: enforce CICERO communication rules on the assistant's reply to the user.

Embeds the rules themselves (pulled from CICERO), does NOT hardcode a single language:
  - Principle 12 (Language): converse in the USER's language — detected from their own
    messages, not assumed. Code/paths/identifiers stay English (that is allowed).
  - Principle 2 (Size to ask): concise; no wall of filler.
  - Principle 3 (Gloss every term): no dump of untranslated jargon / anglicisms; a term
    that must stay foreign has to be glossed in (parens).

Deterministic heuristic (no model call): catches the GROSS violations —
  (a) reply prose in a different script than the user's language, and
  (b) untranslated technical jargon appearing in prose (outside code spans).
It cannot judge subtle style; it stops the repeat offenders.
"""
import json, re, sys

# --- CICERO rules, embedded verbatim so the block message carries the actual law ---
CICERO = (
    "CICERO 12 (Language): converse in the USER's language; only code/docs/identifiers stay English.\n"
    "CICERO 2 (Size to ask): concise, bullets over prose, no filler.\n"
    "CICERO 3 (Gloss EVERY term the user may not know, first use, in (parens); over-explain by default)."
)

# Jargon that must be TRANSLATED, not dropped raw into non-English prose.
# (Matched only OUTSIDE code spans / paths — see cleaning below.)
JARGON = [
    "holdout", "recall", "precision", "baseline", "false-fire", "false fire",
    "over-trigger", "under-trigger", "over-triggering", "under-triggering",
    "trigger", "triggering", "fork", "probe", "queryset", "roi", "lexical",
    "eval", "evals", "commit", "push", "merge", "diff", "scaffold",
]
# Latin tokens that are allowed in any language prose (proper nouns, unavoidable).
ALLOW = {
    "cicero", "ockham", "solid", "git", "github", "claude", "lwc", "aura",
    "apex", "react", "node", "css", "scss", "bem", "rem", "kpi", "bff",
    "ui", "api", "id", "ts", "js", "md", "ok",
}

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

def text_of(msg):
    c = msg.get("message", {}).get("content", "")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    return ""

def transcript_messages(path):
    out = []
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
    except Exception:
        pass
    return out

def strip_code(s):
    s = re.sub(r"```.*?```", " ", s, flags=re.S)      # fenced code
    s = re.sub(r"`[^`]*`", " ", s)                     # inline code
    s = re.sub(r"https?://\S+", " ", s)                # urls
    s = re.sub(r"\S*/\S*", " ", s)                     # paths
    s = re.sub(r"\S+\.(md|py|ts|tsx|js|json|sh|cls|scss|css|xml)\b", " ", s)  # filenames
    s = re.sub(r"\([^)]*\)", " ", s)                   # parenthetical glosses are OK -> drop
    return s

def script_of(s):
    cyr = sum(1 for ch in s if chr(0x400) <= ch <= chr(0x4ff))
    lat = sum(1 for ch in s if "a" <= ch.lower() <= "z")
    return cyr, lat

def main():
    data = load_input()
    # Prevent infinite loops: if we already blocked this turn, let it pass.
    if data.get("stop_hook_active"):
        sys.exit(0)
    msgs = transcript_messages(data.get("transcript_path", ""))
    if not msgs:
        sys.exit(0)

    # last assistant text
    assistant = ""
    for m in reversed(msgs):
        if m.get("type") == "assistant":
            assistant = text_of(m)
            break
    if not assistant.strip():
        sys.exit(0)

    # user's language from their last few real messages
    user_cyr = user_lat = 0
    seen = 0
    for m in reversed(msgs):
        if m.get("type") == "user":
            t = text_of(m)
            if t.strip() and not t.strip().startswith("<"):
                c, l = script_of(t)
                user_cyr += c; user_lat += l
                seen += 1
                if seen >= 3:
                    break
    user_is_cyrillic = user_cyr > user_lat and user_cyr > 20

    prose = strip_code(assistant)
    reasons = []

    # (a) language mismatch: user writes Cyrillic, reply prose is mostly Latin
    a_cyr, a_lat = script_of(prose)
    if user_is_cyrillic and a_lat > a_cyr and a_lat > 15:
        reasons.append("reply prose is mostly English while the user writes Russian")

    # (b) untranslated jargon in prose
    low = prose.lower()
    hits = sorted({j for j in JARGON if re.search(r"(?<![\w-])" + re.escape(j) + r"(?![\w-])", low)})
    if user_is_cyrillic and hits:
        reasons.append("untranslated jargon in Russian prose: " + ", ".join(hits))

    # (c) heavy anglicism: many non-allowed Latin words in Cyrillic prose
    if user_is_cyrillic:
        lat_words = [w.lower() for w in re.findall(r"[A-Za-z][A-Za-z-]{2,}", prose)]
        stray = [w for w in lat_words if w not in ALLOW and w not in JARGON]
        if len(stray) > 8:
            reasons.append(f"{len(stray)} English words in Russian prose (gloss or translate them)")

    if reasons:
        out = {
            "decision": "block",
            "reason": (
                "Rewrite this reply before sending — it breaks the house voice:\n- "
                + "\n- ".join(reasons)
                + "\n\n" + CICERO
                + "\n\nRe-send in the user's language, plain and short; translate the jargon "
                "or gloss each foreign term in (parens). Keep code/paths/identifiers as-is."
            ),
        }
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(0)

    sys.exit(0)

if __name__ == "__main__":
    main()
