import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Reading without an account. Everything reads; only keeping needs an account, so a guest's
 * place lives on this device alone and the account ask sits where keeping would happen.
 */
const progressKey = (editionSlug: string) => `almonium:guest-progress:${editionSlug}`;

export async function readGuestProgress(editionSlug: string) {
  try {
    const value = Number(await AsyncStorage.getItem(progressKey(editionSlug)));
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  } catch {
    return 0;
  }
}

export function writeGuestProgress(editionSlug: string, percentage: number) {
  return AsyncStorage.setItem(progressKey(editionSlug), String(Math.round(percentage))).catch(() => undefined);
}

/** The card's other language for a guest: the phone's language when it differs from the book's, else the usual pair. */
export function guestTranslationLanguage(deviceLanguages: readonly string[], bookLanguage: string) {
  const book = bookLanguage.toUpperCase();
  const device = deviceLanguages
    .map((tag) => tag.split(/[-_]/)[0].toUpperCase())
    .find((code) => /^[A-Z]{2}$/.test(code) && code !== book);
  return device ?? (book === 'EN' ? 'UK' : 'EN');
}

/** Only an in-app path may be a return destination after signing in; anything else goes home. */
export function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && /^\/[A-Za-z0-9/_\-[\]().?=&%:.+]*$/.test(value) && !value.startsWith('//') ? value : null;
}

/** The reader's own address, for coming back to it after the auth screens. */
export function readerReturnPath(bookId: string, slug: string | undefined, title: string | undefined) {
  const query = new URLSearchParams();
  if (slug) query.set('slug', slug);
  if (title) query.set('title', title);
  const search = query.toString();
  return `/reader/${encodeURIComponent(bookId)}${search ? `?${search}` : ''}`;
}

/** The most recently read book on this device: the library's one Continue card. */
export interface GuestLastRead {
  slug: string;
  bookId: string;
  title: string;
  language: string;
  chapterTitle: string;
  percentage: number;
}

const lastReadKey = 'almonium:guest-last-read';

export async function readGuestLastRead(): Promise<GuestLastRead | null> {
  try {
    const raw = await AsyncStorage.getItem(lastReadKey);
    const value = raw ? (JSON.parse(raw) as Partial<GuestLastRead>) : null;
    if (!value || typeof value.slug !== 'string' || typeof value.bookId !== 'string' || typeof value.title !== 'string') return null;
    return {
      slug: value.slug, bookId: value.bookId, title: value.title,
      language: typeof value.language === 'string' ? value.language : '',
      chapterTitle: typeof value.chapterTitle === 'string' ? value.chapterTitle : '',
      percentage: typeof value.percentage === 'number' && Number.isFinite(value.percentage) ? Math.max(0, Math.min(100, value.percentage)) : 0,
    };
  } catch {
    return null;
  }
}

export function writeGuestLastRead(value: GuestLastRead) {
  return AsyncStorage.setItem(lastReadKey, JSON.stringify(value)).catch(() => undefined);
}

/** The library's default chip: the phone's language when the list has it, else the language with most editions. */
export function defaultGuestLanguage(counts: ReadonlyMap<string, number>, deviceLanguages: readonly string[]) {
  const device = deviceLanguages
    .map((tag) => tag.split(/[-_]/)[0].toUpperCase())
    .find((code) => counts.has(code));
  if (device) return device;
  let best: string | null = null;
  for (const [language, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = language;
  }
  return best;
}
