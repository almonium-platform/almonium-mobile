import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { createThemedStyles, fonts, serifLineHeight } from '@/src/theme';

/**
 * What a book screen or the reader shows when the book answered 451: it is still under copyright
 * in the reader's country. A plain state of the screen, not an error: no notice, no lock, one line
 * of why and the way back to the shelf.
 */
export function UnavailableInCountry({ guest }: { guest: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.screen}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('This book isn’t available in your country')}
        </Text>
        <Text style={styles.text}>
          {t('Copyright lasts longer in some countries than others, so a few books can’t be opened everywhere.')}
        </Text>
      </View>
      <Button variant="secondary" onPress={() => router.replace(guest ? '/read' : '/(tabs)/books')}>
        {t('Back to the shelf')}
      </Button>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: 22, paddingHorizontal: 28, paddingVertical: 48, backgroundColor: colors.canvas },
  copy: { gap: 10 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: serifLineHeight(24), textAlign: 'center' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
}));
