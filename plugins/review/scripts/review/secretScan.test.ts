import { describe, it, expect } from 'vitest';
import { scanForSecrets } from './secretScan';

// All fixtures are built by concatenation so a literal secret never sits in this source file
// (otherwise the secret scanner would flag its own test fixtures in the diff it scans).
const awsKey = `AKIA${'WXYZ0123ABCD4567'}`;
const sfToken = `00D${'ABCDEFGHIJKLMNO'}!${'ABCDEFGHIJKLMNOPQRSTUVWXY'}`;
const bearer = `Bearer ${'AbCdEf0123456789AbCdEf'}`;
const pem = `-----BEGIN ${'PRIVATE KEY-----'}`;
const apiKeyLine = `api_key=${'AbCdEf0123456789'}`;
const passwordLine = `password=${'sup3rsecretvalue'}`;

const added = (value: string): string => `+++ b/config.ts\n@@ -0,0 +1,1 @@\n+const x = "${value}";`;

describe('scanForSecrets — patterns', () => {
  it('flags aws-access-key', () => {
    expect(scanForSecrets(added(awsKey)).map((f) => f.pattern)).toContain('aws-access-key');
  });
  it('flags sf-access-token', () => {
    expect(scanForSecrets(added(sfToken)).map((f) => f.pattern)).toContain('sf-access-token');
  });
  it('flags bearer-token', () => {
    expect(scanForSecrets(added(bearer)).map((f) => f.pattern)).toContain('bearer-token');
  });
  it('flags private-key', () => {
    expect(scanForSecrets(added(pem)).map((f) => f.pattern)).toContain('private-key');
  });
  it('flags api-key', () => {
    expect(scanForSecrets(added(apiKeyLine)).map((f) => f.pattern)).toContain('api-key');
  });
  it('flags generic-secret (password/client_secret)', () => {
    expect(scanForSecrets(added(passwordLine)).map((f) => f.pattern)).toContain('generic-secret');
  });
});

describe('scanForSecrets — behavior', () => {
  it('allowlists obvious example/placeholder values', () => {
    expect(scanForSecrets('+const key = "AKIAIOSFODNN7EXAMPLE";')).toHaveLength(0);
  });

  it('does NOT let an unrelated token on the line suppress a real secret', () => {
    // A TS generic `<string>` used to defeat the old whole-line allowlist; the real key must still flag.
    const findings = scanForSecrets(`+const x: Array<string> = ["${awsKey}"];`);
    expect(findings.map((f) => f.pattern)).toContain('aws-access-key');
  });

  it('reports the correct new-file line within a hunk', () => {
    const diff = ['+++ b/config.ts', '@@ -0,0 +10,2 @@', ' const untouched = 1;', `+const k = "${awsKey}";`].join('\n');
    expect(scanForSecrets(diff)[0].line).toBe(11);
  });

  it('ignores removed lines and diff headers', () => {
    const diff = ['--- a/file.ts', `-const key = "${awsKey}";`].join('\n');
    expect(scanForSecrets(diff)).toHaveLength(0);
  });
});
