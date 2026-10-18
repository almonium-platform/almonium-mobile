import { afterEach, expect, it, vi } from 'vitest';

import { api } from './api';

vi.mock('@/src/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('@/src/config', () => ({ config: { apiBaseUrl: 'https://api.example.test/api/v1' } }));

afterEach(() => vi.unstubAllGlobals());

it('looks a word up anonymously and shapes a response that lacks the lexicon fields', async () => {
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          entry: 'Haus',
          sourceContext: null,
          language: 'DE',
          translationLanguage: 'EN',
          provider: 'free-dictionary',
          frequency: null,
          senses: [{ index: 1, headword: 'Haus', partOfSpeech: 'noun', transcription: null, translations: ['house'] }],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetchMock);

  const lookup = await api.discover('Haus', 'DE', 'EN', 'Das Haus ist alt.');

  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://api.example.test/api/v1/public/discover/lookup/DE/EN?entry=Haus&context=Das+Haus+ist+alt.',
    expect.objectContaining({ headers: { Accept: 'application/json' } }),
  );
  expect(lookup.pronunciations).toEqual([]);
  expect(lookup.senses[0]).toMatchObject({ translations: ['house'], definition: null, cefr: null, examples: [] });
});
