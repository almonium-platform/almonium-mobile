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
  setupStep: string;
}

export interface Book {
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
  description: string;
  favorite: boolean;
  hasParallelTranslation: boolean;
}

export interface Bookshelf {
  continueReading: Book[];
  available: Book[];
  favorites: Book[];
}
