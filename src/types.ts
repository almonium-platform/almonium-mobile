export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Learner {
  id: string;
  language: string;
  selfReportedLevel: CefrLevel;
  active: boolean;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  hidden: boolean;
  avatarUrl: string | null;
  streak: number | null;
  fluentLangs: string[];
  learners: Learner[];
  premium: boolean;
  setupStep: SetupStep;
  subscription: {
    name: string;
    limits: Record<string, number>;
    type: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
    autoRenewal: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  interests: Interest[];
}

export type SetupStep = 'WELCOME' | 'PLAN' | 'LANGUAGES' | 'PROFILE' | 'INTERESTS' | 'COMPLETED';

export interface Interest {
  id: number;
  name: string;
}

export interface Avatar {
  id: string;
  url: string;
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
  orderLanguage?: string;
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

export interface CardTranslation {
  id?: string;
  translation: string;
}

export interface CardExample {
  id?: string;
  example: string;
  translation?: string;
}

export interface LearningCard {
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

export type LearningIntent = 'UNDERSTAND' | 'PRODUCE' | 'DISAMBIGUATE' | 'PRONOUNCE';

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
  | 'TRANSLATION_ORDER_COMPLETED';

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
  loginStreak?: number;
  fluentLangs?: string[];
  targetLangs?: { language: string; cefrLevel: CefrLevel }[];
  relationshipId: string | null;
  relationshipStatus: RelationshipStatus;
  acceptsRequests: boolean | null;
}
