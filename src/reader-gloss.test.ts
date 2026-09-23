import { describe, expect, it } from 'vitest';

import { glossScript } from './reader-gloss';

describe('reader gloss runtime', () => {
  it('sends only a bounded reviewed note when its anchor is tapped', () => {
    expect(() => new Function(glossScript)).not.toThrow();
    expect(glossScript).toContain(".almonium-gloss[data-gloss-note]");
    expect(glossScript).toContain("type: 'gloss'");
    expect(glossScript).toContain('body.length > 500');
  });
});
