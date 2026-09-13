import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import {
  availableUiLocales,
  detectUiLocale,
  i18next,
  readUiLocalePreference,
  resolveUiLocale,
  UI_LOCALE_STORAGE_KEY,
  uiLocaleByCode,
  type UiLocale,
  type UiLocalePreference,
} from '@/src/i18n';

/** The pseudo-locale is offered on dev clients and the preview channel, never on a store build. */
const devMode = __DEV__ || (Updates.channel != null && Updates.channel !== 'production');

type UiLocaleContextValue = {
  /** The locale the interface is showing. */
  current: UiLocale;
  /** What "automatic" resolves to on this device. */
  detected: UiLocale;
  /** Everything the setting offers; the pseudo-locale only where it can be tested. */
  options: readonly UiLocale[];
  preference: UiLocalePreference;
  /** True once the stored preference has been read, so the first frame is already in the right language. */
  ready: boolean;
  setPreference(preference: UiLocalePreference): Promise<void>;
};

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

/**
 * The interface-language setting: reads the stored choice once, follows the device until one is
 * picked, and switches i18next in place so every `useTranslation()` re-renders. No reload.
 */
export function UiLocaleProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const deviceLanguages = useLocales().map((locale) => locale.languageTag);
  const [preference, setPreferenceState] = useState<UiLocalePreference>('auto');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(UI_LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (active) setPreferenceState(readUiLocalePreference(stored, devMode));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const resolved = resolveUiLocale(preference, deviceLanguages, devMode);
  useEffect(() => {
    if (ready && i18next.language !== resolved) void i18next.changeLanguage(resolved);
  }, [ready, resolved]);

  const setPreference = useCallback(async (next: UiLocalePreference) => {
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(UI_LOCALE_STORAGE_KEY, next);
    } catch {
      // The in-memory selection still applies for this session.
    }
  }, []);

  const detectedCode = detectUiLocale(deviceLanguages);
  const value = useMemo<UiLocaleContextValue>(
    () => ({
      current: uiLocaleByCode(i18n.language),
      detected: uiLocaleByCode(detectedCode),
      options: availableUiLocales(devMode),
      preference,
      ready,
      setPreference,
    }),
    [detectedCode, i18n.language, preference, ready, setPreference],
  );

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}

export function useUiLocale() {
  const value = useContext(UiLocaleContext);
  if (!value) throw new Error('useUiLocale must be used within UiLocaleProvider');
  return value;
}
