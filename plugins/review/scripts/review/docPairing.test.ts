import { describe, it, expect } from 'vitest';
import { findStaleDocs } from './docPairing';
import type { DocPairConfig } from './config';

const pairs: DocPairConfig[] = [{ code: 'src/styles/**', doc: 'docs/DESIGN.md', severity: 'major' }];

describe('findStaleDocs', () => {
  it('flags a triggered pair whose doc is missing', () => {
    expect(findStaleDocs(['src/styles/app.scss'], pairs)).toHaveLength(1);
  });

  it('is satisfied when the doc is also changed', () => {
    expect(findStaleDocs(['src/styles/app.scss', 'docs/DESIGN.md'], pairs)).toHaveLength(0);
  });

  it('ignores untriggered pairs', () => {
    expect(findStaleDocs(['README.md'], pairs)).toHaveLength(0);
  });
});
