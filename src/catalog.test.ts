import { describe, expect, it } from 'vitest';

import { type CatalogHit, catalogMeta, countryName, groupUnlocksByYear, isCatalogQuery, parseCatalogHits, parseWorkUnlocks, planCatalogResults } from './catalog';

function hit(id: string, state: CatalogHit['state'], extra: Partial<CatalogHit> = {}): CatalogHit {
  return { id, title: `Book ${id}`, originalTitle: null, originalLanguage: null, author: null, year: null, state, workSlug: null, freeFrom: null, readers: null, wantedByMe: false, readerCountry: null, readerFreeFrom: null, freeIn: [], ...extra };
}

describe('parseCatalogHits', () => {
  it('reads the server rows and drops the ones the screen cannot show', () => {
    expect(parseCatalogHits([
      { id: 'q1', title: 'Ulysses', originalTitle: 'Ulysses', originalLanguage: 'EN', author: 'James Joyce', year: 1922, state: 'WANTABLE', workSlug: 'ulysses', freeFrom: 1942, readers: 4, wantedByMe: true },
      { id: 'q2', title: 'Untitled', state: 'SOMETHING_NEW' },
      { title: 'No id', state: 'WANTABLE' },
      null,
    ])).toEqual([
      { id: 'q1', title: 'Ulysses', originalTitle: 'Ulysses', originalLanguage: 'EN', author: 'James Joyce', year: 1922, state: 'WANTABLE', workSlug: 'ulysses', freeFrom: 1942, readers: 4, wantedByMe: true, readerCountry: null, readerFreeFrom: null, freeIn: [] },
    ]);
    expect(parseCatalogHits({ message: 'nope' })).toEqual([]);
  });

  it('reads a hidden reader count as null and anything but true as not wanted', () => {
    expect(parseCatalogHits([{ id: 'q1', title: 'Emma', state: 'WANTABLE', readers: null, wantedByMe: 'yes' }])[0])
      .toMatchObject({ readers: null, wantedByMe: false });
  });
});

describe('planCatalogResults', () => {
  it('puts a best hit under copyright on its own card and lists what can be wanted or is blocked', () => {
    const plan = planCatalogResults([hit('a', 'UNDER_COPYRIGHT'), hit('b', 'ON_SHELF'), hit('c', 'WANTABLE'), hit('d', 'NOT_IN_YOUR_COUNTRY'), hit('e', 'UNDER_COPYRIGHT')]);
    expect(plan.copyright?.id).toBe('a');
    expect(plan.rows.map((row) => row.id)).toEqual(['c', 'd']);
  });

  it('leaves a lower hit under copyright out entirely', () => {
    expect(planCatalogResults([hit('a', 'WANTABLE'), hit('b', 'UNDER_COPYRIGHT')]).copyright).toBeNull();
    expect(planCatalogResults([])).toEqual({ copyright: null, rows: [] });
  });
});

describe('catalogMeta', () => {
  it('joins author and year, whichever is known', () => {
    expect(catalogMeta({ author: 'Tolstoy', year: 1869 })).toBe('Tolstoy · 1869');
    expect(catalogMeta({ author: null, year: 1869 })).toBe('1869');
    expect(catalogMeta({ author: 'Tolstoy', year: null })).toBe('Tolstoy');
  });
});

describe('isCatalogQuery', () => {
  it('needs two letters or digits after folding', () => {
    expect(isCatalogQuery('é')).toBe(false);
    expect(isCatalogQuery(' - ')).toBe(false);
    expect(isCatalogQuery('Об')).toBe(true);
    expect(isCatalogQuery('19')).toBe(true);
  });
});

describe('the unlock list (W7)', () => {
  it('reads the reader fields on a hit, with every one allowed to be missing', () => {
    const [hit] = parseCatalogHits([{ id: 'p', title: 'Winnie-the-Pooh', state: 'UNDER_COPYRIGHT', readerCountry: 'DE', readerFreeFrom: 2027, freeIn: ['US', 7, 'CA'] }]);
    expect(hit).toMatchObject({ readerCountry: 'DE', readerFreeFrom: 2027, freeIn: ['US', 'CA'] });
    expect(parseCatalogHits([{ id: 'q', title: 'X', state: 'WANTABLE' }])[0]).toMatchObject({ readerCountry: null, readerFreeFrom: null, freeIn: [] });
  });

  it('reads the answer and groups countries by the year they free the work, unknown last', () => {
    const unlocks = parseWorkUnlocks({
      id: 'w', title: 'Winnie-the-Pooh', author: 'A. A. Milne', year: 1926, readerCountry: 'DE', readerFreeFrom: 2027,
      countries: [
        { country: 'CA', status: 'FREE', year: 2007, rule: 'Life + 50' },
        { country: 'DE', status: 'PROTECTED', year: 2027, rule: "Author's life + 70 years" },
        { country: 'XK', status: 'UNKNOWN', year: null, rule: '' },
        { country: 'US', status: 'FREE', year: 2022, rule: '95 years after publication' },
        { country: '', status: 'FREE', year: 2000, rule: '' },
        { country: 'ZZ', status: 'LOCKED', year: null, rule: '' },
      ],
    });
    expect(unlocks?.readerFreeFrom).toBe(2027);
    expect(groupUnlocksByYear(unlocks!.countries).map((group) => [group.year, group.countries.map((c) => c.country)]))
      .toEqual([[2007, ['CA']], [2022, ['US']], [2027, ['DE']], [null, ['XK']]]);
    expect(parseWorkUnlocks({ title: 'no id' })).toBeNull();
  });

  it('names a country or falls back to its code', () => {
    expect(countryName('DE', 'en')).toBe('Germany');
    expect(countryName('??', 'en')).toBe('??');
  });
});
