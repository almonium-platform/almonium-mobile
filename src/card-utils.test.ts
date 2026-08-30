import { describe, expect, it } from 'vitest';

import { cardUpdate, createCardDraft, relativeTime } from './card-utils';
import type { LearningCard } from './types';

const card: LearningCard = {
  id: 'card-1',
  entry: 'bonjour',
  language: 'FR',
  translations: [
    { id: 'one', translation: 'hello' },
    { id: 'two', translation: 'good morning' },
  ],
};

describe('card form payloads', () => {
  it('normalizes translations and unique tags', () => {
    const draft = createCardDraft(' bonjour ', 'FR', 'hello\n\ngood morning ', '', 'greeting, greeting');
    expect(draft.entry).toBe('bonjour');
    expect(draft.translations).toEqual([{ translation: 'hello' }, { translation: 'good morning' }]);
    expect(draft.tags).toEqual([{ text: 'greeting' }]);
  });

  it('preserves translation ids and reports removed translations', () => {
    const draft = createCardDraft('bonjour', 'FR', 'hi', '', '');
    expect(cardUpdate(card, draft)).toMatchObject({
      translations: [{ id: 'one', translation: 'hi' }],
      deletedTranslationsIds: ['two'],
    });
  });
});

it('formats compact notification ages', () => {
  expect(relativeTime('2026-07-26T08:00:00Z', new Date('2026-07-26T10:30:00Z'))).toBe('2h');
});
