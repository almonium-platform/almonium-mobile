import { auth } from '@/src/firebase';
import type {
  BookDetails,
  BookMiniDetails,
  BookSummary,
  Bookshelf,
  CefrLevel,
  Interest,
  Learner,
  SetupStep,
  UserInfo,
} from '@/src/types';
import { config } from '@/src/config';
import { decodeJsonBody, errorMessageFromBody } from '@/src/http-errors';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond', 0);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function responseError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  return errorMessageFromBody(body, response.status);
}

async function authorizedFetch(path: string, init: RequestInit = {}, forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new ApiError('Sign in required', 401);

  const token = await user.getIdToken(forceRefresh);
  return fetchWithTimeout(`${config.apiBaseUrl}${path}`, {
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
    throw new ApiError(await responseError(response), response.status);
  }
  return decodeJsonBody<T>(await response.text());
}

async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(`${config.apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(await responseError(response), response.status);
  return decodeJsonBody<T>(await response.text());
}

export const api = {
  me: () => request<UserInfo>('/users/me'),
  completeOnboardingStep: (step: SetupStep) =>
    request<void>(`/onboarding/step/${step}`, { method: 'PATCH' }),
  setupLanguages: (fluentLangs: string[], language: string, cefrLevel: CefrLevel) =>
    request<Learner[]>('/onboarding/langs', {
      method: 'PUT',
      body: JSON.stringify({
        fluentLangs,
        targetLangsData: [{ language, cefrLevel }],
      }),
    }),
  setupInterests: (ids: number[]) =>
    request<void>('/onboarding/interests', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  supportedLanguages: () => publicRequest<string[]>('/public/info/languages/supported'),
  interests: () => publicRequest<Interest[]>('/public/info/interests'),
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
  updateInterests: (ids: number[]) =>
    request<void>('/users/me/interests', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),
  updateLearner: (language: string, updates: { active?: boolean; level?: CefrLevel }) =>
    request<void>(`/learners/${language}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  addLearner: (language: string, cefrLevel: CefrLevel) =>
    request<Learner[]>('/learners', {
      method: 'POST',
      body: JSON.stringify({ data: [{ language, cefrLevel }] }),
    }),
  deleteLearner: (language: string) =>
    request<void>(`/learners/${language}`, { method: 'DELETE' }),
  bookshelf: (language: string) =>
    request<Bookshelf>(`/books/language/${language}?includeTranslations=true`),
  publicBooks: () =>
    publicRequest<BookSummary[]>('/public/books'),
  book: (bookId: number, language: string) =>
    request<BookDetails>(`/books/${bookId}/language/${language}`),
  bookInfo: (bookId: number) => request<BookMiniDetails>(`/books/${bookId}`),
  bookText: async (bookId: number) => {
    const response = await authorizedFetch(`/books/${bookId}/text`);
    if (!response.ok) throw new ApiError('Could not load this book', response.status);
    return response.text();
  },
  parallelText: async (bookId: number, language: string) => {
    const response = await authorizedFetch(`/books/${bookId}/parallel/${language}`);
    if (!response.ok) throw new ApiError(await responseError(response), response.status);
    return response.text();
  },
  saveProgress: (bookId: number, percentage: number) =>
    request<void>(`/books/${bookId}/progress?percentage=${Math.round(percentage)}`, {
      method: 'POST',
    }),
  deleteProgress: (bookId: number) =>
    request<void>(`/books/${bookId}/progress`, { method: 'DELETE' }),
  setFavorite: (bookId: number, language: string, favorite: boolean) =>
    request<void>(`/books/${bookId}/language/${language}/favorite`, {
      method: favorite ? 'POST' : 'DELETE',
    }),
  deleteAccount: () => request<void>('/auth/me', { method: 'DELETE' }),
};
