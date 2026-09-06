import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/src/auth-context';
import { crestFor, ensurePaletteColours, type CrestColours } from '@/src/crest';

/** Same key and shape the web client keeps in its local storage. */
const storageKey = 'almonium:lang-colours';

interface CrestContextValue {
  colours: CrestColours;
  crestFor(language: string | null | undefined): string;
  setCrest(language: string, hex: string): Promise<void>;
}

const CrestContext = createContext<CrestContextValue | null>(null);

/**
 * One loaded set of crest colours shared by the rail, the harness and the settings row, so a
 * language can never wear two hues at once. Every learner on the account is given a swatch,
 * active or set aside, so a record page keeps its colour when the language comes back.
 */
export function CrestProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const [colours, setColours] = useState<CrestColours>({});
  const [loaded, setLoaded] = useState(false);
  const languages = useMemo(
    () => profile?.learners.map((learner) => learner.language) ?? [],
    [profile?.learners],
  );

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored) as unknown;
        if (parsed && typeof parsed === 'object') setColours(parsed as CrestColours);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !languages.length) return;
    setColours((current) => {
      const next = ensurePaletteColours(current, languages);
      if (next !== current) void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [languages, loaded]);

  const setCrest = useCallback(async (language: string, hex: string) => {
    let next: CrestColours = {};
    setColours((current) => {
      next = { ...current, [language]: hex };
      return next;
    });
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The in-memory colour still applies for this session.
    }
  }, []);

  const value = useMemo<CrestContextValue>(
    () => ({ colours, crestFor: (language) => crestFor(colours, language), setCrest }),
    [colours, setCrest],
  );

  return <CrestContext.Provider value={value}>{children}</CrestContext.Provider>;
}

export function useCrest() {
  const value = useContext(CrestContext);
  if (!value) throw new Error('useCrest must be used inside CrestProvider');
  return value;
}
