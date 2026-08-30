import { describe, expect, it } from 'vitest';

import { normalizedLookupEntry, tokenizeSentence } from './discover';

describe('discover text handling', () => {
  it('keeps words with apostrophes and dashes intact', () => {
    expect(tokenizeSentence("L'été d'aujourd’hui — très-bien.")).toEqual([
      "L'été",
      "d'aujourd’hui",
      'très-bien',
    ]);
  });

  it('removes punctuation around a lookup entry', () => {
    expect(normalizedLookupEntry('“verließ.”')).toBe('verließ');
  });
});
