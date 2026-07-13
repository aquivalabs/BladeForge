#!/usr/bin/env python3
"""UserPromptSubmit hook — re-assert the user's CURRENT language every turn.

SessionStart injects the voice once per session; over a long session the model can drift,
and the user may switch languages mid-session (SessionStart can't react to that). This
fires on each prompt, detects the prompt's dominant script (latin / cyrillic / cjk), and
injects a one-line reminder to reply in that language (CICERO 12). Cheap (~15 tokens), and
silent when the script is Latin or ambiguous — English is the model default and needs no
nudge. The static voice rules ship as an output style; this hook only keeps the reply language current.
"""
import json
import sys

SCRIPT_LABEL = {
    "cyrillic": "Cyrillic (e.g. Russian)",
    "cjk": "CJK (Chinese / Japanese / Korean)",
}


def dominant_script(s):
    """Dominant script family of the text, or None if none clearly leads."""
    lat = cyr = cjk = 0
    for ch in s:
        o = ord(ch)
        if "a" <= ch.lower() <= "z":
            lat += 1
        elif 0x0400 <= o <= 0x04FF:
            cyr += 1
        elif (0x3040 <= o <= 0x30FF) or (0x3400 <= o <= 0x9FFF) or (0xAC00 <= o <= 0xD7AF):
            cjk += 1
    counts = {"latin": lat, "cyrillic": cyr, "cjk": cjk}
    name = max(counts, key=counts.get)
    if counts[name] >= 3 and counts[name] > sum(v for k, v in counts.items() if k != name):
        return name
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    prompt = data.get("prompt", "")
    if not isinstance(prompt, str) or not prompt.strip():
        sys.exit(0)

    script = dominant_script(prompt)
    if script in SCRIPT_LABEL:
        ctx = (
            f"[CICERO 12] The user's latest message is in {SCRIPT_LABEL[script]} script — "
            "reply in that language. Keep code, paths, and identifiers in English."
        )
        print(json.dumps(
            {"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ctx}},
            ensure_ascii=False,
        ))
    sys.exit(0)


if __name__ == "__main__":
    main()
