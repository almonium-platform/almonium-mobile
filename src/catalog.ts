/**
 * The catalogue search (W1, W2): every notable book, metadata only, so a search that the library
 * cannot answer still says what exists and what the reader can do about it. Mirrors the web client.
 */
export const catalogStates = ['ON_SHELF', 'NOT_IN_YOUR_COUNTRY', 'WANTABLE', 'UNDER_COPYRIGHT'] as const;
export type CatalogState = (typeof catalogStates)[number];

export interface CatalogHit {
  id: string;
  title: string;
  originalTitle: string | null;
  originalLanguage: string | null;
  author: string | null;
  year: number | null;
  state: CatalogState;
  /** The shelf work it is linked to, when there is one. */
  workSlug: string | null;
  /** The year it became free (WANTABLE) or the soonest it can (UNDER_COPYRIGHT); null when unknown. */
  freeFrom: number | null;
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Keeps the hits the screen can show; a row with no id, no title or an unknown state is dropped. */
export function parseCatalogHits(value: unknown): CatalogHit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): CatalogHit[] => {
    if (!entry || typeof entry !== 'object') return [];
    const data = entry as Record<string, unknown>;
    const id = text(data.id);
    const title = text(data.title);
    const state = catalogStates.find((candidate) => candidate === data.state);
    if (!id || !title || !state) return [];
    return [{
      id,
      title,
      originalTitle: text(data.originalTitle),
      originalLanguage: text(data.originalLanguage),
      author: text(data.author),
      year: number(data.year),
      state,
      workSlug: text(data.workSlug),
      freeFrom: number(data.freeFrom),
    }];
  });
}

/** What the "Not on the shelf yet" section shows for one search. */
export interface CatalogResultsPlan {
  /** The best hit, when it is under copyright: one plain card above the rows. */
  copyright: CatalogHit | null;
  /** Works the reader could want, or learns are not for their country. The library already lists the rest. */
  rows: CatalogHit[];
}

/**
 * Books on the shelf are already in the library above; a book under copyright earns the card only
 * when it is the best hit, because the reader most likely meant it, and is left out otherwise.
 */
export function planCatalogResults(hits: readonly CatalogHit[]): CatalogResultsPlan {
  const best = hits[0];
  return {
    copyright: best?.state === 'UNDER_COPYRIGHT' ? best : null,
    rows: hits.filter((hit) => hit.state === 'WANTABLE' || hit.state === 'NOT_IN_YOUR_COUNTRY'),
  };
}

/** "author · year", whichever of the two is known. */
export function catalogMeta(hit: Pick<CatalogHit, 'author' | 'year'>): string {
  return [hit.author, hit.year === null ? null : String(hit.year)].filter(Boolean).join(' · ');
}

/** The catalogue folds accents and punctuation and needs two characters of what is left. */
export function isCatalogQuery(query: string): boolean {
  return query.normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '').length >= 2;
}
