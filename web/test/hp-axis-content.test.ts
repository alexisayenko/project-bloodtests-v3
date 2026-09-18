import { describe, it, expect } from 'vitest';
import { HP_AXIS_HTML } from '../src/components/reference/hpAxisContent';

describe('hpAxisContent', () => {
  it('carries the verbatim v2 prose: prolactin section, cascades, source', () => {
    expect(HP_AXIS_HTML).toContain('Prolactin (PRL)');
    expect(HP_AXIS_HTML).toContain('HP axes — feedback loops');
    expect(HP_AXIS_HTML).toContain('Bhasin');
  });
});
