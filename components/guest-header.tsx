import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { createThemedStyles, darkColors, fonts, useTheme } from '@/src/theme';

/**
 * The public navbar on a phone: wordmark, Sign in, Read free. A guest sees it over the library,
 * the book and the reader; signing in returns to where it was tapped.
 */
export function GuestHeader({ returnTo, onBack, night = false, children }: {
  returnTo?: string;
  onBack?(): void;
  night?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, night && styles.safeNight]}>
      <View style={styles.row}>
        {onBack && (
          <Pressable accessibilityLabel={t('Back')} onPress={onBack} style={styles.back} hitSlop={6}>
            <Ionicons name="chevron-back" size={24} color={night ? colors.white : colors.primary} />
          </Pressable>
        )}
        <BrandMark size={28} />
        <Text style={[styles.wordmark, night && styles.wordmarkNight]}>Almonium</Text>
        <View style={styles.spacer} />
        <GuestHeaderActions returnTo={returnTo} night={night} />
      </View>
      {children}
    </SafeAreaView>
  );
}

/** Sign in and Read free: the two ways in, side by side. */
export function GuestHeaderActions({ returnTo, night = false }: { returnTo?: string; night?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const params = returnTo ? { returnTo } : undefined;
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/(auth)/sign-in', params })} style={styles.signIn} hitSlop={6}>
        <Text style={[styles.signInText, night && styles.wordmarkNight]}>{t('Sign in')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(auth)/register', params })}
        style={({ pressed }) => [styles.readFree, pressed && styles.readFreePressed]}>
        <Text style={styles.readFreeText}>{t('Read free')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safe: { backgroundColor: colors.canvas },
  safeNight: { backgroundColor: darkColors.surface },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  back: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  wordmark: { color: colors.ink, fontFamily: fonts.serif, fontSize: 18 },
  wordmarkNight: { color: darkColors.ink },
  spacer: { flex: 1 },
  signIn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  signInText: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 14 },
  readFree: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.primary },
  readFreePressed: { backgroundColor: colors.primaryPressed },
  readFreeText: { color: colors.onPrimary, fontFamily: fonts.sansSemibold, fontSize: 14 },
}));
