import type { CardDraft, LearningCard } from '@/src/types';

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
    partOfSpeech: draft.partOfSpeech,
    selectedSense: draft.selectedSense,
    sourceContext: draft.sourceContext,
    learningIntents: draft.learningIntents,
    deletedTranslationsIds,
  };
}

export function relativeTime(value: string, now = new Date()) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  return new Date(value).toLocaleDateString();
}
