/**
 * The crest: one colour per language you are learning, from a fixed set of eight. The palette
 * and the assignment rule are the web client's, so a language wears the same hue on both. Known
 * languages stay neutral on purpose: only the languages you are learning colour a session.
 */
import { msg } from './i18n';

/** `name` is the swatch's accessibility label; translate it where it is read, with `t(colour.name)`. */
export const languageColours = [
  { name: msg('Clay'), hex: '#a66f5a' },
  { name: msg('Ochre'), hex: '#9a8146' },
  { name: msg('Moss'), hex: '#638565' },
  { name: msg('Teal'), hex: '#49858a' },
  { name: msg('Slate'), hex: '#657f9e' },
  { name: msg('Indigo'), hex: '#766ca0' },
  { name: msg('Orchid'), hex: '#94688f' },
  { name: msg('Rose'), hex: '#a56775' },
] as const;

export type CrestColours = Record<string, string>;

/** The fallback the web uses for a language with no stored colour. */
export const defaultCrest = '#7A6BB8';

/**
 * Every crest is drawn from the fixed palette, so a language without a colour, or holding one
 * from outside the palette, is given a free swatch rather than whatever was cached. Returns the
 * same object when nothing changed so callers can skip a write.
 */
export function ensurePaletteColours(colours: CrestColours, languages: string[]): CrestColours {
  const palette = new Set<string>(languageColours.map((colour) => colour.hex));
  const next: CrestColours = { ...colours };
  let changed = false;
  languages.forEach((language, index) => {
    if (palette.has(next[language])) return;
    const taken = new Set(Object.values(next));
    const free = languageColours.find((colour) => !taken.has(colour.hex));
    next[language] = (free ?? languageColours[index % languageColours.length]).hex;
    changed = true;
  });
  return changed ? next : colours;
}

export function crestFor(colours: CrestColours, language: string | null | undefined) {
  return (language && colours[language]) || defaultCrest;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(channels: number[]) {
  return `#${channels.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0')).join('')}`;
}

/** `amount` of `colour` over `ground`, 0 being the ground and 1 the colour itself. */
export function mix(colour: string, ground: string, amount: number) {
  const a = parseHex(colour);
  const b = parseHex(ground);
  return toHex(a.map((channel, index) => b[index] + (channel - b[index]) * amount));
}

/**
 * The six-step ramp every week square is drawn in: the crest hue at rising strength over the
 * page ground. Step 0 is the empty cell.
 */
export function crestRamp(crest: string, ground: string, empty: string) {
  return [empty, ...[0.22, 0.4, 0.58, 0.78, 1].map((amount) => mix(crest, ground, amount))];
}

/** The pale tint of the hue that chips and pills take, so a crest never shouts louder than plum. */
export function crestTint(crest: string, ground: string) {
  return mix(crest, ground, 0.16);
}

function luminance(hex: string) {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast between two colours, 1 to 21. */
export function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The crest as text on a ground: the hue itself where it already reads, otherwise pushed toward
 * ink (on paper) or toward white (at night) in small steps until it clears 4.5:1. All eight
 * hues sit at one lightness, so each moves about the same distance and none ends up black.
 */
export function crestInk(crest: string, ground: string, minimum = 4.5) {
  const toward = luminance(ground) > 0.5 ? '#000000' : '#ffffff';
  let ink = crest;
  for (let amount = 0; amount < 1 && contrast(ink, ground) < minimum; amount += 0.05) {
    ink = mix(toward, crest, amount);
  }
  return ink;
}
