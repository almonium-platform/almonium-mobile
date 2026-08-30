export interface DiscoverFrequency {
  score: number;
  band: string;
  provenance: string;
}

export interface DiscoverSense {
  index: number;
  headword: string;
  partOfSpeech: string | null;
  transcription: string | null;
  translations: string[];
}

export interface DiscoverLookup {
  entry: string;
  sourceContext: string | null;
  language: string;
  translationLanguage: string;
  provider: string | null;
  frequency: DiscoverFrequency | null;
  senses: DiscoverSense[];
}

export function tokenizeSentence(value: string) {
  return value.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
}

export function normalizedLookupEntry(value: string) {
  return value.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}'’-]+$/gu, '').trim();
}
