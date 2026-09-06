import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One source of truth for how the reader draws a page. The reader sheet and the App tab's reader
 * defaults both write here, so there is never a second copy to drift.
 */
export type ReaderTheme = 'paper' | 'night';
/** Three presets, not a font menu. The third exists for people who confuse letterforms. */
export type ReaderFace = 'literata' | 'plex' | 'atkinson';
/** Side-by-side is dropped below 600pt: two columns of Literata at 19pt do not fit. */
export type ParallelMode = 'off' | 'on-demand' | 'inline';

export interface ReaderSettings {
  fontSize: number;
  theme: ReaderTheme;
  face: ReaderFace;
  parallel: ParallelMode;
}

export const readerFaces: { value: ReaderFace; label: string; note?: string }[] = [
  { value: 'literata', label: 'Literata', note: 'default' },
  { value: 'plex', label: 'IBM Plex Sans' },
  { value: 'atkinson', label: 'Atkinson Hyperlegible', note: 'easier to tell letters apart' },
];

export const parallelModes: { value: ParallelMode; label: string; note: string }[] = [
  { value: 'off', label: 'Original only', note: 'No translation on the page.' },
  { value: 'on-demand', label: 'On demand', note: 'Tap a sentence; its translation opens under that line.' },
  { value: 'inline', label: 'Inline', note: 'Whole paragraph, then its translation, one size down.' },
];

export const defaultReaderSettings: ReaderSettings = {
  fontSize: 19,
  theme: 'paper',
  face: 'literata',
  parallel: 'on-demand',
};

const settingsKey = 'almonium:reader-settings';

/** Older builds stored three system faces and a parallel boolean; both read into the new shape. */
export function normalizeReaderSettings(value: unknown): ReaderSettings {
  const stored = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const fontSize = typeof stored.fontSize === 'number' ? Math.max(16, Math.min(28, stored.fontSize)) : defaultReaderSettings.fontSize;
  const theme: ReaderTheme = stored.theme === 'night' ? 'night' : 'paper';
  const face: ReaderFace =
    stored.face === 'plex' || stored.face === 'clear'
      ? 'plex'
      : stored.face === 'atkinson'
        ? 'atkinson'
        : 'literata';
  const parallel: ParallelMode =
    stored.parallel === 'inline'
      ? 'inline'
      : stored.parallel === 'off' || stored.parallel === false
        ? 'off'
        : 'on-demand';
  return { fontSize, theme, face, parallel };
}

export async function loadReaderSettings(): Promise<ReaderSettings> {
  try {
    const raw = await AsyncStorage.getItem(settingsKey);
    return normalizeReaderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultReaderSettings;
  }
}

export async function saveReaderSettings(settings: ReaderSettings) {
  await AsyncStorage.setItem(settingsKey, JSON.stringify(settings));
}
