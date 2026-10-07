import { describe, expect, it } from 'vitest';

import { daysUntilJanuaryFirst, freeFromLabel, freeInDaysLabel, freeOnLabel, publicDomainDayYear } from './public-domain';

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
