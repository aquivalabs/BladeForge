import { hashDiff, getCumulativeDiff, resolveBase } from './diffHash';
import { readAttestation, isAttestationValid, type Attestation } from './attestation';
import { scanForSecrets, type SecretFinding } from './secretScan';
import { loadConfig } from './config';

export interface GateInput {
  hash: string;
  attestation: Attestation | null;
  diff: string;
  secretAllowlist?: string[];
}

export interface GateResult {
  ok: boolean;
  attestationOk: boolean;
  secrets: SecretFinding[];
}

/** Pure decision: valid passing attestation for this hash AND no secret candidates. */
export const evaluateGate = (input: GateInput): GateResult => {
  const attestationOk = isAttestationValid(input.attestation, input.hash);
  const secrets = scanForSecrets(input.diff, input.secretAllowlist ?? []);
  return { ok: attestationOk && secrets.length === 0, attestationOk, secrets };
};

/**
 * CLI entry used by husky and CI.
 * - `--base <ref>` overrides the resolved base (CI passes `origin/main`).
 * - `--secrets-only` runs JUST the deterministic secret scan, skipping the attestation/hash
 *   check (base-independent — used by CI, which gates `/review` via re-running the
 *   deterministic suite, not by matching a locally-written attestation hash).
 */
export const runGate = (): GateResult => {
  const baseArgIndex = process.argv.indexOf('--base');
  const base = baseArgIndex >= 0 ? process.argv[baseArgIndex + 1] : resolveBase();
  const secretsOnly = process.argv.includes('--secrets-only');
  const diff = getCumulativeDiff(base);
  const { secretAllowlist } = loadConfig();

  if (secretsOnly) {
    const secrets = scanForSecrets(diff, secretAllowlist);
    return { ok: secrets.length === 0, attestationOk: true, secrets };
  }

  // Hash the SAME diff we scanned (honors --base) so the hash and the attestation always
  // agree on the base — no second, divergent base resolution.
  const hash = hashDiff(diff);
  return evaluateGate({ hash, attestation: readAttestation(), diff, secretAllowlist });
};

const printReport = (result: GateResult): void => {
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ✖  PUSH BLOCKED by review-gate');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  let step = 1;

  if (!result.attestationOk) {
    console.error(`  ${step}) Review not passed for THIS change set.`);
    console.error('     No `.review/attestation.json` matching the current diff was found');
    console.error('     (missing, or stale because the diff changed since the last review).');
    console.error('     → Run  /review  in Claude Code. On all-pass it writes the attestation;');
    console.error('       then push again.');
    console.error('');
    step += 1;
  }

  if (result.secrets.length > 0) {
    console.error(`  ${step}) ${result.secrets.length} possible secret(s) in the diff (blocks regardless of review):`);
    result.secrets.forEach((finding) => {
      const where = finding.file ? `${finding.file}:${finding.line}` : `line ${finding.line}`;
      console.error(`     • ${finding.pattern}  ${where}`);
      console.error(`         ${finding.excerpt}`);
    });
    console.error('     → Remove the secret (use env / a secret store). If it is a false');
    console.error('       positive (test fixture / docs example), add a marker to');
    console.error('       `secretAllowlist` in .claude/review.config.json (matched as a substring');
    console.error('       of the value), make it match EXAMPLE/PLACEHOLDER/…, or keep the literal');
    console.error('       out of source.');
    console.error('');
  }

  console.error('  Note: `git push --no-verify` skips this local hook, but the CI review-gate');
  console.error('  will still reject the change.');
  console.error('');
};

const isDirectRun = process.argv[1]?.endsWith('gate.ts') ?? false;
if (isDirectRun) {
  const result = runGate();
  if (!result.ok) {
    printReport(result);
    process.exit(1);
  }
  console.log('✓ review-gate: checks passed.');
}
