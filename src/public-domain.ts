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

/** How many calendar years ahead a day may be for a card to count down to it; further out it names the date. */
export const countdownYears = 5;

/** What is left until midnight on 1 January, by the phone's clock (W6). */
export interface LiveCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Under a day away: the days tile is dropped. */
  lastDay: boolean;
}

export function liveCountdown(year: number, now: Date = new Date()): LiveCountdown {
  const midnight = new Date(year, 0, 1, 0, 0, 0, 0);
  const left = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const days = Math.floor(left / 86_400);
  return { days, hours: Math.floor((left % 86_400) / 3600), minutes: Math.floor((left % 3600) / 60), seconds: left % 60, lastDay: days === 0 };
}

/** What a reader's own unlock year says: a live countdown within five years, the date beyond; null when unknown or past. */
export type ReaderFreeNote = { kind: 'live'; year: number } | { kind: 'date'; year: number };

export function readerFreeNote(readerFreeFrom: number | null, today: Date = new Date()): ReaderFreeNote | null {
  if (readerFreeFrom === null) return null;
  const year = today.getFullYear();
  if (readerFreeFrom <= year) return null;
  return readerFreeFrom - year <= countdownYears ? { kind: 'live', year: readerFreeFrom } : { kind: 'date', year: readerFreeFrom };
}

/** The shelf's seasonal rail (W8) shows from 1 October to 31 December. */
export function inUnlockSeason(today: Date = new Date()): boolean {
  return today.getMonth() >= 9;
}

/** The first thirty days of a year: next year's arrivals have become this year's. */
export function inArrivalSeason(today: Date = new Date()): boolean {
  return today.getMonth() === 0 && today.getDate() <= 30;
}

/** "Free since 2007", "Free from 1 January 2027" or "Not checked yet": one group of the unlock list (W7). */
export function unlockGroupLabel(year: number | null, today: Date = new Date()): string {
  if (year === null) return t('Not checked yet');
  return year <= today.getFullYear() ? t('Free since {year}', { year: String(year) }) : freeOnLabel(year).replace(/^Free on/, t('Free from'));
}
