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
  /**
   * Set only when exact: the year it becomes free in Ukraine and Germany, from 1 January
   * (UNDER_COPYRIGHT), or the year it became free (WANTABLE); null otherwise.
   */
  freeFrom: number | null;
  /** How many readers want it in the searched language; null below three, or with no language. */
  readers: number | null;
  /** Whether this reader wants it in the searched language; always false for a guest. */
  wantedByMe: boolean;
  /** The reader's country as the server placed them, ISO 3166 alpha-2; null when it did not say. */
  readerCountry: string | null;
  /**
   * The year the reader can open it, from 1 January: free where we make books and in their own
   * country, when both are exact (W6). Null when unknown, and when it is already free.
   */
  readerFreeFrom: number | null;
  /** Up to three countries where it is already free, best known first; empty unless under copyright. */
  freeIn: string[];
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
      readers: number(data.readers),
      wantedByMe: data.wantedByMe === true,
      readerCountry: text(data.readerCountry),
      readerFreeFrom: number(data.readerFreeFrom),
      freeIn: Array.isArray(data.freeIn) ? data.freeIn.flatMap((code) => (typeof code === 'string' ? [code] : [])) : [],
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

/** Whether a work is free in one country this year, the year it frees up when exact, and the rule (W7). */
export const rightsStatuses = ['FREE', 'PROTECTED', 'UNKNOWN'] as const;
export type RightsStatus = (typeof rightsStatuses)[number];

export interface CountryUnlock {
  /** ISO 3166 alpha-2. */
  country: string;
  status: RightsStatus;
  year: number | null;
  rule: string;
}

/** The unlock list's data for one work: every country, plus the reader's own place and day. */
export interface WorkUnlocks {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  readerCountry: string | null;
  readerFreeFrom: number | null;
  countries: CountryUnlock[];
}

/** Reads the answer; a country row with no code or an unknown status is dropped. */
export function parseWorkUnlocks(value: unknown): WorkUnlocks | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const id = text(data.id);
  const title = text(data.title);
  if (!id || !title) return null;
  const countries = Array.isArray(data.countries)
    ? data.countries.flatMap((entry): CountryUnlock[] => {
      if (!entry || typeof entry !== 'object') return [];
      const row = entry as Record<string, unknown>;
      const country = text(row.country);
      const status = rightsStatuses.find((candidate) => candidate === row.status);
      if (!country || !status) return [];
      return [{ country, status, year: number(row.year), rule: text(row.rule) ?? '' }];
    })
    : [];
  return {
    id,
    title,
    author: text(data.author),
    year: number(data.year),
    readerCountry: text(data.readerCountry),
    readerFreeFrom: number(data.readerFreeFrom),
    countries,
  };
}

/** Countries grouped by the year they free the work, soonest first; the ones with no year last (W7's list form). */
export interface UnlockYearGroup {
  year: number | null;
  countries: CountryUnlock[];
}

export function groupUnlocksByYear(unlocks: readonly CountryUnlock[]): UnlockYearGroup[] {
  const byYear = new Map<number | null, CountryUnlock[]>();
  for (const unlock of unlocks) {
    const key = unlock.status === 'UNKNOWN' ? null : unlock.year;
    byYear.set(key, [...(byYear.get(key) ?? []), unlock]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([year, countries]) => ({ year, countries }));
}

/** A country named in the phone's language; the code itself where the runtime cannot name it. */
export function countryName(code: string, locale?: string): string {
  try {
    const names = new Intl.DisplayNames(locale ? [locale, 'en'] : ['en'], { type: 'region', fallback: 'none' });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
