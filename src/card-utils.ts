import type { CardDraft, LearningCard } from '@/src/types';

export interface ReviewState {
  dueAt: string;
  intervalDays: number;
  repetitions: number;
  ease: number;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export function lines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function tags(value: string) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].map((text) => ({
    text,
  }));
}

export function createCardDraft(
  entry: string,
  language: string,
  translationsText: string,
  notes: string,
  tagsText: string,
): CardDraft {
  return {
    entry: entry.trim(),
    language,
    translations: lines(translationsText).map((translation) => ({ translation })),
    notes: notes.trim() || undefined,
    tags: tags(tagsText),
    examples: [],
    activeLearning: true,
    irregularPlural: false,
    falseFriend: false,
    irregularSpelling: false,
    learnt: false,
    priority: 0,
  };
}

export function cardUpdate(
  card: LearningCard,
  draft: CardDraft,
) {
  const translations = draft.translations.map((translation, index) => ({
    ...translation,
    id: card.translations[index]?.id,
  }));
  const deletedTranslationsIds = card.translations
    .slice(translations.length)
    .map((translation) => translation.id)
    .filter((id): id is string => Boolean(id));

  return {
    entry: draft.entry,
    translations,
    notes: draft.notes,
    tags: draft.tags,
    activeLearning: draft.activeLearning,
    irregularPlural: draft.irregularPlural,
    falseFriend: draft.falseFriend,
    irregularSpelling: draft.irregularSpelling,
    priority: draft.priority,
    deletedTranslationsIds,
  };
}

export function nextReview(
  previous: ReviewState | undefined,
  rating: ReviewRating,
  now = new Date(),
): ReviewState {
  const current = previous ?? {
    dueAt: now.toISOString(),
    intervalDays: 0,
    repetitions: 0,
    ease: 2.5,
  };
  let intervalDays = current.intervalDays;
  let repetitions = current.repetitions;
  let ease = current.ease;

  if (rating === 'again') {
    intervalDays = 0;
    repetitions = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    repetitions += 1;
    const modifier = rating === 'hard' ? 1.2 : rating === 'easy' ? ease + 0.3 : ease;
    intervalDays =
      repetitions === 1
        ? rating === 'hard' ? 1 : rating === 'easy' ? 4 : 2
        : Math.max(1, Math.round(Math.max(1, intervalDays) * modifier));
    ease = Math.max(1.3, ease + (rating === 'hard' ? -0.15 : rating === 'easy' ? 0.15 : 0));
  }

  const dueAt = new Date(now);
  dueAt.setTime(dueAt.getTime() + (rating === 'again' ? 10 * 60_000 : intervalDays * 86_400_000));
  return { dueAt: dueAt.toISOString(), intervalDays, repetitions, ease };
}

export function dueCards(
  cards: LearningCard[],
  schedule: Record<string, ReviewState>,
  now = new Date(),
) {
  return [...cards]
    .filter((card) => !schedule[card.id] || new Date(schedule[card.id].dueAt) <= now)
    .sort((a, b) => {
      const aDue = schedule[a.id]?.dueAt ?? '';
      const bDue = schedule[b.id]?.dueAt ?? '';
      return aDue.localeCompare(bDue) || a.entry.localeCompare(b.entry);
    });
}

export function relativeTime(value: string, now = new Date()) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  return new Date(value).toLocaleDateString();
}
