import { describe, it, expect } from 'vitest';
import { hashDiff, stripReviewPaths } from './diffHash';

describe('stripReviewPaths', () => {
  it('drops diff sections for files under .review/', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '+const value = 1;',
      'diff --git a/.review/attestation.json b/.review/attestation.json',
      '+{"overall":"PASS"}',
    ].join('\n');
    const stripped = stripReviewPaths(diff);
    expect(stripped).toContain('src/app.ts');
    expect(stripped).not.toContain('.review/attestation.json');
  });
});

describe('hashDiff', () => {
  it('is stable and ignores .review/ changes', () => {
    const base = 'diff --git a/src/app.ts b/src/app.ts\n+const value = 1;\n';
    const withReview = `${base}diff --git a/.review/attestation.json b/.review/attestation.json\n+{}\n`;
    expect(hashDiff(base)).toBe(hashDiff(withReview));
  });
});
