import { describe, expect, it } from 'vitest';

import { clampProgress, ProgressQueue } from './progress-utils';

describe('clampProgress', () => {
  it('rounds and constrains values to the backend contract', () => {
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(42.6)).toBe(43);
    expect(clampProgress(120)).toBe(100);
  });
});

describe('ProgressQueue', () => {
  it('coalesces rapid updates and only advances after a successful save', () => {
    const queue = new ProgressQueue();
    queue.record(10);
    queue.record(14);
    expect(queue.next()).toEqual({ percentage: 14, place: null });

    queue.record(18);
    queue.markSaved({ percentage: 14, place: null });
    expect(queue.next()).toEqual({ percentage: 18, place: null });

    queue.markSaved({ percentage: 18, place: null });
    expect(queue.next()).toBeNull();
  });

  it('carries the place with the percentage and keeps it between scrolls', () => {
    const queue = new ProgressQueue();
    queue.record(12, { chapter: 3, chapterCount: 24 });
    expect(queue.next()).toEqual({ percentage: 12, place: { chapter: 3, chapterCount: 24 } });
    queue.markSaved({ percentage: 12, place: { chapter: 3, chapterCount: 24 } });
    expect(queue.next()).toBeNull();

    queue.record(12, { chapter: 4, chapterCount: 24 });
    expect(queue.next()?.place?.chapter).toBe(4);
    queue.record(13);
    expect(queue.next()).toEqual({ percentage: 13, place: { chapter: 4, chapterCount: 24 } });
  });
});
