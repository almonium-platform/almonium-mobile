import { auth } from '@/src/firebase';
import type { Book, Bookshelf, CefrLevel, UserInfo } from '@/src/types';
import { config } from '@/src/config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function authorizedFetch(path: string, init: RequestInit = {}, forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new ApiError('Sign in required', 401);

  const token = await user.getIdToken(forceRefresh);
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await authorizedFetch(path, init);
  if (response.status === 401) response = await authorizedFetch(path, init, true);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message || `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<UserInfo>('/users/me'),
  updateUsername: (username: string) =>
    request<void>('/users/me/username', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    }),
  updatePrivacy: (hidden: boolean) =>
    request<void>('/profile/hidden', {
      method: 'PATCH',
      body: JSON.stringify({ hidden }),
    }),
  updateLearner: (language: string, updates: { active?: boolean; level?: CefrLevel }) =>
    request<void>(`/learners/${language}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  bookshelf: (language: string) =>
    request<Bookshelf>(`/books/language/${language}?includeTranslations=true`),
  publicBooks: () =>
    fetch(`${config.apiBaseUrl}/public/books`).then(async (response) => {
      if (!response.ok) throw new ApiError('Could not load books', response.status);
      return response.json() as Promise<Book[]>;
    }),
  book: (bookId: number, language: string) =>
    request<Book>(`/books/${bookId}/language/${language}`),
  bookText: async (bookId: number) => {
    const response = await authorizedFetch(`/books/${bookId}/text`);
    if (!response.ok) throw new ApiError('Could not load this book', response.status);
    return response.text();
  },
  saveProgress: (bookId: number, percentage: number) =>
    request<void>(`/books/${bookId}/progress?percentage=${Math.round(percentage)}`, {
      method: 'POST',
    }),
  setFavorite: (bookId: number, language: string, favorite: boolean) =>
    request<void>(`/books/${bookId}/language/${language}/favorite`, {
      method: favorite ? 'POST' : 'DELETE',
    }),
};
