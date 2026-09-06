export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Learner {
  id: string;
  language: string;
  selfReportedLevel: CefrLevel;
  active: boolean;
}

export type PlanType = 'MONTHLY' | 'YEARLY' | 'LIFETIME';

export type PlanFeature =
  | 'MAX_TARGET_LANGS'
  | 'MAX_ACTIVE_LANGS'
  | 'MAX_FLUENT_LANGS'
  | 'MAX_BOOK_IMPORTS_PER_MONTH'
  | 'MAX_TRANSLATION_REQUESTS_PER_MONTH';

export interface SubscriptionInfo {
  name: string;
  limits: Partial<Record<PlanFeature, number>>;
  type: PlanType;
  autoRenewal: boolean;
  startDate: string | null;
  endDate: string | null;
  /** A founding-member place: the price is locked while the subscription runs. */
  founder?: boolean;
  /** Present only while a cadence change is pending. */
  scheduledChange?: { type: PlanType; effectiveAt: string } | null;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  hidden: boolean;
  avatarUrl: string | null;
  /** Stream Chat credential. In memory only - it is never written to the offline profile cache. */
  streamChatToken?: string;
  fluentLangs: string[];
  learners: Learner[];
  premium: boolean;
  setupStep: SetupStep;
  subscription: SubscriptionInfo;
  interests: Interest[];
  uiPreferences?: Record<string, unknown> | null;
  notifications?: { socialEmails: boolean } | null;
}

export type SetupStep =
  | 'WELCOME'
  | 'LANGUAGES'
  | 'LEVEL'
  | 'INTERESTS'
  | 'PROFILE'
  | 'GREETING'
  | 'COMPLETED';

export interface Interest {
  id: number;
  name: string;
}

export interface BookSummary {
  id: string;
  workSlug: string;
  title: string;
  author: string;
  publicationYear: number;
  coverUrl: string | null;
  wordCount: number;
  language: string;
  cefrLevel: CefrLevel;
  progressPercentage: number | null;
  hasParallelTranslation: boolean;
  hasTranslation: boolean;
  isTranslation: boolean;
}

export interface BookDetails extends BookSummary {
  favorite: boolean;
  languageVariants: { id: string; language: string }[];
  originalLanguage?: string;
  originalId?: string;
  translator?: string;
}

export interface BookMiniDetails {
  progressPercentage: number;
  language: string;
  languageVariants: { id: string; language: string }[];
}

export interface Bookshelf {
  continueReading: BookSummary[];
  available: BookSummary[];
  favorites: BookSummary[];
}

/** One request for a missing alignment. `fulfilledBookId` is set only once it is READY. */
export interface TranslationOrder {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  language: string;
  status: 'ASKED' | 'READY' | 'DECLINED';
  fulfilledBookId: string | null;
  createdAt: string;
}

export interface TranslationRequestQuota {
  limit: number;
  used: number;
  periodStartsAt: string;
  periodEndsAt: string;
}

export interface CardTranslation {
  id?: string;
  translation: string;
}

export interface CardExample {
  id?: string;
  example: string;
  translation?: string;
}

export interface LearningItem {
  id: string;
  publicId?: string;
  userId?: string;
  entry: string;
  language: string;
  translations: CardTranslation[];
  notes?: string;
  tags?: { text: string }[];
  examples?: CardExample[];
  createdAt?: string;
  updatedAt?: string;
  iteration?: number;
  priority?: number;
  activeLearning?: boolean;
  irregularPlural?: boolean;
  irregularSpelling?: boolean;
  falseFriend?: boolean;
  partOfSpeech?: string;
  selectedSense?: string;
  sourceContext?: string;
  learningIntents?: LearningIntent[];
}

/** @deprecated API paths still use /cards during the backend migration. */
export type LearningCard = LearningItem;

export type LearningIntent = 'UNDERSTAND' | 'PRODUCE' | 'DISAMBIGUATE' | 'PRONOUNCE' | 'CHUNK';

