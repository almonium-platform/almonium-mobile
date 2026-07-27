import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { colors, fonts, gradients, radii, shadows } from '@/src/theme';

const premiumFeatures = [
  'All target languages',
  'Unlimited reading',
  'Unlimited flashcard reviews',
  'Premium learning games',
];

const freeFeatures = [
  'One target language',
  'One story a day',
  '100 card reviews a day',
  'Basic learning games',
];

export function PaywallModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose(): void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ALMONIUM +</Text>
            <Text style={styles.title}>Compare Plans</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Compare Plans"
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
            colors={gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}>
            <View style={styles.planHeading}>
              <Text style={styles.premiumTitle}>Premium +</Text>
              <Ionicons name="sparkles" size={24} color={colors.white} />
            </View>
            <Text style={styles.premiumCopy}>
              Keep every language and learning tool within reach.
            </Text>
            <View style={styles.features}>
              {premiumFeatures.map((feature) => (
                <View key={feature} style={styles.feature}>
                  <Ionicons name="add-circle" size={20} color={colors.white} />
                  <Text style={styles.premiumFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <Button variant="secondary" disabled>
              In-app purchase coming soon
            </Button>
            <Text style={styles.purchaseNote}>
              Store purchases are not available in this build yet.
            </Text>
          </LinearGradient>

          <View style={styles.freeCard}>
            <View style={styles.planHeading}>
              <Text style={styles.freeTitle}>Free</Text>
              <Text style={styles.currentBadge}>CURRENT PLAN</Text>
            </View>
            <View style={styles.features}>
              {freeFeatures.map((feature) => (
                <View key={feature} style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={styles.freeFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
    ...shadows.field,
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
    backgroundColor: colors.white,
    ...shadows.card,
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
  features: { gap: 11 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  premiumFeatureText: { flex: 1, color: colors.white, fontSize: 15, lineHeight: 21 },
  freeFeatureText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 21 },
  currentBadge: {
    color: colors.disabledText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.disabled,
  },
  purchaseNote: { color: colors.white, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
