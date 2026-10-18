export interface DiscoverFrequency {
  score: number;
  band: string;
  provenance: string;
}

export type ClipStatus = 'verified' | 'unverified';

/** One way the word is said; `clipUrl` is a path under the API base, the client prepends its own. */
export interface DiscoverPronunciation {
  variety: string | null;
  ipa: string | null;
  clipUrl: string | null;
  clipStatus: ClipStatus | null;
}

export interface DiscoverExample {
  text: string;
  translation: string | null;
}

export interface DiscoverSense {
  index: number;
  headword: string;
  partOfSpeech: string | null;
  transcription: string | null;
  translations: string[];
  definition: string | null;
  cefr: string | null;
  examples: DiscoverExample[];
}

export interface DiscoverLookup {
  entry: string;
  sourceContext: string | null;
  language: string;
  translationLanguage: string;
  provider: string | null;
  frequency: DiscoverFrequency | null;
  pronunciations: DiscoverPronunciation[];
  senses: DiscoverSense[];
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
const record = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const list = (value: unknown) => (Array.isArray(value) ? value : []);

function parsePronunciation(value: unknown): DiscoverPronunciation | null {
  const data = record(value);
  if (!data) return null;
  const status = text(data.clipStatus);
  return {
    variety: text(data.variety),
    ipa: text(data.ipa),
    clipUrl: text(data.clipUrl),
    clipStatus: status === 'verified' || status === 'unverified' ? status : null,
  };
}

function parseExample(value: unknown): DiscoverExample | null {
  const data = record(value);
  const sentence = data && text(data.text);
  if (!sentence) return null;
  return { text: sentence, translation: text(data.translation) };
}

function parseSense(value: unknown): DiscoverSense | null {
  const data = record(value);
  if (!data) return null;
  return {
    index: typeof data.index === 'number' ? data.index : 0,
    headword: text(data.headword) ?? '',
    partOfSpeech: text(data.partOfSpeech),
    transcription: text(data.transcription),
    translations: list(data.translations).filter((item): item is string => typeof item === 'string'),
    definition: text(data.definition),
    cefr: text(data.cefr),
    examples: list(data.examples).flatMap((item) => parseExample(item) ?? []),
  };
}

/**
 * Shapes a lookup response for the screen. The lexicon fields (pronunciations, definitions, CEFR,
 * examples) are additive; a backend that does not send them yet yields empty lists and nulls.
 */
export function parseDiscoverLookup(value: unknown): DiscoverLookup {
  const data = record(value) ?? {};
  const frequency = record(data.frequency);
  return {
    entry: text(data.entry) ?? '',
    sourceContext: text(data.sourceContext),
    language: text(data.language) ?? '',
    translationLanguage: text(data.translationLanguage) ?? '',
    provider: text(data.provider),
    frequency:
      frequency && typeof frequency.score === 'number'
        ? { score: frequency.score, band: text(frequency.band) ?? '', provenance: text(frequency.provenance) ?? '' }
        : null,
    pronunciations: list(data.pronunciations).flatMap((item) => parsePronunciation(item) ?? []),
    senses: list(data.senses).flatMap((item) => parseSense(item) ?? []),
  };
}

/** The learner's own variety first, the rest in the order the dictionary gave them. */
export function orderedPronunciations(pronunciations: DiscoverPronunciation[], preferredVariety?: string | null) {
  const preferred = preferredVariety?.toLowerCase();
  if (!preferred) return pronunciations;
  return [
    ...pronunciations.filter((item) => item.variety?.toLowerCase() === preferred),
    ...pronunciations.filter((item) => item.variety?.toLowerCase() !== preferred),
  ];
}

/** Where a clip is fetched from: the API base plus the path the dictionary sent, or that path if it is already absolute. */
export function clipUri(apiBaseUrl: string, clipUrl: string) {
  return /^https?:\/\//.test(clipUrl) ? clipUrl : `${apiBaseUrl}${clipUrl.startsWith('/') ? '' : '/'}${clipUrl}`;
}

export function tokenizeSentence(value: string) {
  return value.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
}

export function normalizedLookupEntry(value: string) {
  return value.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}'’-]+$/gu, '').trim();
}
