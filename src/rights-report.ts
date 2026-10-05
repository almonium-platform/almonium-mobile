import { msg, t } from './i18n';

/**
 * The report button on every book: who is writing, about which country, and what is wrong. A
 * report hides nothing by itself; it reaches the copyright address at once and a person decides.
 * Mirrors the web client's form and copy.
 */

/** Who is writing: a rights holder's report is the one that can end in a takedown. */
export const reporterRoles = [
  { value: 'RIGHTS_HOLDER', label: msg('I hold or represent the rights') },
  { value: 'READER', label: msg('I’m a reader') },
  { value: 'OTHER', label: msg('Other') },
] as const;
export type ReporterRole = (typeof reporterRoles)[number]['value'];

export const reportMessageMin = 10;
export const reportMessageMax = 4000;
export const reportNameMax = 200;
/** Where reports go when the server does not say. */
export const copyrightAddress = 'copyright@almonium.com';

export interface RightsReportRequest {
  role: ReporterRole;
  name?: string;
  /** A guest must leave one; a member is known by the bearer token and sends none. */
  email?: string;
  /** ISO alpha-2 of the country the report is about, or '' for everywhere. */
  country: string;
  message: string;
}

export interface RightsReportReceipt {
  id: string;
  contact: string;
}

/** What the form holds. */
export interface RightsReportDraft {
  role: ReporterRole | null;
  name: string;
  email: string;
  country: string;
  message: string;
  guest: boolean;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The one thing still missing before Send, or null when the report can go. */
export function reportMissing(draft: Pick<RightsReportDraft, 'role' | 'email' | 'message' | 'guest'>): string | null {
  if (draft.role === null) return t('Say who you are.');
  const message = draft.message.trim();
  if (message.length < reportMessageMin) {
    return t('Describe the problem: {left} more characters at least.', { left: reportMessageMin - message.length });
  }
  if (message.length > reportMessageMax) {
    return t('Shorten the message to {max} characters.', { max: reportMessageMax });
  }
  if (draft.guest) {
    const email = draft.email.trim();
    if (!email) return t('Leave your email so we can answer.');
    if (!emailPattern.test(email)) return t('Check the email address.');
  }
  return null;
}

/** The request body: trimmed, the name only when given, the email only from a guest. */
export function reportRequest(draft: RightsReportDraft & { role: ReporterRole }): RightsReportRequest {
  const name = draft.name.trim();
  return {
    role: draft.role,
    country: draft.country,
    message: draft.message.trim(),
    ...(name ? { name } : {}),
    ...(draft.guest ? { email: draft.email.trim() } : {}),
  };
}

/** The sentence that replaces the form once the report is in. */
export function reportThanks(contact: string | null | undefined): string {
  return t('Thanks — we’ll look at this within a day. You can also write to {address}.', { address: contact || copyrightAddress });
}

/** A failed send, said plainly: the rate limit by name, otherwise the server's reason. */
export function reportFailure(status: number | null, message: string | null): string {
  if (status === 429) return t('Too many reports from here; try again in an hour.');
  if (status && status >= 400 && status < 500 && message) return message;
  return t('Couldn’t send the report. Try again, or write to {address}.', { address: copyrightAddress });
}

// Every ISO 3166-1 alpha-2 country with its English short name. Hermes has no Intl.DisplayNames,
// so the names live here, marked for translation like the language names.
const countryNames: Record<string, string> = {
  AD: msg('Andorra'),
  AE: msg('United Arab Emirates'),
  AF: msg('Afghanistan'),
  AG: msg('Antigua & Barbuda'),
  AI: msg('Anguilla'),
  AL: msg('Albania'),
  AM: msg('Armenia'),
  AO: msg('Angola'),
  AQ: msg('Antarctica'),
  AR: msg('Argentina'),
  AS: msg('American Samoa'),
  AT: msg('Austria'),
  AU: msg('Australia'),
  AW: msg('Aruba'),
  AX: msg('Åland Islands'),
  AZ: msg('Azerbaijan'),
  BA: msg('Bosnia & Herzegovina'),
  BB: msg('Barbados'),
  BD: msg('Bangladesh'),
  BE: msg('Belgium'),
  BF: msg('Burkina Faso'),
  BG: msg('Bulgaria'),
  BH: msg('Bahrain'),
  BI: msg('Burundi'),
  BJ: msg('Benin'),
  BL: msg('St. Barthélemy'),
  BM: msg('Bermuda'),
  BN: msg('Brunei'),
  BO: msg('Bolivia'),
  BQ: msg('Caribbean Netherlands'),
  BR: msg('Brazil'),
  BS: msg('Bahamas'),
  BT: msg('Bhutan'),
  BV: msg('Bouvet Island'),
  BW: msg('Botswana'),
  BY: msg('Belarus'),
  BZ: msg('Belize'),
  CA: msg('Canada'),
  CC: msg('Cocos (Keeling) Islands'),
  CD: msg('Congo - Kinshasa'),
  CF: msg('Central African Republic'),
  CG: msg('Congo - Brazzaville'),
  CH: msg('Switzerland'),
  CI: msg('Côte d’Ivoire'),
  CK: msg('Cook Islands'),
  CL: msg('Chile'),
  CM: msg('Cameroon'),
  CN: msg('China'),
  CO: msg('Colombia'),
  CR: msg('Costa Rica'),
  CU: msg('Cuba'),
  CV: msg('Cape Verde'),
  CW: msg('Curaçao'),
  CX: msg('Christmas Island'),
  CY: msg('Cyprus'),
  CZ: msg('Czechia'),
  DE: msg('Germany'),
  DJ: msg('Djibouti'),
  DK: msg('Denmark'),
  DM: msg('Dominica'),
  DO: msg('Dominican Republic'),
  DZ: msg('Algeria'),
  EC: msg('Ecuador'),
  EE: msg('Estonia'),
  EG: msg('Egypt'),
  EH: msg('Western Sahara'),
  ER: msg('Eritrea'),
  ES: msg('Spain'),
  ET: msg('Ethiopia'),
  FI: msg('Finland'),
  FJ: msg('Fiji'),
  FK: msg('Falkland Islands'),
  FM: msg('Micronesia'),
  FO: msg('Faroe Islands'),
  FR: msg('France'),
  GA: msg('Gabon'),
  GB: msg('United Kingdom'),
  GD: msg('Grenada'),
  GE: msg('Georgia'),
  GF: msg('French Guiana'),
  GG: msg('Guernsey'),
  GH: msg('Ghana'),
  GI: msg('Gibraltar'),
  GL: msg('Greenland'),
  GM: msg('Gambia'),
  GN: msg('Guinea'),
  GP: msg('Guadeloupe'),
  GQ: msg('Equatorial Guinea'),
  GR: msg('Greece'),
  GS: msg('South Georgia & South Sandwich Islands'),
  GT: msg('Guatemala'),
  GU: msg('Guam'),
  GW: msg('Guinea-Bissau'),
  GY: msg('Guyana'),
  HK: msg('Hong Kong SAR China'),
  HM: msg('Heard & McDonald Islands'),
  HN: msg('Honduras'),
  HR: msg('Croatia'),
  HT: msg('Haiti'),
  HU: msg('Hungary'),
  ID: msg('Indonesia'),
  IE: msg('Ireland'),
  IL: msg('Israel'),
  IM: msg('Isle of Man'),
  IN: msg('India'),
  IO: msg('British Indian Ocean Territory'),
  IQ: msg('Iraq'),
  IR: msg('Iran'),
  IS: msg('Iceland'),
  IT: msg('Italy'),
  JE: msg('Jersey'),
  JM: msg('Jamaica'),
  JO: msg('Jordan'),
  JP: msg('Japan'),
  KE: msg('Kenya'),
  KG: msg('Kyrgyzstan'),
  KH: msg('Cambodia'),
  KI: msg('Kiribati'),
  KM: msg('Comoros'),
  KN: msg('St. Kitts & Nevis'),
  KP: msg('North Korea'),
  KR: msg('South Korea'),
  KW: msg('Kuwait'),
  KY: msg('Cayman Islands'),
  KZ: msg('Kazakhstan'),
  LA: msg('Laos'),
  LB: msg('Lebanon'),
  LC: msg('St. Lucia'),
  LI: msg('Liechtenstein'),
  LK: msg('Sri Lanka'),
  LR: msg('Liberia'),
  LS: msg('Lesotho'),
  LT: msg('Lithuania'),
  LU: msg('Luxembourg'),
  LV: msg('Latvia'),
  LY: msg('Libya'),
  MA: msg('Morocco'),
  MC: msg('Monaco'),
  MD: msg('Moldova'),
  ME: msg('Montenegro'),
  MF: msg('St. Martin'),
  MG: msg('Madagascar'),
  MH: msg('Marshall Islands'),
  MK: msg('North Macedonia'),
  ML: msg('Mali'),
  MM: msg('Myanmar (Burma)'),
  MN: msg('Mongolia'),
  MO: msg('Macao SAR China'),
  MP: msg('Northern Mariana Islands'),
  MQ: msg('Martinique'),
  MR: msg('Mauritania'),
  MS: msg('Montserrat'),
  MT: msg('Malta'),
  MU: msg('Mauritius'),
  MV: msg('Maldives'),
  MW: msg('Malawi'),
  MX: msg('Mexico'),
  MY: msg('Malaysia'),
  MZ: msg('Mozambique'),
  NA: msg('Namibia'),
  NC: msg('New Caledonia'),
  NE: msg('Niger'),
  NF: msg('Norfolk Island'),
  NG: msg('Nigeria'),
  NI: msg('Nicaragua'),
  NL: msg('Netherlands'),
  NO: msg('Norway'),
  NP: msg('Nepal'),
  NR: msg('Nauru'),
  NU: msg('Niue'),
  NZ: msg('New Zealand'),
  OM: msg('Oman'),
  PA: msg('Panama'),
  PE: msg('Peru'),
  PF: msg('French Polynesia'),
  PG: msg('Papua New Guinea'),
  PH: msg('Philippines'),
  PK: msg('Pakistan'),
  PL: msg('Poland'),
  PM: msg('St. Pierre & Miquelon'),
  PN: msg('Pitcairn Islands'),
  PR: msg('Puerto Rico'),
  PS: msg('Palestinian Territories'),
  PT: msg('Portugal'),
  PW: msg('Palau'),
  PY: msg('Paraguay'),
  QA: msg('Qatar'),
  RE: msg('Réunion'),
  RO: msg('Romania'),
  RS: msg('Serbia'),
  RU: msg('Russia'),
  RW: msg('Rwanda'),
  SA: msg('Saudi Arabia'),
  SB: msg('Solomon Islands'),
  SC: msg('Seychelles'),
  SD: msg('Sudan'),
  SE: msg('Sweden'),
  SG: msg('Singapore'),
  SH: msg('St. Helena'),
  SI: msg('Slovenia'),
  SJ: msg('Svalbard & Jan Mayen'),
  SK: msg('Slovakia'),
  SL: msg('Sierra Leone'),
  SM: msg('San Marino'),
  SN: msg('Senegal'),
  SO: msg('Somalia'),
  SR: msg('Suriname'),
  SS: msg('South Sudan'),
  ST: msg('São Tomé & Príncipe'),
  SV: msg('El Salvador'),
  SX: msg('Sint Maarten'),
  SY: msg('Syria'),
  SZ: msg('Eswatini'),
  TC: msg('Turks & Caicos Islands'),
  TD: msg('Chad'),
  TF: msg('French Southern Territories'),
  TG: msg('Togo'),
  TH: msg('Thailand'),
  TJ: msg('Tajikistan'),
  TK: msg('Tokelau'),
  TL: msg('Timor-Leste'),
  TM: msg('Turkmenistan'),
  TN: msg('Tunisia'),
  TO: msg('Tonga'),
  TR: msg('Türkiye'),
  TT: msg('Trinidad & Tobago'),
  TV: msg('Tuvalu'),
  TW: msg('Taiwan'),
  TZ: msg('Tanzania'),
  UA: msg('Ukraine'),
  UG: msg('Uganda'),
  UM: msg('U.S. Outlying Islands'),
  US: msg('United States'),
  UY: msg('Uruguay'),
  UZ: msg('Uzbekistan'),
  VA: msg('Vatican City'),
  VC: msg('St. Vincent & Grenadines'),
  VE: msg('Venezuela'),
  VG: msg('British Virgin Islands'),
  VI: msg('U.S. Virgin Islands'),
  VN: msg('Vietnam'),
  VU: msg('Vanuatu'),
  WF: msg('Wallis & Futuna'),
  WS: msg('Samoa'),
  YE: msg('Yemen'),
  YT: msg('Mayotte'),
  ZA: msg('South Africa'),
  ZM: msg('Zambia'),
  ZW: msg('Zimbabwe'),
};

export interface CountryOption {
  code: string;
  name: string;
}

/** The countries in the interface's language, sorted by that name. */
export function countryOptions(): CountryOption[] {
  return Object.entries(countryNames)
    .map(([code, name]) => ({ code, name: t(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The name of a country by its code; '' is everywhere. */
export function countryName(code: string): string {
  if (!code) return t('Everywhere');
  const name = countryNames[code];
  return name ? t(name) : code;
}

const fold = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();

/** Countries whose name (or code) matches what was typed, the ones that start with it first. */
export function matchCountries(options: readonly CountryOption[], query: string, limit = 6): CountryOption[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const starts: CountryOption[] = [];
  const contains: CountryOption[] = [];
  for (const option of options) {
    const name = fold(option.name);
    if (name.startsWith(needle) || option.code.toLowerCase() === needle) starts.push(option);
    else if (name.includes(needle)) contains.push(option);
  }
  return [...starts, ...contains].slice(0, limit);
}
