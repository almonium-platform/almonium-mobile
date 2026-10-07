import type { CatalogHit } from './catalog';
import { t } from './i18n';

/**
 * Public Domain Day: a work becomes free where we make books (Ukraine and Germany) on 1 January,
 * and the catalogue knows the exact year. Counting is by the reader's local calendar date, so the
 * countdown turns over at their midnight. Mirrors the web client's copy.
 */

const dayMs = 86_400_000;

/** The next 1 January: the year the countdown on the Wanted page is for. */
export function publicDomainDayYear(today: Date = new Date()): number {
  return today.getFullYear() + 1;
}

/** Whole local days from today to 1 January of `year`; daylight-saving shifts do not count. */
export function daysUntilJanuaryFirst(year: number, today: Date = new Date()): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(year, 0, 1) - start) / dayMs);
}

/** "Free in N days", to 1 January of `year`. */
export function freeInDaysLabel(year: number, today: Date = new Date()): string {
  return t('{count, plural, one {Free in # day} other {Free in # days}}', { count: daysUntilJanuaryFirst(year, today) });
}

/** "Free on 1 January 2047". The year is passed as text, so it never gains a thousands separator. */
export function freeOnLabel(year: number): string {
  return t('Free on 1 January {year}', { year: String(year) });
}

/**
 * The line a catalogue hit carries about its year: a work under copyright counts down when it is
 * free next January and names the date when it is later; a wantable work that became free this
 * January says so. Anything else, or a year the server does not know exactly, says nothing.
 */
export function freeFromLabel(hit: Pick<CatalogHit, 'state' | 'freeFrom'>, today: Date = new Date()): string | null {
  if (hit.freeFrom === null) return null;
  const year = today.getFullYear();
  if (hit.state === 'UNDER_COPYRIGHT') {
    if (hit.freeFrom === year + 1) return freeInDaysLabel(hit.freeFrom, today);
    return hit.freeFrom > year + 1 ? freeOnLabel(hit.freeFrom) : null;
  }
  return hit.state === 'WANTABLE' && hit.freeFrom === year ? t('Free since 1 January') : null;
}
