import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanForSecrets } from './secretScan';
import { evaluateGate } from './gate';
import { loadConfig } from './config';
import { findStaleDocs } from './docPairing';

const planted = `+++ b/src/x.ts\n@@ -0,0 +1 @@\n+const apiKey = 'AKIA0000000000000000'\n`;
const clean = `+++ b/src/x.ts\n@@ -0,0 +1 @@\n+const sum = (a: number, b: number) => a + b\n`;

const exampleDir = join(__dirname, '../../examples/plain-ts');

describe('smoke', () => {
  it('secret scan flags a planted AWS key', () => {
    expect(scanForSecrets(planted).length).toBeGreaterThan(0);
  });

  it('clean diff produces no secret findings', () => {
    expect(scanForSecrets(clean)).toHaveLength(0);
  });

  it('a secretAllowlist marker suppresses a matching planted value', () => {
    expect(scanForSecrets(planted, ['AKIA0000000000000000'])).toHaveLength(0);
  });

  it('gate blocks when a secret is present even with a valid attestation', () => {
    const hash = 'abc';
    const attestation = { diffHash: hash, perAgent: {}, overall: 'PASS' as const, timestamp: 't' };
    expect(evaluateGate({ hash, attestation, diff: planted }).ok).toBe(false);
  });

  it('example config loads with 5 enabled agents', () => {
    const cfg = loadConfig(exampleDir);
    expect(cfg.agents.filter((agent) => agent.enabled)).toHaveLength(5);
  });

  it('docPairing uses the example pairedDocs', () => {
    const cfg = loadConfig(exampleDir);
    const docsAgent = cfg.agents.find((agent) => agent.name === 'docs');
    expect(findStaleDocs(['src/x.ts'], docsAgent?.pairedDocs ?? [])).toHaveLength(1);
  });
});
