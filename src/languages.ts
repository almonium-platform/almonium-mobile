const names: Record<string, string> = {
  AR: 'Arabic',
  BG: 'Bulgarian',
  CS: 'Czech',
  DA: 'Danish',
  DE: 'German',
  EL: 'Greek',
  EN: 'English',
  ES: 'Spanish',
  FI: 'Finnish',
  FIL: 'Filipino',
  FR: 'French',
  HE: 'Hebrew',
  HI: 'Hindi',
  HU: 'Hungarian',
  ID: 'Indonesian',
  IT: 'Italian',
  JA: 'Japanese',
  KO: 'Korean',
  NL: 'Dutch',
  NO: 'Norwegian',
  PL: 'Polish',
  PT: 'Portuguese',
  RO: 'Romanian',
  RU: 'Russian',
  SK: 'Slovak',
  SV: 'Swedish',
  TH: 'Thai',
  TR: 'Turkish',
  UK: 'Ukrainian',
  VI: 'Vietnamese',
  ZH: 'Chinese',
};

export function languageName(code: string) {
  return names[code] || code;
}

export function sortLanguages(codes: string[]) {
  return [...codes].sort((a, b) => languageName(a).localeCompare(languageName(b)));
}
