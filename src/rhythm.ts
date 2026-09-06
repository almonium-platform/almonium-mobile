/**
 * The harness: the bar a learner sets for one language and whether they cleared it. These are
 * the same shapes and rules the web client reads, ported so a fraction can never disagree with
 * itself across clients. Keep this module free of React imports so the rules stay unit-testable.
 */

/** Days per week asked of one language. `null` means never chosen; 0 is the deliberate "no target". */
export type WeeklyTarget = number | null;

/** The targets the backend accepts, in the order the harness offers them. */
export const targetOptions: { value: number; label: string; note?: string }[] = [
  { value: 1, label: 'Once a week' },
  { value: 2, label: 'Twice a week' },
  { value: 4, label: 'Four times a week' },
  { value: 0, label: 'No target', note: 'Keep the record, drop the bar' },
];

/** Weeks kept against weeks asked for, fixed at a moment rather than rolling. */
export interface PaceSnapshot {
  met: number;
  counted: number;
}

export interface RhythmDay {
  date: string;
  /** Texture for the band's tint, never a threshold for whether the day counts. */
  minutes: number;
  met: boolean;
}

export interface RhythmWeek {
  weekStart: string;
  daysMet: number;
  met: boolean;
  /** A week after the language was set aside: neither met nor missed, because nothing was asked of it. */
  frozen: boolean;
  days: RhythmDay[];
}

/** One language's harness. A set-aside language keeps its record, read-only. */
export interface LanguageRhythm {
  language: string;
  target: WeeklyTarget;
  editable: boolean;
  startedAt: string;
  setAsideAt: string | null;
  firstSessionAt: string | null;
  frozenPace: PaceSnapshot | null;
  /** Oldest first, ending with the week in progress. */
  weeks: RhythmWeek[];
}

export interface Rhythm {
  languages: LanguageRhythm[];
}

export type ActivitySource = 'READ' | 'REVIEW' | 'PLAY';

export interface LearningActivity {
  source: ActivitySource;
  language: string;
  /** Active seconds since the previous report, already idle-filtered by the client. */
  seconds: number;
  /** The learner's own calendar date, so days are theirs rather than UTC's. */
  localDate: string;
  /** Whether this report closes a discrete event, such as a finished review session. */
  completed: boolean;
}

/** The learner's own calendar date, so a day belongs to them rather than to UTC. */
export function localDate(date: Date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function hasTarget(target: WeeklyTarget): target is number {
  return target !== null && target > 0;
}

export function cadenceLabel(target: WeeklyTarget) {
  if (target === null) return 'No pace set';
  return targetOptions.find((option) => option.value === target)?.label ?? `${target} times a week`;
}

const numberWords = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** The record speaks in words, not figures: it is a sentence about a person, not a readout. */
export function numberWord(value: number) {
  return numberWords[value] ?? `${value}`;
}

/** The Monday the given day belongs to, so a start date can be compared with a week's start. */
function weekStartOf(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return localDate(parsed);
}

/**
 * Only the weeks that were ever asked of: from the first session onwards, and not while the
 * language was set aside. A week before a language was ever learned in, or after it was put
 * down, is not a week it missed.
 */
export function trackedWeeks(rhythm: LanguageRhythm) {
  if (rhythm.firstSessionAt === null) return [];
  const start = weekStartOf(rhythm.firstSessionAt);
  return rhythm.weeks.filter((week) => week.weekStart >= start && !week.frozen);
}

/** The weeks a card actually shows. Twelve is what every surface talks about. */
export function bandWeeks(rhythm: LanguageRhythm, count = 12) {
  return rhythm.weeks.slice(-count);
}

/**
 * Weeks kept against weeks asked for, over the weeks on show. A young language is not judged
 * against twelve and a set-aside one collects no misses.
 */
export function paceFraction(rhythm: LanguageRhythm, count = 12): PaceSnapshot {
  // A language that has stopped moving keeps the fraction it had when it was put down; a
  // rolling window over it would decay to 0/0, which reads as a fault rather than a record.
  if (rhythm.frozenPace) return rhythm.frozenPace;
  const tracked = trackedWeeks(rhythm);
  const counted = bandWeeks(rhythm, count).filter((week) => tracked.includes(week));
  return { met: counted.filter((week) => week.met).length, counted: counted.length };
}

export function weekMinutes(week: RhythmWeek) {
  return week.days.reduce((total, day) => total + day.minutes, 0);
}

/** Time learning that week, in the six steps the ramp draws. */
export function weekLevel(week: RhythmWeek) {
  if (week.frozen) return 0;
  const minutes = weekMinutes(week);
  if (minutes >= 240) return 5;
  if (minutes >= 120) return 4;
  if (minutes >= 60) return 3;
  if (minutes >= 30) return 2;
  if (minutes > 0 || week.daysMet > 0) return 1;
  return 0;
}

/** Nothing has been learned yet: the empty record shows but offers no target control. */
export function isEmptyRecord(rhythm: LanguageRhythm) {
  return rhythm.firstSessionAt === null && rhythm.target === null;
}

/**
 * The one-sentence record, in the register the web uses: weeks met against the target, then
 * what the tint means. A set-aside language names the date and refuses to count the weeks since.
 */
export function rhythmSummary(rhythm: LanguageRhythm, languageName: string) {
  const pace = paceFraction(rhythm);
  const bar = hasTarget(rhythm.target)
    ? ` met your target of ${cadenceLabel(rhythm.target).toLowerCase()}`
    : ' had time learning in them';
  if (rhythm.setAsideAt) {
    return `${numberWord(pace.met)} ${pace.met === 1 ? 'week' : 'weeks'}${bar} before you set ${languageName} aside on ${formatDay(rhythm.setAsideAt)}. The weeks since are not counted against you.`;
  }
  if (pace.counted === 0) {
    return 'Twelve weeks, filling in as you learn. You can set a target once there is something to measure.';
  }
  return `${numberWord(pace.met)} of the last ${numberWord(pace.counted).toLowerCase()} ${pace.counted === 1 ? 'week' : 'weeks'}${bar}. Tint shows time learning, not a score.`;
}

export function formatDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/**
 * Time on task, idle-filtered the way the reader reports it: a stretch longer than the idle gap
 * is a phone put down, and counts nothing.
 */
export class ActivityMeter {
  private lastTick: number | null = null;
  private accumulated = 0;

  constructor(private readonly idleGapMs = 90_000) {}

  /** Register that the learner is still at it. Returns nothing; read `take()` when reporting. */
  tick(now = Date.now()) {
    if (this.lastTick !== null) {
      const gap = now - this.lastTick;
      if (gap > 0 && gap <= this.idleGapMs) this.accumulated += gap;
    }
    this.lastTick = now;
  }

  /** Seconds since the last take, capped at what the backend accepts in one report. */
  take() {
    const seconds = Math.min(3600, Math.floor(this.accumulated / 1000));
    this.accumulated -= seconds * 1000;
    return seconds;
  }

  pause() {
    this.lastTick = null;
  }
}
