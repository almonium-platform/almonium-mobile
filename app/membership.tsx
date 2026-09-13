import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { premiumLines } from '@/components/paywall-modal';
import { Button, GradientText } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { config } from '@/src/config';
import { freeSavedItemLimit } from '@/src/limits';
import { activeLanguageAllowance, membershipName, planDescribesMembership } from '@/src/membership';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';
import type { PlanOffer, PlanType, SubscriptionInfo } from '@/src/types';

type Cadence = 'MONTHLY' | 'YEARLY';

function money(value: number) {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/**
 * One route, two states, decided by the entitlement. Free is your usage against the limits and
 * the paid lines with one resolved price; paid is a receipt you can read. Purchases here route to
 * the web until store billing ships: the app explains, it does not transact.
 */
export default function MembershipScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const showNotice = useNotice();
  const [openingPortal, setOpeningPortal] = useState(false);
  const [cadence, setCadence] = useState<Cadence>('YEARLY');
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.plans, staleTime: 10 * 60_000 });
  const founding = useQuery({ queryKey: ['founding-members'], queryFn: api.foundingMembers, staleTime: 60_000 });
  const quota = useQuery({ queryKey: ['translation-quota', firebaseUser?.uid], queryFn: api.translationQuota, enabled: Boolean(firebaseUser) });
  const cardQueries = useQueries({
    queries: (profile?.learners ?? []).map((learner) => ({
      queryKey: ['cards', firebaseUser?.uid, learner.language],
      queryFn: () => api.cards(learner.language),
      enabled: Boolean(firebaseUser),
    })),
  });
  const savedWords = cardQueries.reduce((total, query) => total + (query.data?.length ?? 0), 0);
  const subscription = profile?.subscription;
  const premium = profile?.premium ?? false;
  const founderAvailable = Boolean(
    founding.data && founding.data.claimed < founding.data.capacity && plans.data?.some((plan) => plan.founderPrice),
  );
  // The founder card preselects monthly, because the barrier matters more there than the fee ratio.
  useEffect(() => {
    if (founding.data && plans.data) setCadence(founderAvailable ? 'MONTHLY' : 'YEARLY');
  }, [founderAvailable, founding.data, plans.data]);

  const planFor = (type: PlanType) => plans.data?.find((plan) => plan.type === type);
  const monthly = planFor('MONTHLY');
  const yearly = planFor('YEARLY');
  const priceOf = (plan: PlanOffer | undefined) => (plan ? (founderAvailable && plan.founderPrice ? plan.founderPrice : plan.price) : null);
  const allowance = activeLanguageAllowance(subscription);
  const activeLimit = allowance < 0 ? null : allowance;
  const activeLanguages = profile?.learners.filter((learner) => learner.active).length ?? 0;

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const { sessionUrl } = await api.customerPortal();
      await Linking.openURL(sessionUrl);
    } catch (error) {
      showNotice({ title: t('Could not open billing'), message: error instanceof Error ? error.message : t('Try again.'), tone: 'error' });
    } finally {
      setOpeningPortal(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel={t('Back')} onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('MEMBERSHIP')}</Text>
          {premium ? (
            <GradientText style={styles.title}>{membershipTitle(t, subscription)}</GradientText>
          ) : (
            <Text style={styles.title}>{t('You’re on Free')}</Text>
          )}
        </View>

        {premium ? (
          <>
            <View style={styles.card}>
              <Receipts
                rows={[
                  ...(planDescribesMembership(subscription)
                    ? [
                        { label: t('Price'), value: priceLine(t, subscription, monthly, yearly) },
                        { label: subscription?.autoRenewal === false ? t('Access ends') : t('Renews'), value: formatDate(subscription?.endDate) },
                      ]
                    : [{ label: t('Plan'), value: t('{plan}, granted', { plan: membershipName(subscription) }) }]),
                  { label: t('Member since'), value: formatDate(subscription?.startDate) },
                  ...(subscription?.scheduledChange
                    ? [
                        {
                          label: t('Scheduled change'),
                          value:
                            subscription.scheduledChange.type === 'MONTHLY'
                              ? t('Monthly from {date}', { date: formatDate(subscription.scheduledChange.effectiveAt) })
                              : t('Annual from {date}', { date: formatDate(subscription.scheduledChange.effectiveAt) }),
                        },
                      ]
                    : []),
                ]}
              />
              {planDescribesMembership(subscription) && subscription?.type !== 'LIFETIME' && (
                <Button loading={openingPortal} onPress={() => void openPortal()}>{t('Manage plan, card and invoices')}</Button>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('What’s running on it')}</Text>
              <Usage label={t('Saved words')} used={savedWords} limit={null} />
              <Usage label={t('Languages active')} used={activeLanguages} limit={activeLimit} />
              {quota.data && <Usage label={t('Translation requests this month')} used={quota.data.used} limit={quota.data.limit} />}
            </View>
            {subscription?.founder && (
              <Text style={styles.footnote}>
                {t('Your price is one of the first twenty. It stays locked for as long as the subscription runs, and it is gone if you cancel.')}
              </Text>
            )}
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('Where you are against the free limits')}</Text>
              <Usage label={t('Saved words')} used={savedWords} limit={freeSavedItemLimit} />
              <Usage label={t('Languages active')} used={activeLanguages} limit={activeLimit} />
              {quota.data && <Usage label={t('Translation requests this month')} used={quota.data.used} limit={quota.data.limit} />}
            </View>

            <View style={styles.card}>
              <Text style={styles.eyebrow}>{founderAvailable ? t('FOUNDING MEMBER') : t('PREMIUM')}</Text>
              <Text style={styles.sectionTitle}>{t('Everything in Free, plus')}</Text>
              <View style={styles.lines}>
                {premiumLines.map((line) => (
                  <View key={line} style={styles.line}>
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                    <Text style={styles.lineText}>{t(line)}</Text>
                  </View>
                ))}
              </View>
              {monthly && yearly && (
                <>
                  <View accessibilityRole="radiogroup" style={styles.cadence}>
                    {(['MONTHLY', 'YEARLY'] as Cadence[]).map((option) => (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: cadence === option }}
                        onPress={() => setCadence(option)}
                        style={[styles.cadenceOption, cadence === option && styles.cadenceOptionSelected]}>
                        <Text style={[styles.cadenceText, cadence === option && styles.cadenceTextSelected]}>{option === 'MONTHLY' ? t('Monthly') : t('Annual')}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <PriceBlock cadence={cadence} monthly={monthly} yearly={yearly} founder={founderAvailable} priceOf={priceOf} />
                </>
              )}
              <Button variant="premium" onPress={() => void Linking.openURL(`${config.webBaseUrl}/membership`)}>
                {founderAvailable ? t('Claim your place') : t('Become a member')}
              </Button>
              <Text style={styles.footnote}>
                {founderAvailable && founding.data
                  ? `${t('Only {count} founding memberships available, then the standard price. Keep this price while your subscription stays active.', { count: founding.data.capacity })} `
                  : ''}
                {t('Membership is bought on the web for now; the app recognises it as soon as it is active. 14-day money-back guarantee.')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PriceBlock({
  cadence,
  monthly,
  yearly,
  founder,
  priceOf,
}: {
  cadence: Cadence;
  monthly: PlanOffer;
  yearly: PlanOffer;
  founder: boolean;
  priceOf(plan: PlanOffer | undefined): number | null;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const monthlyPrice = priceOf(monthly) ?? monthly.price;
  const yearlyPrice = priceOf(yearly) ?? yearly.price;
  const perMonth = yearlyPrice / 12;
  if (cadence === 'MONTHLY') {
    return (
      <View style={styles.price}>
        <View style={styles.priceLine}>
          <Text style={styles.priceMain}>{t('{price} / month', { price: money(monthlyPrice) })}</Text>
          {founder && <Text style={styles.priceStruck}>{money(monthly.price)}</Text>}
        </View>
        <Text style={styles.priceNote}>{t('or {yearly} a year — that’s {monthly} a month', { yearly: money(yearlyPrice), monthly: money(Number(perMonth.toFixed(2))) })}</Text>
      </View>
    );
  }
  return (
    <View style={styles.price}>
      <View style={styles.priceLine}>
        <Text style={styles.priceMain}>{t('{price} / year', { price: money(yearlyPrice) })}</Text>
        {founder && <Text style={styles.priceStruck}>{money(yearly.price)}</Text>}
      </View>
      <Text style={styles.priceNote}>{t('That’s {price} a month', { price: money(Number(perMonth.toFixed(2))) })}</Text>
      <Text style={styles.priceNote}>{t('or {yearly} a year, billed monthly at {monthly}', { yearly: money(monthlyPrice * 12), monthly: money(monthlyPrice) })}</Text>
    </View>
  );
}

/** A receipt reads as one list: a line between entries, none under the last. */
function Receipts({ rows }: { rows: { label: string; value: string }[] }) {
  const styles = useStyles();
  return (
    <View style={styles.receipts}>
      {rows.map((row, index) => (
        <View key={row.label} style={[styles.receiptRow, index > 0 && styles.receiptRowAfterFirst]}>
          <Text style={styles.receiptLabel}>{row.label}</Text>
          <Text style={styles.receiptValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const percentage = limit ? Math.min(100, (used / limit) * 100) : 100;
  return (
    <View style={styles.usage}>
      <View style={styles.usageHeading}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>
          {limit === null ? t('{used} · unlimited', { used: used.toLocaleString() }) : t('{used} / {limit}', { used: used.toLocaleString(), limit })}
        </Text>
      </View>
      {limit !== null && <View style={styles.track}><View style={[styles.fill, { width: `${percentage}%` }]} /></View>}
    </View>
  );
}

function priceLine(t: TFunction, subscription: SubscriptionInfo | undefined, monthly: PlanOffer | undefined, yearly: PlanOffer | undefined) {
  if (!subscription) return '—';
  if (subscription.type === 'LIFETIME') return t('Lifetime');
  const isMonthly = subscription.type === 'MONTHLY';
  const plan = isMonthly ? monthly : yearly;
  const price = plan ? (subscription.founder && plan.founderPrice ? plan.founderPrice : plan.price) : null;
  if (price === null) return isMonthly ? t('Monthly') : t('Annual');
  if (subscription.founder) {
    return isMonthly ? t('{price} / month, locked', { price: money(price) }) : t('{price} / year, locked', { price: money(price) });
  }
  return isMonthly ? t('{price} / month', { price: money(price) }) : t('{price} / year', { price: money(price) });
}

function membershipTitle(t: TFunction, subscription: SubscriptionInfo | undefined) {
  if (subscription?.founder) return t('Founding member');
  // A granted membership sits on the free row, so the row's dates and LIFETIME type describe
  // nothing here: the entitlement is the whole story.
  if (!planDescribesMembership(subscription)) return t('Premium member');
  if (subscription?.type === 'LIFETIME') return t('Lifetime member');
  if (subscription?.autoRenewal === false) return t('Premium until {date}', { date: formatDate(subscription.endDate) });
  return t('Premium member');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const useStyles = createThemedStyles((colors, isDark) => ({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 38, gap: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  heading: { gap: 6 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: serifLineHeight(30), fontWeight: '600' },
  card: { gap: 14, borderRadius: 28, padding: 20, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  sectionTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 21, fontWeight: '600' },
  receipts: { marginVertical: -10 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  receiptRowAfterFirst: { borderTopWidth: 1, borderTopColor: colors.line },
  receiptLabel: { color: colors.muted, fontSize: 14 },
  receiptValue: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  usage: { gap: 7 },
  usageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  usageLabel: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  usageValue: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  lines: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  lineText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  cadence: { flexDirection: 'row', borderRadius: 999, padding: 3, backgroundColor: colors.nested },
  cadenceOption: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  cadenceOptionSelected: { backgroundColor: colors.surface },
  cadenceText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  cadenceTextSelected: { color: colors.primaryDark },
  price: { gap: 3 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  priceMain: { color: colors.ink, fontFamily: fonts.serif, fontSize: 28 },
  priceStruck: { color: colors.muted, fontSize: 15, textDecorationLine: 'line-through' },
  priceNote: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  footnote: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
}));
