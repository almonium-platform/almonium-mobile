import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where each book was last open, for the shelf's "12% · chapter 3 of 24" line (design 4a). The
 * server keeps a percentage; the chapter is only known to the reader, so the reader notes it here
 * on every chapter change. One map on this phone, newest first, capped so it never grows past a
 * shelf's worth of books.
 */
export interface ReadingPlace {
  chapter: number;
  total: number;
  at: string;
}

const placesKey = 'almonium:reading-places';
const keep = 60;

export async function readReadingPlaces(): Promise<Record<string, ReadingPlace>> {
  try {
    const raw = await AsyncStorage.getItem(placesKey);
    return raw ? parsePlaces(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export async function writeReadingPlace(bookId: string, place: { chapter: number; total: number }) {
  if (!Number.isInteger(place.chapter) || !Number.isInteger(place.total) || place.chapter < 1 || place.total < place.chapter) return;
  try {
    const current = await readReadingPlaces();
    const next = trimPlaces({ ...current, [bookId]: { chapter: place.chapter, total: place.total, at: new Date().toISOString() } });
    await AsyncStorage.setItem(placesKey, JSON.stringify(next));
  } catch {
    // The shelf falls back to the percentage alone.
  }
}

export function parsePlaces(value: unknown): Record<string, ReadingPlace> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, ReadingPlace> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (Number.isInteger(row.chapter) && Number.isInteger(row.total) && (row.chapter as number) >= 1 && (row.total as number) >= (row.chapter as number)) {
      result[id] = { chapter: row.chapter as number, total: row.total as number, at: typeof row.at === 'string' ? row.at : '' };
    }
  }
  return result;
}

export function trimPlaces(places: Record<string, ReadingPlace>, limit = keep) {
  const entries = Object.entries(places).sort((a, b) => b[1].at.localeCompare(a[1].at));
  return Object.fromEntries(entries.slice(0, limit));
}
