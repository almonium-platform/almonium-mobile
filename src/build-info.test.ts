import { describe, expect, it } from 'vitest';

import { buildStamp, shortCommit } from './build-info';

const when = new Date('2026-09-13T20:40:00Z');
const clock = () => '13 Sep, 22:40';

describe('buildStamp', () => {
  it('leads with the shell version and names the update by its commit', () => {
    const stamp = buildStamp(
      { version: '1.0.0', build: '7', commit: '7c157e9abcdef', embedded: false, updatedAt: when, channel: 'develop', runtimeVersion: 'a1b2c3d4e5f6a7b8' },
      clock,
    );
    expect(stamp.headline).toBe('1.0.0 (7)');
    expect(stamp.detail).toBe('update 7c157e9 · 13 Sep, 22:40');
    expect(stamp.note).toBe('develop · runtime a1b2c3d4e5f6');
    expect(stamp.clipboard).toBe('1.0.0 (7)\nupdate 7c157e9 · 13 Sep, 22:40\ndevelop · runtime a1b2c3d4e5f6');
  });

  it('says so when the bundle is the one the install shipped with', () => {
    const stamp = buildStamp({ version: '1.0.0', build: null, commit: '', embedded: true, updatedAt: null, channel: null, runtimeVersion: null }, clock);
    expect(stamp.headline).toBe('1.0.0');
    expect(stamp.detail).toBe('bundled');
    expect(stamp.note).toBe('');
  });

  it('never prints an empty headline', () => {
    expect(buildStamp({ version: null, build: null, commit: '', embedded: true, updatedAt: null, channel: null, runtimeVersion: null }, clock).headline).toBe('—');
  });
});

describe('shortCommit', () => {
  it('keeps seven characters', () => {
    expect(shortCommit(' 740187a1b2c3 ')).toBe('740187a');
  });
});
