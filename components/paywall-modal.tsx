import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui';
import { msg } from '@/src/i18n';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';

/** One sheet, five bodies. Each names the boundary reached, never a restriction. */
export type PaywallContext =
  | 'second-language'
  | 'item-cap'
  | 'audio'
  | 'private-import'
  | 'alignment-request'
  | 'general';

const wallCopy: Record<PaywallContext, { eyebrow: string; title: string; body: string }> = {
  'second-language': {
    eyebrow: msg('ANOTHER LANGUAGE'),
    title: msg('Free covers one language at a time.'),
    body: msg('Premium runs three at once. A language you set aside stays open to read — every word, every review — and comes back exactly as you left it. The downgrade never takes the record, only the second seat.'),
  },
  'item-cap': {
    eyebrow: msg('100 WORDS KEPT'),
    title: msg('Free covers a hundred words at a time.'),
    body: msg('Nothing you saved will disappear. Premium removes the cap so the next word joins the same review schedule as the rest.'),
  },
  audio: {
    eyebrow: msg('HEAR IT READ'),
    title: msg('Narrated books are part of Premium.'),
    body: msg('Audio costs something every time it plays, so it belongs to the plan that covers it. Reading, lookups and the words you have already kept stay as they are.'),
  },
  'private-import': {
    eyebrow: msg('YOUR OWN BOOK'),
    title: msg('Importing a book of your own is part of Premium.'),
    body: msg('Three a month, private to your account and never added to the public library. Everything on your shelf today stays.'),
  },
  'alignment-request': {
    eyebrow: msg('ASK FOR A LANGUAGE'),
    title: msg('You have used this month’s request.'),
    body: msg('Free covers one translation request a month; Premium covers three, and they are read first. A withdrawn request refunds the count, so you can spend it elsewhere.'),
  },
  general: {
    eyebrow: msg('PREMIUM'),
    title: msg('Reading is free, and stays free.'),
    body: msg('Paying covers the parts that cost something every time you use them. Your learning data stays exactly where it is either way.'),
  },
};

/** The paid lines from the pricing page. Nothing enters before the backend models it. */
export const premiumLines = [
  msg('Unlimited saved words, and three languages at once'),
  msg('Every book at your level — B1, B2 and C1 editions'),
  msg('Narrated audiobooks'),
  msg('Import your own books, 3 a month'),
  msg('Ask for a missing alignment, 3 a month'),
  msg('Share word packs with friends'),
];

/**
 * The wall is an interception, not a page: the person did not come to shop. Grey body, plum
 * link, no raspberry. It explains the boundary and the downgrade rules; it never transacts.
 */
export function PaywallModal({
  visible,
  onClose,
  context = 'general',
}: {
  visible: boolean;
  onClose(): void;
  context?: PaywallContext;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const copy = wallCopy[context];

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.eyebrow}>{t(copy.eyebrow)}</Text>
      <Text style={styles.title}>{t(copy.title)}</Text>
      <Text style={styles.body}>{t(copy.body)}</Text>
      <View style={styles.list}>
        <Text style={styles.listLabel}>{t('WHAT PREMIUM ADDS')}</Text>
        {premiumLines.map((line) => (
          <View key={line} style={styles.line}>
            <Ionicons name="checkmark" size={16} color={colors.primary} />
            <Text style={styles.lineText}>{t(line)}</Text>
          </View>
        ))}
      </View>
      <Button
        onPress={() => {
          onClose();
          router.push('/membership');
        }}>
        {t('See membership')}
      </Button>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.dismiss}>
        <Text style={styles.dismissText}>{t('Not now')}</Text>
      </Pressable>
    </Sheet>
  );
}

const useStyles = createThemedStyles((colors) => ({
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 25, lineHeight: serifLineHeight(25) },
  body: { color: colors.muted, fontSize: 14.5, lineHeight: 22 },
  list: { gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  listLabel: { color: colors.metadata, fontSize: 10.5, fontWeight: '600', letterSpacing: 1.3, paddingBottom: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  lineText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  dismiss: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dismissText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
}));
