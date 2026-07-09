import type { DocPairConfig } from './config';

/** Minimal glob → RegExp: `**` matches across path separators, `*` within a segment. No deps. */
const globToRegExp = (glob: string): RegExp => {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*');
  return new RegExp(`^${pattern}`);
};

/** Pairs whose `code` glob matched a changed path but whose `doc` was NOT also in the changed set. */
export const findStaleDocs = (changedPaths: string[], pairs: DocPairConfig[]): DocPairConfig[] => {
  return pairs.filter((pair) => {
    const trigger = globToRegExp(pair.code);
    const triggered = changedPaths.some((path) => trigger.test(path));
    const satisfied = changedPaths.some((path) => path.includes(pair.doc));
    return triggered && !satisfied;
  });
};
