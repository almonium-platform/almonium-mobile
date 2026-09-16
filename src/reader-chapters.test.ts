import { describe, expect, it } from 'vitest';
import {
  chapterEndScript, chapterEnrichment, chapterHeaderScript, chapterJumpScript, chapterLevelRange, chapterNumber, displayChapterTitle,
  parseChapterEnrichments, parseReaderChapters,
} from './reader-chapters';

describe('reader chapter navigation', () => {
  it('tolerates absent or malformed optional enrichment', () => {
    expect(parseChapterEnrichments({error: 'unavailable'})).toEqual([]);
    expect(parseChapterEnrichments([null, {sequence: 11, analysisStatus: 'complete', cefrEstimate: 'D3', descriptions: [42, 'Opening.']}]))
      .toEqual([{sequence: 11, analysisStatus: 'complete', cefrEstimate: null, descriptions: ['Opening.']}]);
  });
  it('accepts local heading metadata but ignores malformed messages', () => {
    const valid = {index: 0, anchor: 'chapter-11', title: 'Chapter V'};
    expect(parseReaderChapters([valid, null, {index: '1'}, {index: -1, anchor: '', title: ''}])).toEqual([valid]);
    expect(parseReaderChapters(null)).toEqual([]);
  });
  it('uses stable chapter sequence, not array position, and excludes stale estimates', () => {
    const chapter = {index: 0, anchor: 'chapter-11', title: 'V'};
    const enrichment = {sequence: 11, analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['An experiment.']};
    expect(chapterEnrichment(chapter, [enrichment])).toEqual(enrichment);
    expect(chapterEnrichment({...chapter, anchor: 'legacy-11'}, [enrichment])).toBeUndefined();
    expect(chapterEnrichment(chapter, [{...enrichment, analysisStatus: 'stale'}])).toBeUndefined();
    expect(chapterEnrichment(chapter)).toBeUndefined();
  });
  it('never interpolates an arbitrary script or invalid index into a jump', () => {
    expect(chapterJumpScript(Number.NaN)).toBe('true;');
    expect(chapterJumpScript(-1)).toBe('true;');
    expect(chapterJumpScript(2)).toContain('[2]');
  });
});

describe('chapter page presentation', () => {
  it('shows shouting source headings as titles, keeping roman numerals', () => {
    expect(displayChapterTitle('CHAPTER V.')).toBe('Chapter V');
    expect(displayChapterTitle('LETTER I.')).toBe('Letter I');
    expect(displayChapterTitle('INTRODUCTION')).toBe('Introduction');
    expect(displayChapterTitle('Chapter 1: The Beginning.')).toBe('Chapter 1: The Beginning');
    expect(displayChapterTitle('  ')).toBe('');
  });
  it('ranges the estimated levels over body chapters only', () => {
    const chapters = [{ index: 0, anchor: 'chapter-1', title: 'Intro' }, { index: 1, anchor: 'chapter-2', title: 'I' }, { index: 2, anchor: 'chapter-3', title: 'II' }];
    const data = [
      { sequence: 1, analysisStatus: 'complete', cefrEstimate: null, descriptions: [] },
      { sequence: 2, analysisStatus: 'complete', cefrEstimate: 'C1', descriptions: [] },
      { sequence: 3, analysisStatus: 'complete', cefrEstimate: 'B1', descriptions: [] },
    ];
    expect(chapterLevelRange(chapters, data)).toBe('B1–C1');
    expect(chapterLevelRange(chapters.slice(1, 2), data)).toBe('C1');
    expect(chapterLevelRange(chapters)).toBeNull();
  });
  it('numbers by processor sequence, falling back to the heading’s place', () => {
    expect(chapterNumber({ index: 3, anchor: 'chapter-11', title: '' })).toBe(11);
    expect(chapterNumber({ index: 3, anchor: 'legacy', title: '' })).toBe(4);
  });
  it('injects header and chapter-end blocks as data, never as markup', () => {
    const header = chapterHeaderScript([{ index: 0, meta: 'Chapter 1 of 2', description: '<img src=x onerror=alert(1)>' }, { index: -1, meta: '', description: '' }]);
    expect(header).toContain('textContent');
    expect(header).not.toContain('innerHTML');
    expect(header).toContain('"index":0');
    expect(header).not.toContain('"index":-1');
    const end = chapterEndScript({ index: 0, title: 'Words', note: '', words: [{ lemma: 'a', surface: 'a', context: 'a b', blockId: 'c1.p1' }], shown: 3, allLabel: 'All', next: { index: 1, meta: 'Next', title: 'II', description: '' } });
    expect(end).toContain('"blockId":"c1.p1"');
    expect(end).not.toContain('innerHTML');
    expect(chapterEndScript({ index: Number.NaN, title: '', note: '', words: [], shown: 3, allLabel: '', next: null })).toBe('true;');
  });
});
