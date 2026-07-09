import { describe, it, expect } from 'vitest';
import { deriveOverall } from './writeAttestation';

describe('deriveOverall', () => {
  it('is PASS only when every agent passed', () => {
    expect(deriveOverall({ a: { score: 9, verdict: 'PASS' }, b: { score: 8, verdict: 'PASS' } })).toBe('PASS');
  });

  it('is FAIL when any agent failed', () => {
    expect(deriveOverall({ a: { score: 9, verdict: 'PASS' }, b: { score: 5, verdict: 'FAIL' } })).toBe('FAIL');
  });

  it('is FAIL when no agents ran', () => {
    expect(deriveOverall({})).toBe('FAIL');
  });
});
