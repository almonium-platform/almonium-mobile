import { describe, expect, it } from 'vitest';

import {
  ActivityMeter,
  cadenceLabel,
  isEmptyRecord,
  localDate,
  paceFraction,
  rhythmSummary,
  targetOptions,
  weekLevel,
  type LanguageRhythm,
  type RhythmWeek,
} from './rhythm';

function week(weekStart: string, minutes: number, met: boolean, frozen = false): RhythmWeek {
  return {
    weekStart,
    daysMet: met ? 2 : minutes > 0 ? 1 : 0,
    met,
    frozen,
    days: [{ date: weekStart, minutes, met }],
  };
}

const german: LanguageRhythm = {
  language: 'DE',
  target: 2,
  editable: true,
  startedAt: '2026-06-01',
  setAsideAt: null,
  firstSessionAt: '2026-06-17',
  frozenPace: null,
  weeks: [
    week('2026-06-08', 0, false),
    week('2026-06-15', 40, true),
    week('2026-06-22', 130, true),
    week('2026-06-29', 0, false),
    week('2026-07-06', 250, true),
  ],
};

describe('rhythm', () => {
  it('offers the four targets the backend accepts', () => {
    expect(targetOptions.map((option) => option.value)).toEqual([1, 2, 4, 0]);
    expect(cadenceLabel(2)).toBe('Twice a week');
    expect(cadenceLabel(null)).toBe('No pace set');
  });

  it('counts only weeks from the first session onward', () => {
    expect(paceFraction(german)).toEqual({ met: 3, counted: 4 });
  });

  it('keeps the frozen fraction of a set-aside language', () => {
    const aside = { ...german, setAsideAt: '2026-07-10', frozenPace: { met: 6, counted: 7 } };
    expect(paceFraction(aside)).toEqual({ met: 6, counted: 7 });
    expect(rhythmSummary(aside, 'German')).toContain('before you set German aside');
    expect(rhythmSummary(aside, 'German')).toContain('not counted against you');
  });

  it('draws six tint steps from time learning and never from a threshold', () => {
    expect(weekLevel(week('2026-06-08', 0, false))).toBe(0);
    expect(weekLevel(week('2026-06-08', 5, false))).toBe(1);
    expect(weekLevel(week('2026-06-08', 40, true))).toBe(2);
    expect(weekLevel(week('2026-06-08', 130, true))).toBe(4);
    expect(weekLevel(week('2026-06-08', 400, true))).toBe(5);
    expect(weekLevel(week('2026-06-08', 400, true, true))).toBe(0);
  });

  it('speaks in words and names the tint honestly', () => {
    expect(rhythmSummary(german, 'German')).toBe(
      'Three of the last four weeks met your target of twice a week. Tint shows time learning, not a score.',
    );
    expect(isEmptyRecord({ ...german, target: null, firstSessionAt: null })).toBe(true);
    expect(isEmptyRecord(german)).toBe(false);
  });

  it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 8, 7, 23, 30))).toBe('2026-09-07');
  });

  it('meters active time and drops idle gaps', () => {
    const meter = new ActivityMeter(10_000);
    meter.tick(0);
    meter.tick(4_000);
    meter.tick(30_000);
    meter.tick(33_000);
    expect(meter.take()).toBe(7);
    expect(meter.take()).toBe(0);
  });
});
