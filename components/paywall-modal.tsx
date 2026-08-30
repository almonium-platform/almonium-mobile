import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { createThemedStyles, fonts, gradients, radii, shadows, useTheme } from '@/src/theme';

export type PaywallContext = 'second-language' | 'item-cap' | 'audio' | 'private-import' | 'general';

const wallCopy: Record<PaywallContext, { eyebrow: string; title: string; body: string; benefit: string }> = {
  'second-language': {
    eyebrow: 'ANOTHER SHELF',
    title: 'Keep more than one language moving.',
    body: 'Free includes one target language. Premium keeps every language active without replacing the shelf you already built.',
    benefit: 'All target and fluent languages',
  },
  'item-cap': {
    eyebrow: '100 WORDS KEPT',
    title: 'Your saved-item shelf is full.',
    body: 'Nothing you saved will disappear. Premium removes the cap so the next word can join the same review schedule.',
    benefit: 'Unlimited saved learning items',
  },
  audio: {
    eyebrow: 'HEAR THE WORD',
    title: 'Add pronunciation when you need it.',
    body: 'Audio has a real per-use cost, so it belongs to Premium. Reading, lookup, and the words you have already kept remain available.',
    benefit: 'Metered pronunciation audio',
  },
  'private-import': {
    eyebrow: 'YOUR OWN BOOK',
    title: 'Bring a private book to your shelf.',
    body: 'Premium includes private imports. The text stays attached to your account and is never added to the public library.',
    benefit: 'Private book imports',
  },
  general: {
    eyebrow: 'ALMONIUM +',
    title: 'Keep more of your reading life together.',
    body: 'Premium expands languages, saved items, audio, and private imports. Your existing learning data stays exactly where it is.',
    benefit: 'Every premium capability',
  },
};

export function PaywallModal({
  visible,
  onClose,
  context = 'general',
}: {
  visible: boolean;
  onClose(): void;
  context?: PaywallContext;
}) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const copy = wallCopy[context];

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.title}>{copy.title}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close membership details"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}>
          <LinearGradient
            colors={isDark ? gradients.premiumDark : gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}>
            <View style={styles.planHeading}>
              <Text style={styles.premiumTitle}>Premium +</Text>
              <Ionicons name="sparkles" size={24} color={colors.white} />
            </View>
            <Text style={styles.premiumCopy}>{copy.body}</Text>
            <View style={styles.feature}>
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.premiumFeatureText}>{copy.benefit}</Text>
            </View>
            <Button variant="secondary" onPress={() => { onClose(); router.push('/membership'); }}>
              View membership
            </Button>
          </LinearGradient>

          <View style={styles.freeCard}>
            <Text style={styles.freeTitle}>Nothing is taken away</Text>
            <Text style={styles.freeFeatureText}>Close this sheet and carry on with everything already on your Free account.</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '600',
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.field),
  },
  pressed: { opacity: 0.72 },
  content: { paddingHorizontal: 20, gap: 16 },
  premiumCard: {
    borderRadius: radii.card,
    padding: 22,
    gap: 16,
    overflow: 'hidden',
    ...shadows.media,
  },
  freeCard: {
    borderRadius: radii.card,
    padding: 22,
    gap: 16,
    backgroundColor: colors.surface,
    ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card),
  },
  planHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  premiumTitle: {
    color: colors.white,
    fontFamily: fonts.serif,
    fontSize: 29,
    fontWeight: '600',
  },
  freeTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 27,
    fontWeight: '600',
  },
  premiumCopy: { color: colors.white, fontSize: 15, lineHeight: 21 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  premiumFeatureText: { flex: 1, color: colors.white, fontSize: 15, lineHeight: 21 },
  freeFeatureText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 21 },
}));
