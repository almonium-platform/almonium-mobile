import { describe, expect, it, vi } from 'vitest';

import { defaultReaderSettings, normalizeReaderSettings } from './reader-settings';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

describe('reader settings', () => {
  it('defaults to Literata, 19pt, on-demand translation', () => {
    expect(normalizeReaderSettings(null)).toEqual(defaultReaderSettings);
    expect(defaultReaderSettings.parallel).toBe('on-demand');
  });

  it('uses the current app theme only when no reader theme is saved', () => {
    expect(normalizeReaderSettings(null, 'night').theme).toBe('night');
    expect(normalizeReaderSettings({ theme: 'paper' }, 'night').theme).toBe('paper');
    expect(normalizeReaderSettings({ theme: 'night' }, 'paper').theme).toBe('night');
  });

  it('reads the older three-face and boolean-parallel shape', () => {
    expect(normalizeReaderSettings({ face: 'clear', parallel: true, fontSize: 40 })).toEqual({
      fontSize: 28,
      theme: 'paper',
      face: 'plex',
      parallel: 'on-demand',
    });
    expect(normalizeReaderSettings({ face: 'classic', parallel: false, theme: 'night' })).toMatchObject({
      face: 'literata',
      parallel: 'off',
      theme: 'night',
    });
  });
});
