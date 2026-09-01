#!/usr/bin/env node
// UserPromptSubmit hook — re-assert the user's CURRENT language every turn (CICERO 7).
//
// SessionStart injects the voice once per session; over a long session the model can
// drift, and the user may switch languages mid-session. This fires on each prompt,
// detects the prompt's dominant script (latin / cyrillic / cjk), and injects a one-line
// reminder to reply in that language. Cheap (~15 tokens), silent when the script is
// Latin or ambiguous — English is the model default and needs no nudge.
//
// Node rewrite of the former language-nudge.py: unicode codepoint classification is
// clean and portable in node (~10ms startup) but fragile in bash on macOS, whose grep
// lacks \p{Script}. Hooks are shell-first here; this one is the deliberate node
// exception for unicode — rationale in docs/adr/0002. Fail-open: any error exits 0.

const LABEL = {
  cyrillic: 'Cyrillic (e.g. Russian)',
  cjk: 'CJK (Chinese / Japanese / Korean)',
};

function dominantScript(text) {
  let latin = 0;
  let cyrillic = 0;
  let cjk = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const lower = ch.toLowerCase();
    if (lower >= 'a' && lower <= 'z') {
      latin += 1;
    } else if (code >= 0x0400 && code <= 0x04ff) {
      cyrillic += 1;
    } else if (
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x3400 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjk += 1;
    }
  }
  const counts = { latin, cyrillic, cjk };
  // First key wins ties (latin > cyrillic > cjk), matching python's max(counts, key=...).
  let name = 'latin';
  for (const key of Object.keys(counts)) {
    if (counts[key] > counts[name]) {
      name = key;
    }
  }
  const others = Object.keys(counts).reduce(
    (sum, key) => (key === name ? sum : sum + counts[key]),
    0,
  );
  if (counts[name] >= 3 && counts[name] > others) {
    return name;
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  try {
    const prompt = JSON.parse(raw).prompt || '';
    if (typeof prompt === 'string' && prompt.trim()) {
      const script = dominantScript(prompt);
      if (script && LABEL[script]) {
        const context =
          `[CICERO 7] The user's latest message is in ${LABEL[script]} script — ` +
          'reply in that language. Keep code, paths, and identifiers in English.';
        process.stdout.write(
          `${JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: context,
            },
          })}\n`,
        );
      }
    }
  } catch (error) {
    // fail-open — never block a prompt over a nudge
  }
  process.exit(0);
});
