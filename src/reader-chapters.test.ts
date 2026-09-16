import { describe, expect, it } from 'vitest';
import { chapterEnrichment, chapterJumpScript, parseChapterEnrichments, parseReaderChapters } from './reader-chapters';

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
