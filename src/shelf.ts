import type { BookSummary, CefrLevel } from './types';

export const cefrLevels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export type LengthFilter = 'SHORT' | 'MEDIUM' | 'LONG';

/** The title a cover carries: the text before the first colon or semicolon (design 4a, correction 3). */
export function shortTitle(title: string) {
  const cut = title.search(/[:;]/);
  const short = (cut === -1 ? title : title.slice(0, cut)).trim();
  return short || title.trim();
}

/** The cover's eyebrow: the author's surname, so "H. G. Wells" reads WELLS and "Jane Austen" AUSTEN. */
export function authorSurname(author: string) {
  const words = author.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  // "Dumas, Alexandre" keeps the part before the comma; otherwise the last word stands.
  const comma = author.indexOf(',');
  if (comma > 0) return author.slice(0, comma).trim();
  const surname = words[words.length - 1];
  return surname.replace(/[.,]+$/, '') || surname;
}

/**
 * Soft hyphens for a word wider than the cover (correction 3): a word is broken only when it
 * cannot fit a line of `perLine` characters, and then into even pieces that each leave room for
 * the hyphen. Words that fit are returned untouched; the shelf and rail never hyphenate
 * "Pride and Prejudice".
 */
export function hyphenateForWidth(text: string, perLine: number) {
  if (perLine < 3) return text;
  return text.split(' ').map((word) => {
    if (word.length <= perLine) return word;
    const pieces = Math.ceil(word.length / (perLine - 1));
    const size = Math.ceil(word.length / pieces);
    const parts: string[] = [];
    for (let index = 0; index < word.length; index += size) parts.push(word.slice(index, index + size));
    return parts.join('\u00AD');
  }).join(' ');
}

export interface ShelfRow {
  book: BookSummary;
  offline: boolean;
  progress: number;
}

/**
 * The shelf (correction 2): every book started in this language, plus every downloaded one, each
 * once. A downloaded book that was never opened sits at 0%; a started book that is also downloaded
 * says so in its metadata line rather than appearing twice. Started books first, in the order the
 * server gives them, then the unopened downloads.
 */
export function shelfRows(started: BookSummary[], downloads: BookSummary[], language: string): ShelfRow[] {
  const offlineIds = new Set(downloads.filter((book) => book.language === language).map((book) => book.id));
  const rows: ShelfRow[] = started.map((book) => ({ book, offline: offlineIds.has(book.id), progress: clamp(book.progressPercentage) }));
  const seen = new Set(started.map((book) => book.id));
  for (const book of downloads) {
    if (book.language !== language || seen.has(book.id)) continue;
    seen.add(book.id);
    rows.push({ book, offline: true, progress: clamp(book.progressPercentage) });
  }
  return rows;
}

/** An edition's kind in words: the processor names it original, adaptation or a translation. */
export type EditionKind = 'original' | 'adapted' | 'translation' | 'edition';

export interface EditionLevel {
  kind: EditionKind;
  level: CefrLevel;
}

export interface LibraryEntry {
  /** The edition a tap opens: the one on the shelf if any, else the easiest. */
  book: BookSummary;
  workSlug: string;
  title: string;
  author: string;
  levels: CefrLevel[];
  /** The editions the work actually has, original first: what the foot says the book reaches (decision 13). */
  editions: EditionLevel[];
  wordCount: number;
  onShelf: boolean;
}

/**
 * The library (correction 2): one entry per work. Level editions of the same work fold into one
 * row with every level on its foot, never a second card. Sorted by lowest level, then title.
 */
export function libraryEntries(books: BookSummary[], shelfIds: ReadonlySet<string> = new Set()): LibraryEntry[] {
  const byWork = new Map<string, BookSummary[]>();
  for (const book of books) {
    const key = book.workSlug || book.id;
    const list = byWork.get(key);
    if (list) {
      if (!list.some((entry) => entry.id === book.id)) list.push(book);
    } else byWork.set(key, [book]);
  }
  const entries: LibraryEntry[] = [];
  for (const [workSlug, editions] of byWork) {
    const sorted = [...editions].sort((a, b) => levelRank(a.cefrLevel) - levelRank(b.cefrLevel));
    const onShelf = sorted.find((edition) => shelfIds.has(edition.id));
    const book = onShelf ?? sorted[0];
    const levels = [...new Set(sorted.map((edition) => edition.cefrLevel))].filter(Boolean) as CefrLevel[];
    entries.push({ book, workSlug, title: book.title, author: book.author, levels, editions: editionLevels(sorted), wordCount: book.wordCount, onShelf: Boolean(onShelf) });
  }
  return entries.sort((a, b) => (levelRank(a.levels[0]) - levelRank(b.levels[0])) || a.title.localeCompare(b.title));
}

export function editionKind(editionType: string | null | undefined, isTranslation = false): EditionKind {
  switch (editionType) {
    case 'original': return 'original';
    case 'adaptation': return 'adapted';
    case 'machine_translation':
    case 'human_translation': return 'translation';
    default: return isTranslation ? 'translation' : 'edition';
  }
}

const kindOrder: Record<EditionKind, number> = { original: 0, adapted: 1, edition: 1, translation: 2 };

/** Kind and level of each edition, original first then the easiest up, a repeated pair read once. */
export function editionLevels(editions: BookSummary[]): EditionLevel[] {
  const seen = new Set<string>();
  return editions
    .filter((edition) => Boolean(edition.cefrLevel))
    .map((edition) => ({ kind: editionKind(edition.editionType, edition.isTranslation), level: edition.cefrLevel }))
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || levelRank(a.level) - levelRank(b.level))
    .filter((entry) => !seen.has(`${entry.kind}:${entry.level}`) && seen.add(`${entry.kind}:${entry.level}`));
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "Original C1", "Adapted B2", "Translation C1": the words a foot or a line prints for one edition. */
export function editionLabel(t: Translate, edition: EditionLevel): string {
  switch (edition.kind) {
    case 'original': return t('Original {level}', { level: edition.level });
    case 'adapted': return t('Adapted {level}', { level: edition.level });
    case 'translation': return t('Translation {level}', { level: edition.level });
    default: return t('{level} edition', { level: edition.level });
  }
}

/** The level chips: A1–C2 minus the levels with no book, in order. */
export function presentLevels(entries: LibraryEntry[]): CefrLevel[] {
  const present = new Set(entries.flatMap((entry) => entry.levels));
  return cefrLevels.filter((level) => present.has(level));
}

export function matchesLength(wordCount: number, length: LengthFilter | null) {
  if (!length) return true;
  if (length === 'SHORT') return wordCount < 15_000;
  if (length === 'MEDIUM') return wordCount >= 15_000 && wordCount < 40_000;
  return wordCount >= 40_000;
}

export function filterLibrary(entries: LibraryEntry[], search: string, level: CefrLevel | null, length: LengthFilter | null) {
  const needle = search.trim().toLocaleLowerCase();
  return entries.filter((entry) =>
    (!needle || entry.title.toLocaleLowerCase().includes(needle) || entry.author.toLocaleLowerCase().includes(needle))
    && (!level || entry.levels.includes(level))
    && matchesLength(entry.wordCount, length));
}

/** "122k words" for the library's mono line; under a thousand the count stands as it is. */
export function thousands(count: number) {
  if (count < 1000) return String(Math.max(0, Math.round(count)));
  return `${Math.round(count / 1000)}k`;
}

export function levelRank(level: CefrLevel | null | undefined) {
  const index = level ? cefrLevels.indexOf(level) : -1;
  return index === -1 ? cefrLevels.length : index;
}

function clamp(value: number | null | undefined) {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}
