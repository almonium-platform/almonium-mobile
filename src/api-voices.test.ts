import {afterEach, expect, it, vi} from 'vitest';
import {api} from './api';

vi.mock('@/src/firebase', () => ({auth: {currentUser: {getIdToken: async () => 'test-token'}}}));
vi.mock('@/src/config', () => ({config: {apiBaseUrl: 'https://api.example.test/api/v1'}}));

afterEach(() => vi.unstubAllGlobals());

it('lists pronunciation availability using native bearer authentication', async () => {
  const unavailable = {language: 'DE', variety: 'de-CH', defaultVariety: false,
    available: false, unavailableReason: 'NO_ENABLED_VOICE', provider: null,
    languageCode: null, voiceId: null, gender: null};
  const fetchMock = vi.fn().mockImplementation(async () =>
    new Response(JSON.stringify([unavailable]), {status: 200}));
  vi.stubGlobal('fetch', fetchMock);

  expect(await api.getVoices('DE')).toEqual([unavailable]);
  expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.test/api/v1/lang/voices/DE',
    expect.objectContaining({headers: {Accept: 'application/json', Authorization: 'Bearer test-token'}}));
  await api.getVoices();
  expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.test/api/v1/lang/voices', expect.any(Object));
});
