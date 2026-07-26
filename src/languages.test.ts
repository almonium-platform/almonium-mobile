import { describe, expect, it } from 'vitest';

import { languageName, sortLanguages } from './languages';

describe('languages', () => {
  it('uses friendly names and safely falls back to the code', () => {
    expect(languageName('DE')).toBe('German');
    expect(languageName('BHO')).toBe('BHO');
  });

  it('sorts by display name without mutating the API response', () => {
    const input = ['ES', 'DE', 'EN'];
    expect(sortLanguages(input)).toEqual(['EN', 'DE', 'ES']);
    expect(input).toEqual(['ES', 'DE', 'EN']);
  });
});
