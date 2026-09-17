import { describe, expect, it } from 'vitest';

import { authorSurname, filterLibrary, hyphenateForWidth, libraryEntries, presentLevels, shelfRows, shortTitle, thousands } from './shelf';
import type { BookSummary } from './types';

const book = (over: Partial<BookSummary>): BookSummary => ({
  id: 'id', workSlug: 'work', title: 'Title', author: 'Some Author', publicationYear: 1800, coverUrl: null, wordCount: 10_000,
  language: 'EN', cefrLevel: 'B2', progressPercentage: null, currentChapter: null, chapterCount: null, hasParallelTranslation: true, hasTranslation: true, isTranslation: false,
  ...over,
});

describe('the typographic cover', () => {
  it('carries the short title and the surname, never the app name', () => {
    expect(shortTitle('Frankenstein; or, The Modern Prometheus')).toBe('Frankenstein');
    expect(shortTitle('Alice’s Adventures in Wonderland: A Tale')).toBe('Alice’s Adventures in Wonderland');
    expect(shortTitle('Dubliners')).toBe('Dubliners');
    expect(authorSurname('Mary Shelley')).toBe('Shelley');
    expect(authorSurname('H. G. Wells')).toBe('Wells');
    expect(authorSurname('Dumas, Alexandre')).toBe('Dumas');
    expect(authorSurname('')).toBe('');
  });
  it('hyphenates only a word wider than the cover', () => {
    expect(hyphenateForWidth('Pride and Prejudice', 9)).toBe('Pride and Prejudice');
    expect(hyphenateForWidth('Frankenstein', 9)).toBe('Franke\u00ADnstein');
    expect(hyphenateForWidth('Adventures', 9)).toBe('Adven\u00ADtures');
    expect(hyphenateForWidth('Frankenstein', 20)).toBe('Frankenstein');
  });
});

describe('the shelf', () => {
  it('shows a book once, with offline as a state of the row', () => {
    const started = [book({ id: 'a', progressPercentage: 12 }), book({ id: 'b', progressPercentage: 41 })];
    const downloads = [book({ id: 'a' }), book({ id: 'c', progressPercentage: null }), book({ id: 'd', language: 'DE' })];
    const rows = shelfRows(started, downloads, 'EN');
    expect(rows.map((row) => [row.book.id, row.offline, row.progress])).toEqual([['a', true, 12], ['b', false, 41], ['c', true, 0]]);
  });
});

describe('the library', () => {
  const books = [
    book({ id: 'pp-b2', workSlug: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', cefrLevel: 'B2', wordCount: 122_000 }),
    book({ id: 'pp-c1', workSlug: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', cefrLevel: 'C1', wordCount: 122_400 }),
    book({ id: 'tm', workSlug: 'time', title: 'The Time Machine', author: 'H. G. Wells', cefrLevel: 'B1', wordCount: 33_000 }),
    book({ id: 'fr-c1', workSlug: 'frank', title: 'Frankenstein', author: 'Mary Shelley', cefrLevel: 'C1', wordCount: 75_000 }),
    book({ id: 'fr-b2', workSlug: 'frank', title: 'Frankenstein', author: 'Mary Shelley', cefrLevel: 'B2', wordCount: 74_000 }),
  ];
  it('folds level editions into one entry, sorted by level then title', () => {
    const entries = libraryEntries(books, new Set(['fr-c1']));
    expect(entries.map((entry) => [entry.title, entry.levels.join(' · '), entry.book.id, entry.onShelf])).toEqual([
      ['The Time Machine', 'B1', 'tm', false],
      ['Frankenstein', 'B2 · C1', 'fr-c1', true],
      ['Pride and Prejudice', 'B2 · C1', 'pp-b2', false],
    ]);
    expect(presentLevels(entries)).toEqual(['B1', 'B2', 'C1']);
  });
  it('filters by words, level and length', () => {
    const entries = libraryEntries(books);
    expect(filterLibrary(entries, 'wells', null, null).map((entry) => entry.title)).toEqual(['The Time Machine']);
    expect(filterLibrary(entries, '', 'C1', null).map((entry) => entry.title)).toEqual(['Frankenstein', 'Pride and Prejudice']);
    expect(filterLibrary(entries, '', null, 'MEDIUM').map((entry) => entry.title)).toEqual(['The Time Machine']);
    expect(filterLibrary(entries, '', 'B1', 'LONG')).toEqual([]);
  });
  it('rounds word counts to thousands', () => {
    expect(thousands(122_400)).toBe('122k');
    expect(thousands(27_500)).toBe('28k');
    expect(thousands(640)).toBe('640');
  });
});
