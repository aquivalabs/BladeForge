import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface AgentResult {
  score: number;
  verdict: 'PASS' | 'FAIL';
}

export interface Attestation {
  diffHash: string;
  perAgent: Record<string, AgentResult>;
  overall: 'PASS' | 'FAIL';
  timestamp: string;
}

export const ATTESTATION_PATH = '.review/attestation.json';

export const writeAttestation = (attestation: Attestation, path: string = ATTESTATION_PATH): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(attestation, null, 2)}\n`);
};

export const readAttestation = (path: string = ATTESTATION_PATH): Attestation | null => {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Attestation;
};

/** A push is allowed only if the attestation passed AND was produced for this exact diff. */
export const isAttestationValid = (attestation: Attestation | null, currentHash: string): boolean => {
  if (!attestation) {
    return false;
  }
  return attestation.overall === 'PASS' && attestation.diffHash === currentHash;
};
