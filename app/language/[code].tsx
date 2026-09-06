import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeekBand } from '@/components/harness';
import { RecordStrip } from '@/components/record-strip';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useCrest } from '@/src/crest-context';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { bandWeeks, formatDay, rhythmSummary } from '@/src/rhythm';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import { rhythmFor, useLearningStats, useRhythm } from '@/src/use-rhythm';

/**
 * The read-only record of one language, active or set aside. Its own route, not a state of
 * home: no switcher, no reader chrome, no session entry. The swap and its cooldown are stated in
 * one line, and inside the cooldown Make active greys with that line as the whole explanation.
 */
export default function LanguageRecordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const { crestFor } = useCrest();
  const showNotice = useNotice();
  const queryClient = useQueryClient();
  const learner = profile?.learners.find((entry) => entry.language === code);
  const rhythm = useRhythm();
  const languageRhythm = rhythmFor(rhythm.data, code);
  const stats = useLearningStats(code);
  const policy = useQuery({
    queryKey: ['active-language-policy', firebaseUser?.uid],
    queryFn: api.activeLanguagePolicy,
    enabled: Boolean(firebaseUser),
  });
  const cards = useQuery({
    queryKey: ['cards', firebaseUser?.uid, code],
    queryFn: () => api.cards(code),
    enabled: Boolean(firebaseUser && code),
  });
  const review = useQuery({
    queryKey: ['review-summary', firebaseUser?.uid, code],
    queryFn: () => api.reviewSummary(code),
    enabled: Boolean(firebaseUser && code),
  });
  const activate = useMutation({
    mutationFn: () => api.updateLearner(code, { active: true }),
    onSuccess: async () => {
      await refreshProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['active-language-policy'] }),
        queryClient.invalidateQueries({ queryKey: ['rhythm'] }),
      ]);
    },
    onError: (error) =>
      showNotice({ title: 'Could not make this language active', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' }),
  });

  const name = languageName(code);
  const crest = crestFor(code);
  const active = learner?.active ?? false;
  const cooldownUntil = policy.data?.nextSwitchAllowedAt ? new Date(policy.data.nextSwitchAllowedAt) : null;
  const inCooldown = Boolean(cooldownUntil && cooldownUntil.getTime() > Date.now());
  const allowance = policy.data?.allowance ?? 1;
  const activeOthers = profile?.learners.filter((entry) => entry.active && entry.language !== code) ?? [];
  const swaps = allowance !== -1 && activeOthers.length >= allowance ? activeOthers[0] : null;
  const due = review.data?.dueCount ?? 0;
  const wordsKept = stats.data?.wordsKept ?? cards.data?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
            <Text style={styles.backText}>Profile</Text>
          </Pressable>
        </View>
        <View style={styles.heading}>
          <View style={[styles.crest, { borderColor: crest }]}>
            <Text style={[styles.crestText, { color: crest }]}>{code}</Text>
          </View>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.copy}>
            {active
              ? `Active${learner ? ` · ${learner.selfReportedLevel}` : ''}. Everything you read and keep counts here.`
              : languageRhythm?.setAsideAt
                ? `Set aside on ${formatDay(languageRhythm.setAsideAt)}. Everything is kept.`
                : 'Set aside. Everything is kept.'}
          </Text>
          {!active && (
            <View style={styles.activate}>
              <Button loading={activate.isPending} disabled={inCooldown || policy.isLoading} onPress={() => activate.mutate()}>
                Make active
              </Button>
              <Text style={styles.copy}>
                {inCooldown && cooldownUntil
                  ? `You can change your active language once a month. Next change available ${cooldownUntil.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
                  : swaps
                    ? `Making ${name} active sets ${languageName(swaps.language)} aside in its place.${allowance === 1 ? ' You can change again in a month.' : ''}`
                    : `Making ${name} active adds it to the languages you are studying.`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <RecordStrip stats={stats.data} rhythm={languageRhythm} />
          {languageRhythm && (
            <>
              <WeekBand weeks={bandWeeks(languageRhythm)} crest={crest} />
              <Text style={styles.copy}>{rhythmSummary(languageRhythm, name)}</Text>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>YOUR WORDS</Text>
          <Text style={styles.sectionTitle}>
            {due ? `${due} due${active ? '' : ' when you come back'}` : wordsKept ? 'Nothing due right now' : 'Nothing kept yet'}
          </Text>
          {(cards.data ?? []).slice(0, 3).map((card) => (
            <View key={card.id} style={styles.wordRow}>
              <Text style={styles.word}>{card.entry}</Text>
              <Text style={styles.wordMeta}>
                {card.iteration ? `seen ${card.iteration}×` : card.translations[0]?.translation ?? ''}
              </Text>
            </View>
          ))}
          {wordsKept > 0 && (
            <Pressable onPress={() => router.push('/(tabs)/cards')} style={styles.inlineAction}>
              <Text style={styles.link}>All {wordsKept.toLocaleString()} words</Text>
            </Pressable>
          )}
          {!active && due > 0 && <Text style={styles.copy}>Reviewing needs this language active.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 10 },
  backText: { color: colors.ink, fontSize: 15 },
  heading: { gap: 8, paddingHorizontal: 2 },
  crest: { alignSelf: 'flex-start', minWidth: 44, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderWidth: 1, borderRadius: 999 },
  crestText: { fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 0.8 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, fontWeight: '600' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  activate: { gap: 10, paddingTop: 6 },
  section: { gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, paddingHorizontal: 2 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 21, lineHeight: 27, fontWeight: '600' },
  wordRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10 },
  word: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17 },
  wordMeta: { color: colors.metadata, fontSize: 12 },
  inlineAction: { minHeight: 40, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
}));
