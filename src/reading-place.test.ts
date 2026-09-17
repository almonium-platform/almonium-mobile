import { describe, expect, it } from 'vitest';

import { parsePlaces, trimPlaces } from './reading-place';

describe('reading places', () => {
  it('keeps only well-formed places', () => {
    expect(parsePlaces({ a: { chapter: 3, total: 24, at: '2026-09-17' }, b: { chapter: 0, total: 5 }, c: { chapter: 9, total: 4 }, d: 'x' }))
      .toEqual({ a: { chapter: 3, total: 24, at: '2026-09-17' } });
    expect(parsePlaces(null)).toEqual({});
  });
  it('drops the oldest past the cap', () => {
    const places = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`b${index}`, { chapter: 1, total: 2, at: `2026-09-1${index}` }]));
    expect(Object.keys(trimPlaces(places, 3))).toEqual(['b4', 'b3', 'b2']);
  });
});
