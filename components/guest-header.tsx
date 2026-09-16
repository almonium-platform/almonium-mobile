import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/wordmark';
import { createThemedStyles, darkColors, fonts, useTheme } from '@/src/theme';

/**
 * The public navbar on a phone: wordmark, Sign in, Read free. A guest sees it over the library,
 * the book and the reader; both actions open the auth sheet over the current screen.
 */
export function GuestHeader({ onSignIn, onReadFree, onBack, night = false, children }: {
  onSignIn(): void;
  onReadFree(): void;
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
        <Wordmark height={18} color={night ? darkColors.ink : undefined} />
        <View style={styles.spacer} />
        <GuestHeaderActions onSignIn={onSignIn} onReadFree={onReadFree} night={night} />
      </View>
      {children}
    </SafeAreaView>
  );
}

/** Sign in and Read free: the two ways in, side by side. */
export function GuestHeaderActions({ onSignIn, onReadFree, night = false }: { onSignIn(): void; onReadFree(): void; night?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.signIn} hitSlop={6}>
        <Text style={[styles.signInText, night && styles.signInNight]}>{t('Sign in')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onReadFree} style={({ pressed }) => [styles.readFree, pressed && styles.readFreePressed]}>
        <Text style={styles.readFreeText}>{t('Read free')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  safe: { backgroundColor: colors.canvas },
  safeNight: { backgroundColor: darkColors.surface },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  back: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  spacer: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signIn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  signInText: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 13.5 },
  signInNight: { color: darkColors.muted },
  readFree: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.primary },
  readFreePressed: { backgroundColor: colors.primaryPressed },
  readFreeText: { color: colors.onPrimary, fontFamily: fonts.sansSemibold, fontSize: 13.5 },
}));
