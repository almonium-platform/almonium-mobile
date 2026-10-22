import { describe, expect, it } from 'vitest';

import { daysUntilJanuaryFirst, freeFromLabel, freeInDaysLabel, freeOnLabel, inArrivalSeason, inUnlockSeason, liveCountdown, publicDomainDayYear, readerFreeNote, unlockGroupLabel } from './public-domain';

/** Local dates, as the reader's phone sees them. */
const date = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour);

describe('daysUntilJanuaryFirst', () => {
  it('counts whole local days to the next 1 January', () => {
    expect(daysUntilJanuaryFirst(2027, date(2026, 10, 9))).toBe(84);
    expect(daysUntilJanuaryFirst(2027, date(2026, 12, 31, 23))).toBe(1);
    expect(daysUntilJanuaryFirst(2027, date(2026, 12, 31, 0))).toBe(1);
    expect(daysUntilJanuaryFirst(2027, date(2026, 3, 1))).toBe(306);
  });

  it('names the coming year', () => {
    expect(publicDomainDayYear(date(2026, 10, 8))).toBe(2027);
    expect(publicDomainDayYear(date(2027, 1, 1, 0))).toBe(2028);
  });
});

describe('labels', () => {
  it('counts down and names the date without a thousands separator', () => {
    expect(freeInDaysLabel(2027, date(2026, 10, 9))).toBe('Free in 84 days');
    expect(freeInDaysLabel(2027, date(2026, 12, 31))).toBe('Free in 1 day');
    expect(freeOnLabel(2047)).toBe('Free on 1 January 2047');
  });
});

describe('freeFromLabel', () => {
  const today = date(2026, 10, 9);

  it('counts down a work under copyright that is free next January', () => {
    expect(freeFromLabel({ state: 'UNDER_COPYRIGHT', freeFrom: 2027 }, today)).toBe('Free in 84 days');
  });

  it('names the date of a later year', () => {
    expect(freeFromLabel({ state: 'UNDER_COPYRIGHT', freeFrom: 2047 }, today)).toBe('Free on 1 January 2047');
  });

  it('says nothing when the year is unknown or already past', () => {
    expect(freeFromLabel({ state: 'UNDER_COPYRIGHT', freeFrom: null }, today)).toBeNull();
    expect(freeFromLabel({ state: 'UNDER_COPYRIGHT', freeFrom: 2026 }, today)).toBeNull();
  });

  it('marks a wantable work that became free this January, and only that', () => {
    expect(freeFromLabel({ state: 'WANTABLE', freeFrom: 2026 }, today)).toBe('Free since 1 January');
    expect(freeFromLabel({ state: 'WANTABLE', freeFrom: 1942 }, today)).toBeNull();
    expect(freeFromLabel({ state: 'WANTABLE', freeFrom: null }, today)).toBeNull();
    expect(freeFromLabel({ state: 'NOT_IN_YOUR_COUNTRY', freeFrom: 2026 }, today)).toBeNull();
    expect(freeFromLabel({ state: 'ON_SHELF', freeFrom: 2027 }, today)).toBeNull();
  });
});

describe('the unlock countdown (W6, W8)', () => {
  const at = (year: number, month: number, day: number, hour = 12, minute = 0, second = 0) => new Date(year, month - 1, day, hour, minute, second);

  it('counts what is left to midnight on 1 January by the phone’s clock', () => {
    expect(liveCountdown(2027, at(2026, 12, 31, 23, 59, 30))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 30, lastDay: true });
    expect(liveCountdown(2027, at(2026, 12, 30, 22))).toEqual({ days: 1, hours: 2, minutes: 0, seconds: 0, lastDay: false });
    expect(liveCountdown(2027, at(2027, 1, 1, 0, 0, 1))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, lastDay: true });
  });

  it('counts down live within five years and names the date beyond', () => {
    const today = at(2026, 10, 22);
    expect(readerFreeNote(2027, today)).toEqual({ kind: 'live', year: 2027 });
    expect(readerFreeNote(2032, today)).toEqual({ kind: 'date', year: 2032 });
    expect(readerFreeNote(2026, today)).toBeNull();
    expect(readerFreeNote(null, today)).toBeNull();
  });

  it('knows the rail’s seasons and labels a group of the unlock list', () => {
    expect(inUnlockSeason(at(2026, 9, 30))).toBe(false);
    expect(inUnlockSeason(at(2026, 10, 1))).toBe(true);
    expect(inArrivalSeason(at(2027, 1, 30))).toBe(true);
    expect(inArrivalSeason(at(2027, 1, 31))).toBe(false);
    expect(unlockGroupLabel(2007, at(2026, 10, 22))).toBe('Free since 2007');
    expect(unlockGroupLabel(2027, at(2026, 10, 22))).toBe('Free from 1 January 2027');
    expect(unlockGroupLabel(null, at(2026, 10, 22))).toBe('Not checked yet');
  });
});
