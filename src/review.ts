import type { LearningIntent } from '@/src/types';

export type ReviewPromptType = 'MEANING_RECALL' | 'FORM_RECALL' | 'SENSE_DISCRIMINATION';
export type ReviewOutcome =
  | 'CORRECT'
  | 'RECOVERED_WITH_HINT'
  | 'INCORRECT'
  | 'CONFUSED'
  | 'TYPO_CORRECTION';

export interface ReviewSummary {
  dueCount: number;
  sessionSize: number;
  understandCount: number;
  produceCount: number;
  disambiguateCount: number;
  leechCount: number;
  leeches: LeechItem[];
}

export interface LeechItem {
  itemId: string;
  entry: string;
  failedPromptType: string | null;
  failureCount: number;
}

export interface ReviewHint {
  type: string;
  label: string;
  cost: string;
  content: string;
}

export interface ReviewItem {
  itemId: string;
  promptId: string;
  intent: LearningIntent;
  promptType: ReviewPromptType;
  prompt: string;
  sourceContext: string | null;
  language: string;
  savedAt: string;
  seenCount: number;
  hints: ReviewHint[];
}

export interface ReviewSession {
  sessionId: string;
  backlogCount: number;
  items: ReviewItem[];
}

export interface ConfusedItem {
  itemId: string;
  entry: string;
  meaning: string | null;
  example: string | null;
  directionCount: number;
}

export interface ReviewAnswer {
  eventId: string;
  outcome: ReviewOutcome;
  answer: string;
  expectedAnswer: string;
  confusedWith: ConfusedItem | null;
  dueAt: string;
  leech: boolean;
  completedCount: number;
  sessionSize: number;
}

export interface ReviewSessionResult {
  total: number;
  straightThrough: number;
  afterHint: number;
  confused: number;
  stillDue: number;
  dessertSentences: string[];
}

export function intentLabel(intent: LearningIntent) {
  return {
    UNDERSTAND: 'Understand',
    PRODUCE: 'Produce',
    PRONOUNCE: 'Pronounce',
    DISAMBIGUATE: 'Tell apart',
    CHUNK: 'Use the chunk',
  }[intent];
}

export function intentInstruction(intent: LearningIntent) {
  if (intent === 'UNDERSTAND') return 'Write what this means.';
  if (intent === 'DISAMBIGUATE') return 'Write the exact word that fits this meaning.';
  return 'Write it in the language you are learning.';
}
