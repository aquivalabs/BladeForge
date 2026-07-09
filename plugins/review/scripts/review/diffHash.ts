import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/** Drop diff sections for files under `.review/` so the attestation cannot invalidate its own hash. */
export const stripReviewPaths = (diffText: string): string => {
  const sections = diffText.split(/(?=^diff --git )/m);
  return sections
    .filter((section) => {
      const header = section.split('\n')[0];
      return !header.startsWith('diff --git ') || !/ b\/\.review\//.test(header);
    })
    .join('');
};

/** sha256 of the diff text, excluding `.review/`. */
export const hashDiff = (diffText: string): string => {
  return createHash('sha256').update(stripReviewPaths(diffText)).digest('hex');
};

/** Base ref: upstream of the current branch, else `origin/main` (a remote ref that exists in
 * both local clones and CI checkouts — bare `main` often does not exist in CI). */
export const resolveBase = (): string => {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'origin/main';
  }
};

/** Raw cumulative diff from `base..HEAD`. */
export const getCumulativeDiff = (base: string): string => {
  return execFileSync('git', ['diff', `${base}..HEAD`], { encoding: 'utf8' });
};

export const computeReviewHash = (): string => {
  return hashDiff(getCumulativeDiff(resolveBase()));
};
