import { t } from './i18n';
import { languageName } from './languages';
import type { CefrLevel } from './types';

/**
 * Wanted books (W1–W4): a reader wants a catalogue work in the language they would read it in,
 * and every want joins one public queue ranked by readers. Wanting is free; it promises a place
 * in the order, nothing else. Mirrors the web client.
 */
export const wantStatuses = ['OPEN', 'IN_PROGRESS', 'ARRIVED', 'DECLINED'] as const;
export type WantStatus = (typeof wantStatuses)[number];

export interface WantedRow {
  catalogWorkId: string;
  title: string;
  author: string | null;
  language: string;
  /** Set when the shelf already has the work in another language: the row is a new edition. */
  workSlug: string | null;
  rank: number;
  /** Null below three, so a lone want never reads as "1 reader". */
  readers: number | null;
  wantedByMe: boolean;
  status: WantStatus;
  /**
   * For a work being prepared from a free text, how many of the four stages are done, in order
   * (0–4); null otherwise, and then the card shows no bars.
   */
  stagesDone: number | null;
}

export interface ArrivedRow {
  catalogWorkId: string;
  title: string;
  author: string | null;
  language: string;
  editionSlug: string;
  cefrLevel: CefrLevel | null;
  coverUrl: string | null;
  arrivedAt: string | null;
}

export interface WantedQueue {
  /** At most two works editorial has started. */
  beingPrepared: WantedRow[];
  queue: WantedRow[];
  /** Wanted works that reached the shelf in the last two weeks. */
  recentlyArrived: ArrivedRow[];
  /** How many standing rows the reader wants: the "Yours · N" count. */
  mineCount: number;
}

/** The answer to a want: the work's place in line after counting it. */
export interface WantReceipt {
  catalogWorkId: string;
  language: string;
  rank: number;
  readers: number | null;
}

/** The four stages of preparing a free text, in the order they are done. */
export const preparationStages = ['text', 'chapters', 'level', 'shelf'] as const;
export type PreparationStage = (typeof preparationStages)[number];
export type StageState = 'done' | 'next' | 'rest';

export function stageLabel(stage: PreparationStage): string {
  switch (stage) {
    case 'text': return t('Text');
    case 'chapters': return t('Chapters');
    case 'level': return t('Level & words');
    case 'shelf': return t('On the shelf');
  }
}

/** Each stage's bar: the done ones, the one being worked on next, and the rest. */
export function stageStates(stagesDone: number): { stage: PreparationStage; state: StageState }[] {
  return preparationStages.map((stage, index) => ({
    stage,
    state: index < stagesDone ? 'done' : index === stagesDone ? 'next' : 'rest',
  }));
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const list = (value: unknown) => (Array.isArray(value) ? value : []);

/** A whole count of the four stages; anything else reads as no bars rather than a guess. */
function stageCount(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= preparationStages.length ? (value as number) : null;
}

function parseWantedRow(value: unknown): WantedRow[] {
  const data = record(value);
  const catalogWorkId = text(data?.catalogWorkId);
  const title = text(data?.title);
  const language = text(data?.language);
  if (!data || !catalogWorkId || !title || !language) return [];
  return [{
    catalogWorkId,
    title,
    author: text(data.author),
    language,
    workSlug: text(data.workSlug),
    rank: number(data.rank) ?? 0,
    readers: number(data.readers),
    wantedByMe: data.wantedByMe === true,
    status: wantStatuses.find((status) => status === data.status) ?? 'OPEN',
    stagesDone: stageCount(data.stagesDone),
  }];
}

function parseArrivedRow(value: unknown): ArrivedRow[] {
  const data = record(value);
  const catalogWorkId = text(data?.catalogWorkId);
  const title = text(data?.title);
  const language = text(data?.language);
  const editionSlug = text(data?.editionSlug);
  if (!data || !catalogWorkId || !title || !language || !editionSlug) return [];
  return [{
    catalogWorkId,
    title,
    author: text(data.author),
    language,
    editionSlug,
    cefrLevel: text(data.cefrLevel) as CefrLevel | null,
    coverUrl: text(data.coverUrl),
    arrivedAt: text(data.arrivedAt),
  }];
}

/** Keeps the rows the screen can show; a row without its work, title or language is dropped. */
export function parseWantedQueue(value: unknown): WantedQueue {
  const data = record(value);
  return {
    beingPrepared: list(data?.beingPrepared).flatMap(parseWantedRow),
    queue: list(data?.queue).flatMap(parseWantedRow),
    recentlyArrived: list(data?.recentlyArrived).flatMap(parseArrivedRow),
    mineCount: number(data?.mineCount) ?? 0,
  };
}

export function parseWantReceipt(value: unknown): WantReceipt {
  const data = record(value);
  return {
    catalogWorkId: text(data?.catalogWorkId) ?? '',
    language: text(data?.language) ?? '',
    rank: number(data?.rank) ?? 0,
    readers: number(data?.readers),
  };
}

/** The notice after a want: its place in line, or only the confirmation when it has none (rank 0). */
export function wantedNoticeTitle(rank: number): string {
  return rank > 0
    ? t('Added to Wanted. It’s {rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} in line.', { rank })
    : t('Added to Wanted.');
}

/** "N readers", or nothing while the count is hidden. */
export function readersLabel(readers: number | null): string | null {
  return readers === null ? null : t('{count, plural, one {# reader} other {# readers}}', { count: readers });
}

/** "author · Language", or "author · Polish edition" when the shelf has the work in another language. */
export function wantedRowMeta(row: Pick<WantedRow, 'author' | 'language' | 'workSlug'>): string {
  const language = languageName(row.language);
  return [row.author, row.workSlug ? t('{language} edition', { language }) : language].filter(Boolean).join(' · ');
}
