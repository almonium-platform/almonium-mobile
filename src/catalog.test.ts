import { describe, expect, it } from 'vitest';

import { type CatalogHit, catalogMeta, isCatalogQuery, parseCatalogHits, planCatalogResults } from './catalog';

function hit(id: string, state: CatalogHit['state'], extra: Partial<CatalogHit> = {}): CatalogHit {
  return { id, title: `Book ${id}`, originalTitle: null, originalLanguage: null, author: null, year: null, state, workSlug: null, freeFrom: null, readers: null, wantedByMe: false, ...extra };
}

describe('parseCatalogHits', () => {
  it('reads the server rows and drops the ones the screen cannot show', () => {
    expect(parseCatalogHits([
      { id: 'q1', title: 'Ulysses', originalTitle: 'Ulysses', originalLanguage: 'EN', author: 'James Joyce', year: 1922, state: 'WANTABLE', workSlug: 'ulysses', freeFrom: 1942, readers: 4, wantedByMe: true },
      { id: 'q2', title: 'Untitled', state: 'SOMETHING_NEW' },
      { title: 'No id', state: 'WANTABLE' },
      null,
    ])).toEqual([
      { id: 'q1', title: 'Ulysses', originalTitle: 'Ulysses', originalLanguage: 'EN', author: 'James Joyce', year: 1922, state: 'WANTABLE', workSlug: 'ulysses', freeFrom: 1942, readers: 4, wantedByMe: true },
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
