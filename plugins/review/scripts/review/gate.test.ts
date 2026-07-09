import { describe, it, expect } from 'vitest';
import { evaluateGate } from './gate';

// Concatenated so the literal AWS-key pattern is never present in this source file.
const awsKey = `AKIA${'WXYZ0123ABCD4567'}`;

describe('evaluateGate', () => {
  it('fails when attestation is missing', () => {
    const result = evaluateGate({ hash: 'abc', attestation: null, diff: '' });
    expect(result.ok).toBe(false);
    expect(result.attestationOk).toBe(false);
  });

  it('fails when a secret is present even with a valid attestation', () => {
    const result = evaluateGate({
      hash: 'abc',
      attestation: { diffHash: 'abc', perAgent: {}, overall: 'PASS', timestamp: 't' },
      diff: `+const key = "${awsKey}";`,
    });
    expect(result.ok).toBe(false);
    expect(result.attestationOk).toBe(true);
    expect(result.secrets).toHaveLength(1);
  });

  it('passes with a valid attestation and no secrets', () => {
    const result = evaluateGate({
      hash: 'abc',
      attestation: { diffHash: 'abc', perAgent: {}, overall: 'PASS', timestamp: 't' },
      diff: '+const value = 1;',
    });
    expect(result.ok).toBe(true);
  });
});
