import type { ReaderChapter } from './reader-chapters';

export interface ChapterWord {
  lemma: string;
  surface: string;
  context: string;
  blockId: string;
}

export interface ChapterVocabulary {
  chapterSequence: number;
  language: string;
  status: 'ready' | 'pending' | 'stale' | 'unavailable';
  words: ChapterWord[];
}

export interface ReaderLookupSelection {
  entry: string;
  context: string;
  language?: string;
  source?: { book: string; bookTitle: string; chapter: number; chapterTitle: string; block: string };
}

export function vocabularySequence(chapter: ReaderChapter): number | undefined {
  const match = /^chapter-(\d+)$/.exec(chapter.anchor);
  const sequence = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : undefined;
}

export function parseChapterVocabulary(value: unknown, sequence: number): ChapterVocabulary {
  if (!value || typeof value !== 'object') throw new Error('Invalid chapter vocabulary');
  const row = value as Record<string, unknown>;
  if (row.chapterSequence !== sequence || !Number.isSafeInteger(sequence) || sequence < 1
    || typeof row.language !== 'string' || !/^[a-z]{2,3}$/i.test(row.language)
    || !['ready', 'pending', 'stale', 'unavailable'].includes(String(row.status))
    || !Array.isArray(row.words)) throw new Error('Invalid chapter vocabulary');
  const words = row.status !== 'ready' ? [] : row.words.flatMap((value: unknown) => {
    if (!value || typeof value !== 'object') return [];
    const word = value as Record<string, unknown>;
    if (typeof word.lemma !== 'string' || !word.lemma.trim()
      || typeof word.surface !== 'string' || !word.surface.trim()
      || typeof word.context !== 'string' || !word.context.includes(word.surface)
      || typeof word.blockId !== 'string' || !word.blockId) return [];
    return [{ lemma: word.lemma, surface: word.surface, context: word.context, blockId: word.blockId }];
  });
  return { chapterSequence: sequence, language: row.language.toUpperCase(), status: row.status as ChapterVocabulary['status'], words };
}

export function vocabularyLookup(word: ChapterWord, vocabulary: ChapterVocabulary,
  book: string, bookTitle: string, chapterTitle: string): ReaderLookupSelection {
  return { entry: word.lemma, context: word.context, language: vocabulary.language.toUpperCase(),
    source: { book, bookTitle, chapter: vocabulary.chapterSequence, chapterTitle, block: word.blockId } };
}

export function readerLookupLanguage(selection: ReaderLookupSelection | null, bookLanguage: string) {
  return (selection?.language || bookLanguage).toUpperCase();
}

export function vocabularyState(data: ChapterVocabulary | undefined, paused: boolean, failed: boolean, loading: boolean) {
  if (paused) return 'offline';
  if (failed) return 'error';
  if (loading) return 'loading';
  if (!data || data.status !== 'ready') return 'unavailable';
  return data.words.length ? 'ready' : 'empty';
}
