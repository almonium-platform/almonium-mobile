import { auth } from '@/src/firebase';
import type {
  ActiveLanguagePolicy,
  AddedWordsResult,
  BookDetails,
  BookMiniDetails,
  BookSummary,
  Bookshelf,
  AppNotification,
  CardDraft,
  CefrLevel,
  FoundingMemberStatus,
  Interest,
  LearningCard,
  LearningStats,
  Learner,
  PlanOffer,
  PublicUserSummary,
  RelatedUserSummary,
  RelationshipAction,
  SetupStep,
  SharedCardView,
  SharedDeckView,
  SharedLinkViewerStatus,
  TranslationOrder,
  TranslationRequestQuota,
  UserProfile,
  UserInfo,
} from '@/src/types';
import { config } from '@/src/config';
import { decodeJsonBody, errorMessageFromBody } from '@/src/http-errors';
import type { DiscoverLookup } from '@/src/discover';
import type { LearningActivity, Rhythm, WeeklyTarget } from '@/src/rhythm';
import type {
  ReviewAnswer,
  ReviewSession,
  ReviewSessionResult,
  ReviewSummary,
} from '@/src/review';

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

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(`${config.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(await responseError(response), response.status);
  return decodeJsonBody<T>(await response.text());
}

export const api = {
  requestEmailVerification: async () => {
    const user = auth.currentUser;
    if (!user) throw new ApiError('Sign in required', 401);
    return publicPost<void>('/public/auth/email-verification', {idToken: await user.getIdToken(true)});
  },
  requestPasswordReset: (email: string) => publicPost<{message: string}>('/public/auth/password-resets', {email}),
  /** Sends the verification link to the new address. The backend requires a recent sign-in. */
  requestEmailChange: (email: string) =>
    request<void>('/auth/email-changes', { method: 'POST', body: JSON.stringify({ email }) }),
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
  setupLevels: (levels: { language: string; cefrLevel: CefrLevel }[]) =>
    request<void>('/onboarding/levels', {
      method: 'PUT',
      body: JSON.stringify(levels),
    }),
  setupInterests: (ids: number[]) =>
    request<void>('/onboarding/interests', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  supportedLanguages: () => publicRequest<string[]>('/public/info/languages/supported'),
  interests: () => publicRequest<Interest[]>('/public/info/interests'),
  plans: () => publicRequest<PlanOffer[]>('/public/plans'),
  foundingMembers: () => publicRequest<FoundingMemberStatus>('/public/founding-members'),
  discover: (entry: string, language: string, translationLanguage: string, context?: string) => {
    const query = new URLSearchParams({ entry });
    if (context) query.set('context', context);
    return publicRequest<DiscoverLookup>(
      `/public/discover/lookup/${encodeURIComponent(language)}/${encodeURIComponent(translationLanguage)}?${query}`,
    );
  },
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
  updateSocialEmails: (socialEmails: boolean) =>
    request<void>('/profile/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ socialEmails }),
    }),
  updateInterests: (ids: number[]) =>
    request<void>('/users/me/interests', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),
  updateFluentLanguages: (langCodes: string[]) =>
    request<void>('/users/me/langs/fluent', {
      method: 'PUT',
      body: JSON.stringify({ langCodes }),
    }),
  /** One of the pictures the clients ship. Nothing is uploaded anywhere. */
  chooseAvatar: (avatarUrl: string) =>
    request<void>('/profiles/me/avatars/default', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl }),
    }),
  resetAvatar: () => request<void>('/profiles/me/avatars/current', { method: 'PATCH' }),
  updateLearner: (language: string, updates: { active?: boolean; level?: CefrLevel }) =>
    request<Learner>(`/learners/${language}`, {
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
  activeLanguagePolicy: () => request<ActiveLanguagePolicy>('/learners/active-language-policy'),
  keepOnDowngrade: (language: string) =>
    request<ActiveLanguagePolicy>('/learners/keep-on-downgrade', {
      method: 'PUT',
      body: JSON.stringify({ language }),
    }),
  rhythm: (today: string) => request<Rhythm>(`/learning/rhythm?today=${today}`),
  setRhythmTarget: (language: string, target: WeeklyTarget) =>
    request<void>('/learning/rhythm/target', {
      method: 'PUT',
      body: JSON.stringify({ language, target }),
    }),
  recordActivity: (activity: LearningActivity) =>
    request<void>('/learning/activity', { method: 'POST', body: JSON.stringify(activity) }),
  learningStats: (language: string) => request<LearningStats>(`/learning/stats/${language}`),
  bookshelf: (language: string) =>
    request<Bookshelf>(`/books/language/${language}?includeTranslations=true`),
  publicBooks: () =>
    publicRequest<BookSummary[]>('/public/books'),
  book: (bookId: string, language: string) =>
    request<BookDetails>(`/books/${bookId}/language/${language}`),
  bookInfo: (bookId: string) => request<BookMiniDetails>(`/books/${bookId}`),
  bookText: async (bookId: string) => {
    const response = await authorizedFetch(`/books/${bookId}/text`);
    if (!response.ok) throw new ApiError('Could not load this book', response.status);
    return response.text();
  },
  parallelText: async (bookId: string, language: string) => {
    const response = await authorizedFetch(`/books/${bookId}/parallel/${language}`);
    if (!response.ok) throw new ApiError(await responseError(response), response.status);
    return response.text();
  },
  saveProgress: (bookId: string, percentage: number) =>
    request<void>(`/books/${bookId}/progress?percentage=${Math.round(percentage)}`, {
      method: 'POST',
    }),
  deleteProgress: (bookId: string) =>
    request<void>(`/books/${bookId}/progress`, { method: 'DELETE' }),
  setFavorite: (bookId: string, language: string, favorite: boolean) =>
    request<void>(`/books/${bookId}/language/${language}/favorite`, {
      method: favorite ? 'POST' : 'DELETE',
    }),
  translationOrders: () => request<TranslationOrder[]>('/books/orders'),
  translationQuota: () => request<TranslationRequestQuota>('/books/orders/quota'),
  requestTranslation: (bookId: string, language: string) =>
    request<TranslationOrder>(`/books/${bookId}/language/${language}/orders`, { method: 'POST' }),
  withdrawTranslation: (bookId: string, language: string) =>
    request<void>(`/books/${bookId}/language/${language}/orders`, { method: 'DELETE' }),
  cards: (language: string) => request<LearningCard[]>(`/cards/lang/${language}`),
  reviewSummary: (language: string) => request<ReviewSummary>(`/review/summary/${language}`),
  startReview: (language: string) =>
    request<ReviewSession>(`/review/sessions/${language}`, { method: 'POST' }),
  answerReview: (
    sessionId: string,
    itemId: string,
    answer: { promptId: string; answer: string; hintsOpened: string[]; revealed: boolean },
  ) =>
    request<ReviewAnswer>(`/review/sessions/${sessionId}/items/${itemId}/answer`, {
      method: 'POST',
      body: JSON.stringify(answer),
    }),
  reviewResult: (sessionId: string) =>
    request<ReviewSessionResult>(`/review/sessions/${sessionId}/result`),
  markReviewMistype: (eventId: string) =>
    request<void>(`/review/events/${eventId}/mistype`, { method: 'POST' }),
  reencounterReviewItem: (itemId: string) =>
    request<void>(`/review/leeches/${itemId}/reencounter`, { method: 'POST' }),
  card: (cardId: string) => request<LearningCard>(`/cards/${cardId}`),
  createCard: (draft: CardDraft) =>
    request<void>('/cards', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
  updateCard: (
    cardId: string,
    language: string,
    updates: Partial<Omit<CardDraft, 'language' | 'learnt'>> & {
      deletedTranslationsIds?: string[];
      deletedExamplesIds?: string[];
    },
  ) =>
    request<void>('/cards', {
      method: 'PUT',
      body: JSON.stringify({ id: cardId, language, ...updates }),
    }),
  deleteCard: (cardId: string) => request<void>(`/cards/${cardId}`, { method: 'DELETE' }),
  publicSharedCard: (publicId: string) => publicRequest<SharedCardView>(`/public/shares/cards/${publicId}`),
  publicSharedDeck: (shareId: string) =>
    publicRequest<SharedDeckView>(`/public/shares/decks/${encodeURIComponent(shareId)}`),
  sharedCardViewer: (publicId: string) =>
    request<SharedLinkViewerStatus>(`/shares/cards/${publicId}/viewer`),
  sharedDeckViewer: (shareId: string) =>
    request<SharedLinkViewerStatus>(`/shares/decks/${encodeURIComponent(shareId)}/viewer`),
  addSharedCard: (publicId: string) =>
    request<AddedWordsResult>(`/shares/cards/${publicId}/words`, { method: 'POST' }),
  addFromSharedDeck: (shareId: string, wordIds: string[]) =>
    request<AddedWordsResult>(`/shares/decks/${encodeURIComponent(shareId)}/words`, {
      method: 'POST',
      body: JSON.stringify({ wordIds }),
    }),
  notifications: () => request<AppNotification[]>('/notifications'),
  markAllNotificationsRead: () =>
    request<void>('/notifications/read', { method: 'PATCH' }),
  markNotificationRead: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markNotificationUnread: (id: string) =>
    request<void>(`/notifications/${id}/unread`, { method: 'PATCH' }),
  deleteNotification: (id: string) =>
    request<void>(`/notifications/${id}`, { method: 'DELETE' }),
  friends: () => request<RelatedUserSummary[]>('/relationships'),
  blockedUsers: () => request<RelatedUserSummary[]>('/relationships/blocked'),
  sentFriendRequests: () =>
    request<RelatedUserSummary[]>('/relationships/requests/sent'),
  receivedFriendRequests: () =>
    request<RelatedUserSummary[]>('/relationships/requests/received'),
  searchUsers: (username: string) =>
    request<PublicUserSummary[]>(
      `/relationships/search/all?username=${encodeURIComponent(username)}`,
    ),
  userProfile: (id: string) => request<UserProfile>(`/profile/${id}`),
  publicUserProfile: (id: string) => publicRequest<UserProfile>(`/public/profiles/${id}`),
  requestFriendship: (recipientId: string) =>
    request<UserProfile>('/relationships', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    }),
  manageRelationship: (relationshipId: string, action: RelationshipAction) =>
    request<UserProfile>(`/relationships/${relationshipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
  blockUser: (id: string) =>
    request<UserProfile>(`/relationships/block/${id}`, { method: 'POST' }),
  customerPortal: () =>
    request<{ sessionUrl: string }>('/subscriptions/portal', { method: 'POST' }),
  deleteAccount: () => request<void>('/auth/me', { method: 'DELETE' }),
};
