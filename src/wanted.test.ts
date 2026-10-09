import { describe, expect, it } from 'vitest';

import { parseWantedQueue, parseWantReceipt, readersLabel, stageLabel, stageStates, wantedNoticeTitle, wantedRowMeta } from './wanted';

describe('parseWantedQueue', () => {
  it('reads the three lists and the count, and drops rows the screen cannot show', () => {
    expect(parseWantedQueue({
      beingPrepared: [{ catalogWorkId: 'w1', title: 'Emma', author: 'Jane Austen', language: 'DE', workSlug: 'emma', rank: 1, readers: 5, wantedByMe: true, status: 'IN_PROGRESS', stagesDone: 2 }],
      queue: [
        { catalogWorkId: 'w2', title: 'Middlemarch', author: null, language: 'FR', workSlug: null, rank: 2, readers: null, wantedByMe: false, status: 'OPEN' },
        { catalogWorkId: 'w3', language: 'FR' },
        null,
      ],
      recentlyArrived: [
        { catalogWorkId: 'w4', title: 'Persuasion', author: 'Jane Austen', language: 'DE', editionSlug: 'persuasion-de', cefrLevel: 'B2', coverUrl: null, arrivedAt: '2026-10-01T10:00:00Z' },
        { catalogWorkId: 'w5', title: 'No edition', language: 'DE' },
      ],
      mineCount: 3,
    })).toEqual({
      beingPrepared: [{ catalogWorkId: 'w1', title: 'Emma', author: 'Jane Austen', language: 'DE', workSlug: 'emma', rank: 1, readers: 5, wantedByMe: true, status: 'IN_PROGRESS', stagesDone: 2 }],
      queue: [{ catalogWorkId: 'w2', title: 'Middlemarch', author: null, language: 'FR', workSlug: null, rank: 2, readers: null, wantedByMe: false, status: 'OPEN', stagesDone: null }],
      recentlyArrived: [{ catalogWorkId: 'w4', title: 'Persuasion', author: 'Jane Austen', language: 'DE', editionSlug: 'persuasion-de', cefrLevel: 'B2', coverUrl: null, arrivedAt: '2026-10-01T10:00:00Z' }],
      mineCount: 3,
    });
  });

  it('reads anything else as an empty page', () => {
    expect(parseWantedQueue(null)).toEqual({ beingPrepared: [], queue: [], recentlyArrived: [], mineCount: 0 });
    expect(parseWantedQueue({ queue: 'nope' }).queue).toEqual([]);
  });
});

describe('parseWantReceipt', () => {
  it('reads the place in line and a hidden count', () => {
    expect(parseWantReceipt({ catalogWorkId: 'w1', language: 'DE', rank: 2, readers: null })).toEqual({ catalogWorkId: 'w1', language: 'DE', rank: 2, readers: null });
    expect(parseWantReceipt(undefined).rank).toBe(0);
  });
});

describe('wantedNoticeTitle', () => {
  it('names the place in line as an ordinal', () => {
    expect(wantedNoticeTitle(1)).toBe('Added to Wanted. It’s 1st in line.');
    expect(wantedNoticeTitle(2)).toBe('Added to Wanted. It’s 2nd in line.');
    expect(wantedNoticeTitle(3)).toBe('Added to Wanted. It’s 3rd in line.');
    expect(wantedNoticeTitle(11)).toBe('Added to Wanted. It’s 11th in line.');
    expect(wantedNoticeTitle(22)).toBe('Added to Wanted. It’s 22nd in line.');
  });

  it('only confirms when the want has no place in line', () => {
    expect(wantedNoticeTitle(0)).toBe('Added to Wanted.');
  });
});

describe('readersLabel', () => {
  it('counts readers once the count is shown', () => {
    expect(readersLabel(3)).toBe('3 readers');
    expect(readersLabel(null)).toBeNull();
  });
});

describe('wantedRowMeta', () => {
  it('names the language, or the edition when the shelf has the work in another language', () => {
    expect(wantedRowMeta({ author: 'Jane Austen', language: 'DE', workSlug: null })).toBe('Jane Austen · German');
    expect(wantedRowMeta({ author: 'Jane Austen', language: 'PL', workSlug: 'emma' })).toBe('Jane Austen · Polish edition');
    expect(wantedRowMeta({ author: null, language: 'FR', workSlug: null })).toBe('French');
  });
});

describe('stages', () => {
  const row = (stagesDone: unknown) => parseWantedQueue({ beingPrepared: [{ catalogWorkId: 'w', title: 'T', language: 'DE', stagesDone }] }).beingPrepared[0].stagesDone;

  it('reads a whole count from 0 to 4, and anything else as no bars', () => {
    expect(row(0)).toBe(0);
    expect(row(4)).toBe(4);
    expect(row(5)).toBeNull();
    expect(row(-1)).toBeNull();
    expect(row(1.5)).toBeNull();
    expect(row('2')).toBeNull();
    expect(row(undefined)).toBeNull();
  });

  it('marks the done stages, the next one and the rest, in order', () => {
    expect(stageStates(2).map((entry) => entry.state)).toEqual(['done', 'done', 'next', 'rest']);
    expect(stageStates(0).map((entry) => entry.state)).toEqual(['next', 'rest', 'rest', 'rest']);
    expect(stageStates(4).map((entry) => entry.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(stageStates(1).map((entry) => stageLabel(entry.stage))).toEqual(['Text', 'Chapters', 'Level & words', 'On the shelf']);
  });
});
