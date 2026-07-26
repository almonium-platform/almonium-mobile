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
  };
  interests: Interest[];
}

export type SetupStep = 'WELCOME' | 'PLAN' | 'LANGUAGES' | 'PROFILE' | 'INTERESTS' | 'COMPLETED';

export interface Interest {
  id: number;
  name: string;
}

export interface BookSummary {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  coverImageUrl: string;
  wordCount: number;
  rating: number;
  language: string;
  levelFrom: CefrLevel;
  levelTo: CefrLevel;
  progressPercentage: number | null;
  hasParallelTranslation: boolean;
  hasTranslation: boolean;
  isTranslation: boolean;
}

export interface BookDetails extends BookSummary {
  description: string;
  favorite: boolean;
  languageVariants: { id: number; language: string }[];
  orderLanguage?: string;
  originalLanguage?: string;
  originalId?: number;
  translator?: string;
}

export interface BookMiniDetails {
  progressPercentage: number;
  language: string;
  languageVariants: { id: number; language: string }[];
}

export interface Bookshelf {
  continueReading: BookSummary[];
  available: BookSummary[];
  favorites: BookSummary[];
}