export interface CardDraft {
  entry: string;
  language: string;
  translations: CardTranslation[];
  notes?: string;
  tags: { text: string }[];
  examples?: CardExample[];
  activeLearning: boolean;
  irregularPlural: boolean;
  falseFriend: boolean;
  irregularSpelling: boolean;
  learnt: boolean;
  priority: number;
  partOfSpeech?: string;
  selectedSense?: string;
  sourceContext?: string;
  learningIntents?: LearningIntent[];
}

export type NotificationType =
  | 'FRIENDSHIP_REQUESTED'
  | 'FRIENDSHIP_ACCEPTED'
  | 'TRANSLATION_ORDER_COMPLETED'
  | 'BOOK_IMPORT_READY'
  | 'BOOK_IMPORT_FAILED';

export interface AppNotification {
  id: string;
  title: string;
  type: NotificationType;
  message: string | null;
  pictureUrl: string | null;
  referenceId: string | null;
  senderId: string | null;
  createdAt: string;
  readAt: string | null;
}

export type RelationshipStatus =
  | 'FRIENDS'
  | 'BLOCKED'
  | 'PENDING_OUTGOING'
  | 'PENDING_INCOMING'
  | 'STRANGER';

export type RelationshipAction = 'ACCEPT' | 'REJECT' | 'CANCEL' | 'UNFRIEND' | 'UNBLOCK';

export interface PublicUserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
  premium: boolean;
}

export interface RelatedUserSummary extends PublicUserSummary {
  relationshipId: string;
  relationshipStatus: RelationshipStatus;
}

export interface UserProfile extends PublicUserSummary {
  registeredAt: string;
  hidden: boolean;
  interests?: string[];
  fluentLangs?: string[];
  targetLangs?: { language: string; cefrLevel: CefrLevel }[];
  relationshipId: string | null;
  relationshipStatus: RelationshipStatus;
  acceptsRequests: boolean | null;
}

/** The numbers on a profile that only move by reading. */
export interface LearningStats {
  wordsKept: number;
  booksFinished: number;
}

/**
 * What the account may do with its languages: how many may be active, when the once-a-month
 * switch comes back, and what there is to choose between.
 */
export interface ActiveLanguagePolicy {
  /** How many languages may be active now, or -1 for unlimited. */
  allowance: number;
  allowanceWithoutPlan: number;
  nextSwitchAllowedAt: string | null;
  /** Every language on the account, most recently read first. */
  languages: LanguageChoice[];
}

export interface LanguageChoice {
  language: string;
  cefrLevel: CefrLevel;
  wordsKept: number;
  lastReadOn: string | null;
  active: boolean;
  recommended: boolean;
}

/** A purchasable plan as the pricing card states it, limits included. */
export interface PlanOffer {
  id: number;
  name: string;
  type: PlanType;
  description: string | null;
  price: number;
  founderPrice: number | null;
  limits: Partial<Record<PlanFeature, number>>;
}

export interface FoundingMemberStatus {
  capacity: number;
  claimed: number;
}

export type SharedLinkStatus = 'ACTIVE' | 'REVOKED' | 'DELETED';

/** A word as a stranger sees it: entry and senses, none of the owner's progress. */
export interface SharedWord {
  id: string;
  entry: string;
  partOfSpeech: string | null;
  selectedSense: string | null;
  translations: string[];
  examples: { example: string; translation: string | null }[];
  sourceContext: string | null;
}

export interface Sharer {
  username: string;
  avatarUrl: string | null;
  premium: boolean;
}

export interface SharedCardView {
  language: string;
  word: SharedWord;
  sharer: Sharer;
}

export interface SharedDeckView {
  status: SharedLinkStatus;
  shareId: string | null;
  title: string | null;
  language: string | null;
  words: SharedWord[];
  sharer: Sharer | null;
}

/** What a signed-in viewer already holds of a shared object. */
export interface SharedLinkViewerStatus {
  owner: boolean;
  hasLearner: boolean;
  heldWordIds: string[];
  dueAmongHeld: number;
}

export interface AddedWordsResult {
  added: number;
  alreadyHeld: number;
  firstDueAt: string | null;
}
