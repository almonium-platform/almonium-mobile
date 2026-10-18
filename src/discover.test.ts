import { describe, expect, it } from 'vitest';

import {
  clipUri,
  normalizedLookupEntry,
  orderedPronunciations,
  parseDiscoverLookup,
  tokenizeSentence,
  type DiscoverPronunciation,
} from './discover';

describe('discover text handling', () => {
  it('keeps words with apostrophes and dashes intact', () => {
    expect(tokenizeSentence("L'été d'aujourd’hui — très-bien.")).toEqual([
      "L'été",
      "d'aujourd’hui",
      'très-bien',
    ]);
  });

  it('removes punctuation around a lookup entry', () => {
    expect(normalizedLookupEntry('“verließ.”')).toBe('verließ');
  });
});

describe('parseDiscoverLookup', () => {
  const legacy = {
    entry: 'house',
    sourceContext: null,
    language: 'EN',
    translationLanguage: 'UK',
    provider: 'free-dictionary',
    frequency: { score: 6.1, band: 'common', provenance: 'subtlex' },
    senses: [{ index: 1, headword: 'house', partOfSpeech: 'noun', transcription: 'haʊs', translations: ['будинок'] }],
  };

  it('keeps a response without the lexicon fields working, with empty lists and nulls', () => {
    const lookup = parseDiscoverLookup(legacy);
    expect(lookup.entry).toBe('house');
    expect(lookup.provider).toBe('free-dictionary');
    expect(lookup.frequency).toEqual({ score: 6.1, band: 'common', provenance: 'subtlex' });
    expect(lookup.pronunciations).toEqual([]);
    expect(lookup.senses).toEqual([
      {
        index: 1,
        headword: 'house',
        partOfSpeech: 'noun',
        transcription: 'haʊs',
        translations: ['будинок'],
        definition: null,
        cefr: null,
        examples: [],
      },
    ]);
  });

  it('reads pronunciations, definitions, levels and examples when the lexicon sends them', () => {
    const lookup = parseDiscoverLookup({
      ...legacy,
      provider: 'lexicon',
      pronunciations: [
        { variety: 'en-GB', ipa: 'haʊs', clipUrl: '/public/lexicon/clips/0f1e', clipStatus: 'verified' },
        { variety: 'en-US', ipa: 'haʊs', clipUrl: '/public/lexicon/clips/9a2b', clipStatus: 'unverified' },
      ],
      senses: [
        {
          ...legacy.senses[0],
          definition: 'A building for people to live in.',
          cefr: 'A1',
          examples: [
            { text: 'They bought a house.', translation: 'Вони купили будинок.' },
            { text: 'The house is empty.', translation: null },
          ],
        },
      ],
    });
    expect(lookup.provider).toBe('lexicon');
    expect(lookup.pronunciations).toEqual([
      { variety: 'en-GB', ipa: 'haʊs', clipUrl: '/public/lexicon/clips/0f1e', clipStatus: 'verified' },
      { variety: 'en-US', ipa: 'haʊs', clipUrl: '/public/lexicon/clips/9a2b', clipStatus: 'unverified' },
    ]);
    expect(lookup.senses[0].definition).toBe('A building for people to live in.');
    expect(lookup.senses[0].cefr).toBe('A1');
    expect(lookup.senses[0].examples).toEqual([
      { text: 'They bought a house.', translation: 'Вони купили будинок.' },
      { text: 'The house is empty.', translation: null },
    ]);
  });

  it('keeps a pronunciation whose clip is missing and drops a status it does not know', () => {
    const lookup = parseDiscoverLookup({
      ...legacy,
      pronunciations: [
        { variety: 'en-GB', ipa: 'haʊs', clipUrl: null, clipStatus: null },
        { variety: 'en-US', ipa: null, clipUrl: '/public/lexicon/clips/9a2b', clipStatus: 'pending' },
        'not a pronunciation',
      ],
    });
    expect(lookup.pronunciations).toEqual([
      { variety: 'en-GB', ipa: 'haʊs', clipUrl: null, clipStatus: null },
      { variety: 'en-US', ipa: null, clipUrl: '/public/lexicon/clips/9a2b', clipStatus: null },
    ]);
  });

  it('drops an example without text and tolerates an empty body', () => {
    const lookup = parseDiscoverLookup({
      ...legacy,
      senses: [{ ...legacy.senses[0], examples: [{ text: '', translation: 'x' }, { translation: 'y' }] }],
    });
    expect(lookup.senses[0].examples).toEqual([]);
    expect(parseDiscoverLookup(undefined)).toEqual({
      entry: '',
      sourceContext: null,
      language: '',
      translationLanguage: '',
      provider: null,
      frequency: null,
      pronunciations: [],
      senses: [],
    });
  });
});

describe('pronunciation order and clip address', () => {
  const british: DiscoverPronunciation = { variety: 'en-GB', ipa: 'haʊs', clipUrl: '/public/lexicon/clips/1', clipStatus: 'verified' };
  const american: DiscoverPronunciation = { variety: 'en-US', ipa: 'haʊs', clipUrl: null, clipStatus: null };

  it('puts the learner’s own variety first and otherwise keeps the dictionary order', () => {
    expect(orderedPronunciations([british, american], 'en-us')).toEqual([american, british]);
    expect(orderedPronunciations([british, american], 'en-GB')).toEqual([british, american]);
    expect(orderedPronunciations([british, american], undefined)).toEqual([british, american]);
    expect(orderedPronunciations([british, american], 'en-AU')).toEqual([british, american]);
  });

  it('prepends the API base to a relative clip path and leaves an absolute one alone', () => {
    expect(clipUri('https://api.example.test/api/v1', '/public/lexicon/clips/1')).toBe(
      'https://api.example.test/api/v1/public/lexicon/clips/1',
    );
    expect(clipUri('https://api.example.test/api/v1', 'public/lexicon/clips/1')).toBe(
      'https://api.example.test/api/v1/public/lexicon/clips/1',
    );
    expect(clipUri('https://api.example.test/api/v1', 'https://cdn.example.test/clip.mp3')).toBe(
      'https://cdn.example.test/clip.mp3',
    );
  });
});
