import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { BookSummary } from '@/src/types';

export { formattedDownloadSize } from '@/src/offline-utils';

const manifestKey = 'almonium:offline-books';
export interface DownloadedBook extends BookSummary {
  downloadedAt: string;
  size: number;
}

export async function downloadedBooks(): Promise<DownloadedBook[]> {
  const value = await AsyncStorage.getItem(manifestKey);
  if (!value) return [];
  try {
    const entries = JSON.parse(value) as DownloadedBook[];
    return entries.filter((entry) => typeof entry.id === 'string' && typeof entry.size === 'number');
  } catch {
    return [];
  }
}

export async function downloadBook(book: BookSummary, content: string) {
  if (Platform.OS === 'web') throw new Error('Book downloads are available in the iOS and Android app.');
  const { booksDirectory, file } = await bookFile(book.id);
  booksDirectory.create({ intermediates: true, idempotent: true });
  file.create({ intermediates: true, overwrite: true });
  file.write(content);
  const saved: DownloadedBook = {
    ...book,
    downloadedAt: new Date().toISOString(),
    size: file.size,
  };
  const current = await downloadedBooks();
  await AsyncStorage.setItem(
    manifestKey,
    JSON.stringify([saved, ...current.filter((entry) => entry.id !== book.id)]),
  );
  return saved;
}

export async function removeDownloadedBook(bookId: string) {
  if (Platform.OS !== 'web') {
    const { file } = await bookFile(bookId);
    if (file.exists) file.delete();
  }
  const current = await downloadedBooks();
  await AsyncStorage.setItem(
    manifestKey,
    JSON.stringify(current.filter((entry) => entry.id !== bookId)),
  );
}

export async function readDownloadedBook(bookId: string) {
  if (Platform.OS === 'web') return null;
  const { file } = await bookFile(bookId);
  return file.exists ? file.text() : null;
}

async function bookFile(bookId: string) {
  const { Directory, File, Paths } = await import('expo-file-system');
  const booksDirectory = new Directory(Paths.document, 'almonium-books');
  return { booksDirectory, file: new File(booksDirectory, `${bookId}.html`) };
}
