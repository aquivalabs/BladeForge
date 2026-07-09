export interface SecretFinding {
  pattern: string;
  file: string;
  line: number;
  excerpt: string;
}

// Each pattern matches a secret. When a capture group is present, group 1 is the secret
// VALUE (used for allowlisting); otherwise the whole match is the value.
const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'sf-access-token', regex: /00D[A-Za-z0-9]{12,}![A-Za-z0-9._]{20,}/ },
  { name: 'bearer-token', regex: /Bearer\s+([A-Za-z0-9._-]{20,})/ },
  { name: 'private-key', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'api-key', regex: /\bapi[_-]?key\s*[:=]\s*['"]?([A-Za-z0-9._-]{16,})/i },
  {
    name: 'generic-secret',
    // Require an assignment (`=`/`:`) so prose like "secret candidate" is not flagged.
    regex: /\b(?:client[_-]?secret|secret|password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{8,})/i,
  },
];

// Tokens that are obviously not real secrets (docs examples, placeholders). Matched against
// the secret VALUE only — never the whole line — so an unrelated word elsewhere on the line
// cannot suppress a real finding.
const ALLOWLIST = /EXAMPLE|PLACEHOLDER|SAMPLE|DUMMY|FAKE|REDACTED|CHANGEME|YOUR[_-]/i;

const parseHunkStart = (line: string): number => {
  const match = /\+(\d+)/.exec(line);
  return match ? Number.parseInt(match[1], 10) : 0;
};

/**
 * Scan a unified diff for secret candidates on ADDED lines, tracking the real file and
 * new-file line number. A candidate is skipped only when its matched VALUE looks like a
 * documented example/placeholder — either via the built-in ALLOWLIST or a project marker
 * from `extraAllowlist` (the repo's `secretAllowlist` config, matched as a substring of
 * the value).
 */
export const scanForSecrets = (diffText: string, extraAllowlist: string[] = []): SecretFinding[] => {
  const allowed = (value: string): boolean =>
    ALLOWLIST.test(value) ||
    extraAllowlist.some((marker) => value.toLowerCase().includes(marker.toLowerCase()));
  const findings: SecretFinding[] = [];
  let currentFile = '';
  let newLine = 0;

  diffText.split('\n').forEach((rawLine) => {
    if (rawLine.startsWith('+++ ')) {
      currentFile = rawLine.replace(/^\+\+\+ (b\/)?/, '');
      return;
    }
    if (rawLine.startsWith('--- ')) {
      return;
    }
    if (rawLine.startsWith('@@')) {
      newLine = parseHunkStart(rawLine);
      return;
    }
    if (rawLine.startsWith('-')) {
      return;
    }
    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1);
      PATTERNS.forEach((pattern) => {
        const match = pattern.regex.exec(content);
        if (!match) {
          return;
        }
        const value = match[1] ?? match[0];
        if (allowed(value)) {
          return;
        }
        findings.push({ pattern: pattern.name, file: currentFile, line: newLine, excerpt: content.trim().slice(0, 80) });
      });
      newLine += 1;
      return;
    }
    newLine += 1;
  });

  return findings;
};
