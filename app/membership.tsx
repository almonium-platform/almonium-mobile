import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useNotice } from '@/src/notice-context';
import { colors, fonts, gradients, shadows } from '@/src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import type { UserInfo } from '@/src/types';

const premiumFeatures = [
  'Unlimited saved words',
  'Every target and fluent language',
  'Books adapted to your level',
  'Private book imports',
  'Cross-device sync',
];

export default function MembershipScreen() {
  const { firebaseUser, profile } = useAuth();
  const showNotice = useNotice();
  const [openingPortal, setOpeningPortal] = useState(false);
  const cardQueries = useQueries({
    queries: (profile?.learners ?? []).map((learner) => ({
      queryKey: ['cards', firebaseUser?.uid, learner.language],
      queryFn: () => api.cards(learner.language),
      enabled: Boolean(firebaseUser),
    })),
  });
  const savedWords = cardQueries.reduce((total, query) => total + (query.data?.length ?? 0), 0);
  const subscription = profile?.subscription;
  const targetLimit = subscription?.limits.MAX_TARGET_LANGS ?? 1;
  const fluentLimit = subscription?.limits.MAX_FLUENT_LANGS ?? 1;

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const { sessionUrl } = await api.customerPortal();
      await Linking.openURL(sessionUrl);
    } catch (error) {
      showNotice({ title: 'Could not open billing', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setOpeningPortal(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>MEMBERSHIP</Text>
        <Text style={styles.title}>{profile?.premium ? membershipTitle(subscription) : 'You’re on Free'}</Text>
        <Text style={styles.copy}>{profile?.premium ? renewalCopy(subscription) : 'Your current usage and the capabilities that membership adds.'}</Text>
      </View>

      <View style={styles.usageCard}>
        <Text style={styles.sectionTitle}>{profile?.premium ? 'What’s running on it' : 'Where you are against the free limits'}</Text>
        <Usage label="Saved words" used={savedWords} limit={profile?.premium ? null : 100} />
        <Usage label="Target languages" used={profile?.learners.length ?? 0} limit={profile?.premium ? null : targetLimit} />
        <Usage label="Fluent languages" used={profile?.fluentLangs.length ?? 0} limit={profile?.premium ? null : fluentLimit} />
        {profile?.premium && (
          <>
            <View style={styles.details}>
              <View><Text style={styles.detailLabel}>Plan</Text><Text style={styles.detailValue}>{subscription?.name}</Text></View>
              <View><Text style={styles.detailLabel}>Member since</Text><Text style={styles.detailValue}>{formatDate(subscription?.startDate)}</Text></View>
            </View>
            {subscription?.type !== 'LIFETIME' && <Button loading={openingPortal} onPress={openPortal}>Manage plan and invoices</Button>}
          </>
        )}
      </View>

      {!profile?.premium && (
        <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumCard}>
          <View style={styles.premiumHeading}>
            <Text style={styles.premiumTitle}>Premium</Text>
            <Ionicons name="star" size={24} color={colors.white} />
          </View>
          <Text style={styles.premiumCopy}>Everything in Free, plus:</Text>
          <View style={styles.features}>
            {premiumFeatures.map((feature) => <View key={feature} style={styles.feature}><Ionicons name="checkmark" size={18} color={colors.white} /><Text style={styles.featureText}>{feature}</Text></View>)}
          </View>
          <View style={styles.storeNote}>
            <Text style={styles.storeTitle}>Purchases are not available in this build</Text>
            <Text style={styles.storeCopy}>Native billing will be added through the app stores. Your existing web membership is recognised automatically.</Text>
          </View>
        </LinearGradient>
      )}
    </ScrollView>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percentage = limit ? Math.min(100, (used / limit) * 100) : 100;
  return (
    <View style={styles.usage}>
      <View style={styles.usageHeading}><Text style={styles.usageLabel}>{label}</Text><Text style={styles.usageValue}>{used}{limit === null ? ' · unlimited' : ` / ${limit}`}</Text></View>
      {limit !== null && <View style={styles.track}><View style={[styles.fill, { width: `${percentage}%` }]} /></View>}
    </View>
  );
}

function membershipTitle(subscription: UserInfo['subscription'] | undefined) {
  if (subscription?.type === 'LIFETIME') return 'Lifetime member';
  if (subscription?.autoRenewal === false) return `Premium until ${formatDate(subscription.endDate)}`;
  return 'Premium member';
}

function renewalCopy(subscription: UserInfo['subscription'] | undefined) {
  if (subscription?.type === 'LIFETIME') return 'No renewal needed.';
  if (!subscription?.endDate) return 'Your membership is active.';
  return `${subscription.autoRenewal ? 'Renews' : 'Access ends'} ${formatDate(subscription.endDate)}.`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 38, gap: 16 },
  heading: { gap: 7 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 37, fontWeight: '600' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  usageCard: { gap: 16, borderRadius: 28, padding: 21, backgroundColor: colors.surface, ...shadows.card },
  sectionTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 21, fontWeight: '600' },
  usage: { gap: 7 },
  usageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  usageLabel: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  usageValue: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  details: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 15 },
  detailLabel: { color: colors.muted, fontSize: 11 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 3 },
  premiumCard: { gap: 15, borderRadius: 28, padding: 22, overflow: 'hidden', ...shadows.media },
  premiumHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  premiumTitle: { color: colors.white, fontFamily: fonts.serif, fontSize: 28, fontWeight: '600' },
  premiumCopy: { color: colors.white, fontSize: 14 },
  features: { gap: 10 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  featureText: { flex: 1, color: colors.white, fontSize: 14, lineHeight: 20 },
  storeNote: { gap: 4, borderRadius: 17, padding: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  storeTitle: { color: colors.white, fontSize: 13, fontWeight: '600' },
  storeCopy: { color: colors.white, fontSize: 12, lineHeight: 18 },
});
