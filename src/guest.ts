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
