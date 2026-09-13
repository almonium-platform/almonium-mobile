import 'intl-pluralrules';
import { createInstance, type TFunction } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

/**
 * The languages the interface itself can speak: which exist, which one the device asks for, and
 * the messages behind them. Mirrors `ui-locale.ts` in the web client.
 *
 * Copy is written in English and the English text is the key: `t('Keep this word')`. A line that
 * is reworded loses its old translations, and nothing is named by hand. Placeholders and plurals
 * use ICU, the same syntax the web client's messages carry: `t('Hello {name}', { name })`,
 * `t('{count, plural, one {# book} other {# books}}', { count })`.
 *
 * This module stays free of React Native, so the unit tests and every `src/` module can import
 * `t` from it. `i18n-context.tsx` reads the device and the stored preference and switches the
 * language at runtime.
 */

/** The stored value that means "follow the device". */
export const UI_LOCALE_AUTO = 'auto';

export interface UiLocale {
  /** The tag the preference and the translation file are keyed by. */
  readonly code: string;
  /** The name in that language, so a reader finds their own without reading ours. Never translated. */
  readonly nativeName: string;
  /** Offered only on a development or preview build. */
  readonly devOnly?: boolean;
}

/**
 * Adding a language: one line here, its file under `src/locales/`, and its `require` in
 * {@link resources}. The README ("Interface languages") walks through it.
 */
export const UI_LOCALES = [
  { code: 'en', nativeName: 'English' },
  { code: 'pseudo', nativeName: 'Pseudo (stretched English)', devOnly: true },
] as const satisfies readonly UiLocale[];

export type UiLocaleCode = (typeof UI_LOCALES)[number]['code'];
export type UiLocalePreference = typeof UI_LOCALE_AUTO | UiLocaleCode;

export const DEFAULT_UI_LOCALE: UiLocaleCode = 'en';

/** Stored beside appearance and motion, per device. */
export const UI_LOCALE_STORAGE_KEY = 'almonium.uiLocale';

/**
 * English needs no file: a missing key falls back to the key, which is the English text. The
 * pseudo-locale ships in every build (it is small) but is only offered where it can be tested.
 */
const resources = {
  en: { translation: {} },
  pseudo: { translation: require('./locales/pseudo.json') as Record<string, string> },
};

/** The one instance the app and its modules share; `initReactI18next` binds `useTranslation()` to it. */
export const i18next = createInstance();
void i18next
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_UI_LOCALE,
    fallbackLng: DEFAULT_UI_LOCALE,
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

/** Translates at call time; use `useTranslation()` in components so they re-render on a change. */
export const t: TFunction = i18next.t;

/** Marks English copy held in a constant for extraction; translate it where it is shown, with `t(value)`. */
export function msg<T extends string>(text: T): T {
  return text;
}

export function availableUiLocales(devMode: boolean): readonly UiLocale[] {
  return (UI_LOCALES as readonly UiLocale[]).filter((locale) => devMode || !locale.devOnly);
}

export function isUiLocaleCode(value: unknown, devMode: boolean): value is UiLocaleCode {
  return availableUiLocales(devMode).some((locale) => locale.code === value);
}

export function uiLocaleByCode(code: string | undefined): UiLocale {
  return (UI_LOCALES as readonly UiLocale[]).find((locale) => locale.code === code) ?? UI_LOCALES[0];
}

/** The stored preference, or "auto" when nothing valid is stored. */
export function readUiLocalePreference(stored: string | null | undefined, devMode: boolean): UiLocalePreference {
  return isUiLocaleCode(stored, devMode) ? stored : UI_LOCALE_AUTO;
}

/**
 * The first device language we have, matched on the whole tag first (`pt-BR`) and then on the
 * language alone (`pt`), so `de-AT` still lands on German. The pseudo-locale is never a match:
 * nobody's device asks for it.
 */
export function detectUiLocale(languages: readonly string[]): UiLocaleCode {
  const shipped = (UI_LOCALES as readonly UiLocale[]).filter((locale) => !locale.devOnly);
  for (const language of languages) {
    const tag = language.toLowerCase();
    const primary = tag.split('-')[0];
    const match =
      shipped.find((locale) => locale.code.toLowerCase() === tag) ??
      shipped.find((locale) => locale.code.toLowerCase().split('-')[0] === primary);
    if (match) return match.code as UiLocaleCode;
  }
  return DEFAULT_UI_LOCALE;
}

export function resolveUiLocale(preference: UiLocalePreference, languages: readonly string[], devMode: boolean): UiLocaleCode {
  return preference !== UI_LOCALE_AUTO && isUiLocaleCode(preference, devMode) ? preference : detectUiLocale(languages);
}
