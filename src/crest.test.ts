import { describe, expect, it } from 'vitest';

import { crestFor, crestRamp, defaultCrest, ensurePaletteColours, languageColours, mix } from './crest';

describe('crest colours', () => {
  it('ships the eight web hues and nothing else', () => {
    expect(languageColours).toHaveLength(8);
    expect(languageColours[0].hex).toBe('#a66f5a');
    expect(languageColours[7].hex).toBe('#a56775');
  });

  it('assigns free swatches in order and keeps what is already on the palette', () => {
    const colours = ensurePaletteColours({}, ['DE', 'UK']);
    expect(colours).toEqual({ DE: '#a66f5a', UK: '#9a8146' });
    const next = ensurePaletteColours({ DE: '#638565', UK: '#00ff00' }, ['DE', 'UK']);
    expect(next.DE).toBe('#638565');
    expect(next.UK).toBe('#a66f5a');
  });

  it('returns the same object when nothing changed', () => {
    const colours = { DE: '#a66f5a' };
    expect(ensurePaletteColours(colours, ['DE'])).toBe(colours);
  });

  it('falls back to the web default for an unknown language', () => {
    expect(crestFor({}, 'FR')).toBe(defaultCrest);
    expect(crestFor({ FR: '#638565' }, 'FR')).toBe('#638565');
  });

  it('draws six steps from the ground to the full hue', () => {
    const ramp = crestRamp('#a66f5a', '#F9F6F5', '#f1ecef');
    expect(ramp).toHaveLength(6);
    expect(ramp[0]).toBe('#f1ecef');
    expect(ramp[5]).toBe('#a66f5a');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
