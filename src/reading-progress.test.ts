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
    expect(queue.next()).toBe(14);

    queue.record(18);
    queue.markSaved(14);
    expect(queue.next()).toBe(18);

    queue.markSaved(18);
    expect(queue.next()).toBeNull();
  });
});
