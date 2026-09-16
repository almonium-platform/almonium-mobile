import { describe, expect, it } from 'vitest';
import {
  excerptParts, isSavedWord, parseChapterVocabulary, readerLookupLanguage, savedLemmas, vocabularyLookup, vocabularySequence, vocabularyState,
  wordsAvailable,
} from './reader-vocabulary';

const word = { lemma: 'endeavour', surface: 'endeavoured', context: 'I had endeavoured to form it.', blockId: 'c11.p4' };
const payload = { chapterSequence: 11, language: 'en', status: 'ready', words: [word] };

describe('chapter vocabulary contract', () => {
  it('joins processor anchors, never heading position or title', () => {
    expect(vocabularySequence({ index: 0, anchor: 'chapter-11', title: 'V' })).toBe(11);
    for (const anchor of ['', 'legacy-11', 'chapter-0', 'chapter-1.5', 'chapter-99999999999999999']) {
      expect(vocabularySequence({ index: 11, anchor, title: 'Chapter 11' })).toBeUndefined();
    }
  });
  it('parses observed forms separately from lemmas and normalizes language', () => {
    expect(parseChapterVocabulary(payload, 11)).toEqual({ ...payload, language: 'EN' });
  });
  it('rejects another chapter, missing data and malformed statuses/languages', () => {
    for (const value of [null, {}, { ...payload, chapterSequence: 10 }, { ...payload, language: '' },
      { ...payload, status: 'invented' }, { ...payload, words: null }]) {
      expect(() => parseChapterVocabulary(value, 11)).toThrow('Invalid chapter vocabulary');
    }
  });
  it('does not display stale, pending or unavailable words', () => {
    for (const status of ['stale', 'pending', 'unavailable']) {
      expect(parseChapterVocabulary({ ...payload, status }, 11).words).toEqual([]);
    }
  });
  it('drops malformed or unattested examples instead of inventing vocabulary', () => {
    const value = { ...payload, words: [null, { ...word, lemma: ' ' }, { ...word, surface: 'missing' },
      { ...word, blockId: '' }, word] };
    expect(parseChapterVocabulary(value, 11).words).toEqual([word]);
  });
});

describe('vocabulary lookup and unavailable states', () => {
  it('keeps the book language, excerpt and book/chapter/block identity when the learner uses another language', () => {
    const selection = vocabularyLookup(word, parseChapterVocabulary(payload, 11), 'frankenstein-en', 'Frankenstein', 'Chapter V');
    expect(selection).toEqual({ entry: 'endeavour', context: word.context, language: 'EN',
      source: { book: 'frankenstein-en', bookTitle: 'Frankenstein', chapter: 11, chapterTitle: 'Chapter V', block: 'c11.p4' } });
    expect(readerLookupLanguage(selection, 'DE')).toBe('EN');
    expect(readerLookupLanguage(null, 'uk')).toBe('UK');
  });
  it('distinguishes loading, empty, missing, offline and failed requests without relying on data', () => {
    expect(vocabularyState(undefined, false, false, true)).toBe('loading');
    expect(vocabularyState(undefined, false, false, false)).toBe('unavailable');
    expect(vocabularyState(undefined, true, false, false)).toBe('offline');
    expect(vocabularyState(undefined, false, true, false)).toBe('error');
    const data = parseChapterVocabulary(payload, 11);
    expect(vocabularyState(data, false, false, false)).toBe('ready');
    expect(vocabularyState({ ...data, words: [] }, false, false, false)).toBe('empty');
    expect(vocabularyState({ ...data, status: 'stale' }, false, false, false)).toBe('unavailable');
    // Don't portray cached text as currently verified after a failed refresh.
    expect(vocabularyState(data, true, false, false)).toBe('offline');
    expect(vocabularyState(data, false, true, false)).toBe('error');
    expect(vocabularyState(data, false, false, true)).toBe('loading');
  });
});

describe('words sheet rows and availability', () => {
  it('splits the excerpt around the observed form for highlighting', () => {
    expect(excerptParts('I had endeavoured to form it.', 'endeavoured')).toEqual(['I had ', 'endeavoured', ' to form it.']);
    expect(excerptParts('No match here.', 'absent')).toEqual(['No match here.', '', '']);
  });
  it('marks lemmas already in review without caring about case', () => {
    const saved = savedLemmas([{ entry: 'Endeavour ' }, { entry: 'wretch' }]);
    expect(isSavedWord(word, saved)).toBe(true);
    expect(isSavedWord({ ...word, lemma: 'ardour' }, saved)).toBe(false);
    expect(savedLemmas(undefined).size).toBe(0);
  });
  it('offers Words only for editions with a slug and processor chapters, and hides it for a private import', () => {
    const chapters = [{ index: 0, anchor: 'chapter-1', title: 'I' }];
    expect(wordsAvailable(chapters, 'slug', undefined)).toBe(true);
    expect(wordsAvailable(chapters, undefined, undefined)).toBe(false);
    expect(wordsAvailable([{ index: 0, anchor: 'legacy', title: 'I' }], 'slug', undefined)).toBe(false);
    expect(wordsAvailable(chapters, 'slug', parseChapterVocabulary({ ...payload, chapterSequence: 1, status: 'unavailable' }, 1))).toBe(false);
    expect(wordsAvailable(chapters, 'slug', parseChapterVocabulary({ ...payload, chapterSequence: 1, status: 'pending' }, 1))).toBe(true);
  });
});
