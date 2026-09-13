import { describe, expect, it } from 'vitest';

import { detectUiLocale, i18next, readUiLocalePreference, resolveUiLocale, t, UI_LOCALE_AUTO } from './i18n';

describe('detectUiLocale', () => {
  it('matches the whole tag, then the language, and falls back to English', () => {
    expect(detectUiLocale(['en-GB'])).toBe('en');
    expect(detectUiLocale(['de-AT', 'en-US'])).toBe('en');
    expect(detectUiLocale(['xx'])).toBe('en');
    expect(detectUiLocale([])).toBe('en');
  });

  it('never lands on the pseudo-locale from a device tag', () => {
    expect(detectUiLocale(['pseudo'])).toBe('en');
  });
});

describe('readUiLocalePreference', () => {
  it('keeps a shipped code, drops dev-only codes on a store build, and defaults to auto', () => {
    expect(readUiLocalePreference('en', false)).toBe('en');
    expect(readUiLocalePreference('pseudo', true)).toBe('pseudo');
    expect(readUiLocalePreference('pseudo', false)).toBe(UI_LOCALE_AUTO);
    expect(readUiLocalePreference('klingon', true)).toBe(UI_LOCALE_AUTO);
    expect(readUiLocalePreference(null, true)).toBe(UI_LOCALE_AUTO);
  });
});

describe('resolveUiLocale', () => {
  it('prefers the stored choice and otherwise follows the device', () => {
    expect(resolveUiLocale('pseudo', ['en'], true)).toBe('pseudo');
    expect(resolveUiLocale('pseudo', ['en'], false)).toBe('en');
    expect(resolveUiLocale(UI_LOCALE_AUTO, ['en-US'], true)).toBe('en');
  });
});

describe('t', () => {
  it('returns the English key with ICU placeholders and plurals filled in', async () => {
    await i18next.changeLanguage('en');
    expect(t('Hello {name}', { name: 'Ola' })).toBe('Hello Ola');
    expect(t('{count, plural, one {# book} other {# books}}', { count: 1 })).toBe('1 book');
    expect(t('{count, plural, one {# book} other {# books}}', { count: 3 })).toBe('3 books');
    expect(t("Don't have an account?")).toBe("Don't have an account?");
    expect(t('Status: loading. Ready.')).toBe('Status: loading. Ready.');
  });

  it('serves the pseudo-locale and falls back to English for a key it lacks', async () => {
    i18next.addResource('pseudo', 'translation', 'Hello {name}', '[Ĥéĺĺö {name}~~~]');
    await i18next.changeLanguage('pseudo');
    expect(t('Hello {name}', { name: 'Ola' })).toBe('[Ĥéĺĺö Ola~~~]');
    expect(t('Not stretched {n}', { n: 1 })).toBe('Not stretched 1');
    await i18next.changeLanguage('en');
  });
});
