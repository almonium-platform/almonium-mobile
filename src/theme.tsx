import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccessibilityInfo,
  Appearance,
  Platform,
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

/** Almonium's semantic light palette. Components should consume it through useTheme(). */
export const colors = {
  ink: '#2C2530',
  muted: '#5F5560',
  metadata: '#A99AA8',
  canvas: '#F9F6F5',
  surface: '#FFFFFF',
  nested: '#F9F6F5',
  overlay: '#FFFFFF',
  primary: '#5A1A74',
  primaryLight: '#E0C4EE',
  primaryDark: '#48177D',
  primaryPressed: '#3A1462',
  raspberry: '#A1264C',
  premium: '#8F2356',
  // Chat surfaces, from the social build reference: your own bubble and the Saved Messages
  // emblem share one plum; channel emblems take the deeper, quieter one.
  chatMine: '#872657',
  chatChannel: '#6E2A5E',
  accentSoft: '#F8EAF3',
  accentBorder: '#E9CADF',
  line: '#EDEBE8',
  border: '#D8CFD6',
  disabled: '#E8E2E6',
  disabledText: '#8B8290',
  danger: '#FA4666',
  // #FA4666 is an error ink: it only reaches 3.4:1 as a fill, so destructive fills take the darkened step.
  dangerFill: '#C4213C',
  dangerSoft: '#FFE3E9',
  success: '#16BA7F',
  successSoft: '#E7F8F2',
  reader: '#33292E',
  languageRail: '#6C7FA8',
  languageRailSoft: '#CDD4E2',
  onPrimary: '#FFFFFF',
  white: '#FFFFFF',
  scrim: 'rgba(44,37,48,0.72)',
} as const;

export type ThemeColors = { [Key in keyof typeof colors]: string };

/** Dark values preserve semantic roles rather than literally inverting light values. */
export const darkColors: ThemeColors = {
  ink: '#F1EAEF',
  muted: '#BEB2C2',
  metadata: '#8D8298',
  canvas: '#14111A',
  surface: '#1E1A26',
  nested: '#272130',
  overlay: '#2E2736',
  primary: '#B07BD0',
  primaryLight: '#E0C4EE',
  primaryDark: '#CBA3E0',
  primaryPressed: '#9059BC',
  raspberry: '#D98BA8',
  premium: '#B24A76',
  chatMine: '#7A2350',
  chatChannel: '#6E2A5E',
  accentSoft: '#30243A',
  accentBorder: '#60456F',
  line: '#332C3C',
  border: '#453D51',
  disabled: '#2A2433',
  disabledText: '#6E637A',
  danger: '#FF8FA3',
  dangerFill: '#C4213C',
  dangerSoft: '#2A1A22',
  success: '#3DD69B',
  successSoft: '#12332A',
  reader: '#E4DAE2',
  languageRail: '#7D5C93',
  languageRailSoft: '#453D51',
  onPrimary: '#14111A',
  white: '#F1EAEF',
  scrim: 'rgba(10,8,14,0.72)',
};

export type AppearancePreference = 'light' | 'dark' | 'system';
/** Reduce motion follows the OS by default; the App tab can override it in either direction. */
export type MotionPreference = 'system' | 'reduced' | 'full';
type NamedStyles<T> = { [Property in keyof T]: ViewStyle | TextStyle | ImageStyle };

const APPEARANCE_STORAGE_KEY = 'almonium.appearance';
const MOTION_STORAGE_KEY = 'almonium.motion';

type ThemeContextValue = {
  appearance: AppearancePreference;
  colors: ThemeColors;
  isDark: boolean;
  ready: boolean;
  motion: MotionPreference;
  /** True when anything that moves an object across the screen should render its final frame instead. */
  reduceMotion: boolean;
  setAppearance(appearance: AppearancePreference): Promise<void>;
  setMotion(motion: MotionPreference): Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isMotionPreference(value: string | null): value is MotionPreference {
  return value === 'system' || value === 'reduced' || value === 'full';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<AppearancePreference>('system');
  const [motion, setMotionState] = useState<MotionPreference>('system');
  const [systemReducesMotion, setSystemReducesMotion] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReducesMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducesMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
      AsyncStorage.getItem(MOTION_STORAGE_KEY),
    ])
      .then(([storedAppearance, storedMotion]) => {
        if (!active) return;
        if (isAppearancePreference(storedAppearance)) setAppearanceState(storedAppearance);
        if (isMotionPreference(storedMotion)) setMotionState(storedMotion);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    Appearance.setColorScheme(appearance === 'system' ? null : appearance);
  }, [appearance, ready]);

  const setAppearance = useCallback(async (next: AppearancePreference) => {
    setAppearanceState(next);
    try {
      await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // The in-memory selection still applies for this session.
    }
  }, []);

  const setMotion = useCallback(async (next: MotionPreference) => {
    setMotionState(next);
    try {
      await AsyncStorage.setItem(MOTION_STORAGE_KEY, next);
    } catch {
      // The in-memory selection still applies for this session.
    }
  }, []);

  const isDark = appearance === 'dark' || (appearance === 'system' && systemScheme === 'dark');
  const reduceMotion = motion === 'reduced' || (motion === 'system' && systemReducesMotion);
  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      colors: isDark ? darkColors : colors,
      isDark,
      ready,
      motion,
      reduceMotion,
      setAppearance,
      setMotion,
    }),
    [appearance, isDark, ready, motion, reduceMotion, setAppearance, setMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

export function createThemedStyles<T extends NamedStyles<T>>(
  factory: (palette: ThemeColors, isDark: boolean) => T,
) {
  const light = StyleSheet.create(factory(colors, false));
  const darkDefinition = factory(darkColors, true);
  for (const style of Object.values(darkDefinition)) {
    const themedStyle = style as ViewStyle;
    if (themedStyle.backgroundColor === darkColors.surface && themedStyle.shadowOpacity) {
      themedStyle.borderWidth ??= 1;
      themedStyle.borderColor ??= darkColors.line;
      themedStyle.shadowOpacity = 0;
      themedStyle.elevation = 0;
    }
  }
  const dark = StyleSheet.create(darkDefinition);
  return function useThemedStyles() {
    return useTheme().isDark ? dark : light;
  };
}

export const gradients = {
  auth: ['#F4E5EC', colors.canvas, '#EEE7F4'] as const,
  authDark: [darkColors.nested, darkColors.canvas, darkColors.surface] as const,
  premium: [colors.premium, colors.primary] as const,
  premiumDark: [darkColors.premium, darkColors.primaryPressed] as const,
} as const;

export const fonts = {
  serif: 'Literata_600SemiBold',
  serifRegular: 'Literata_400Regular',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemibold: 'IBMPlexSans_600SemiBold',
} as const;

/**
 * Literata asks for 1.485em of line box (1.177 above the baseline, 0.308 below). Given anything
 * tighter, React Native keeps the ascent and takes the difference out of the descent, which shears
 * the tails off g, y and p on Android. Serif text asks for its line height by name rather than
 * carrying a number that was picked to look tight in a mockup.
 */
export const serifLineHeight = (fontSize: number) => Math.ceil(fontSize * 1.49);

export const radii = { inline: 12, control: 999, panel: 20, card: 28 } as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  media: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  field: {
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;
