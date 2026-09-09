import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import {
  intentInstruction,
  intentLabel,
  type ReviewAnswer,
  type ReviewSession,
  type ReviewSessionResult,
} from '@/src/review';
import { lightImpact, successHaptic } from '@/src/haptics';
import { configureDailyReminder, dismissReviewReminderOffer, shouldOfferReviewReminder } from '@/src/reminders';
import { useLearningActivity } from '@/src/use-activity';
import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';

export default function ReviewScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { language = '' } = useLocalSearchParams<{ language: string }>();
  const { firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<ReviewAnswer | null>(null);
  const [openedHints, setOpenedHints] = useState<string[]>([]);
  const [result, setResult] = useState<ReviewSessionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mistypeRecorded, setMistypeRecorded] = useState(false);
  const [error, setError] = useState('');
  const summary = useQuery({
    queryKey: ['review-summary', firebaseUser?.uid, language],
    queryFn: () => api.reviewSummary(language),
    enabled: Boolean(firebaseUser && language),
  });
  const current = session?.items[currentIndex] ?? null;
  const activity = useLearningActivity('REVIEW', language || null);

  async function startSession() {
    if (submitting || !summary.data?.sessionSize) return;
    setSubmitting(true);
    setError('');
    try {
      const next = await api.startReview(language);
      if (!next.items.length) {
        await summary.refetch();
        return;
      }
      setSession(next);
      setCurrentIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start this review session.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer(revealed = false) {
    if (!current || !session || feedback || submitting || (!revealed && !answer.trim())) return;
    setSubmitting(true);
    setError('');
    try {
      const next = await api.answerReview(session.sessionId, current.itemId, {
        promptId: current.promptId,
        answer: answer.trim(),
        hintsOpened: openedHints,
        revealed,
      });
      setFeedback(next);
      // Light impact when a grade commits: the one haptic a card is allowed.
      lightImpact();
      activity.tick();
      await queryClient.invalidateQueries({
        queryKey: ['review-summary', firebaseUser?.uid, language],
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your answer could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  }

  async function nextItem() {
    if (!session || !feedback || submitting) return;
    if (currentIndex < session.items.length - 1) {
      setCurrentIndex((index) => index + 1);
      setAnswer('');
      setFeedback(null);
      setOpenedHints([]);
      setMistypeRecorded(false);
      setError('');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      setResult(await api.reviewResult(session.sessionId));
      // Session complete is one of the two earned events on the phone.
      successHaptic();
      void activity.complete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the session record.');
    } finally {
      setSubmitting(false);
    }
  }

  async function markMistype() {
    if (!feedback?.confusedWith || submitting || mistypeRecorded) return;
    setSubmitting(true);
    setError('');
    try {
      await api.markReviewMistype(feedback.eventId);
      setMistypeRecorded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the correction.');
    } finally {
      setSubmitting(false);
    }
  }

  async function reencounter(itemId: string) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.reencounterReviewItem(itemId);
      await summary.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare another prompt shape.');
    } finally {
      setSubmitting(false);
    }
  }

  function leave() {
    router.replace('/(tabs)/cards');
  }

  if (summary.isLoading && !session) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if ((summary.isError && !summary.data) || !language) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={42} color={colors.primary} />
        <Text style={styles.stateTitle}>Review is unavailable</Text>
        <Text style={styles.stateCopy}>
          {summary.error instanceof Error ? summary.error.message : 'Choose an active language and try again.'}
        </Text>
        <Button onPress={() => summary.refetch()}>Try again</Button>
        <Button variant="secondary" onPress={leave}>Back to Review</Button>
      </SafeAreaView>
    );
  }

  if (result) return <CompleteState result={result} onDone={leave} />;

  if (!session || !current) {
    const due = summary.data?.dueCount ?? 0;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.overview}>
          <Pressable accessibilityLabel="Close review" onPress={leave} style={styles.closeOverview}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </Pressable>
          {due ? (
            <>
              <Text style={styles.eyebrow}>REVIEW · {language}</Text>
              <Text style={styles.overviewTitle}>{due} {due === 1 ? 'word is' : 'words are'} due</Text>
              <Text style={styles.overviewCopy}>Ten or fewer make a session. Leaving early never reschedules what you did not answer.</Text>
              <View style={styles.summaryCard}>
                {/* Three stacked groups, not columns: a phone reads down. */}
                {[
                  { label: 'Understand', value: summary.data?.understandCount ?? 0 },
                  { label: 'Produce', value: summary.data?.produceCount ?? 0 },
                  { label: 'Tell apart', value: summary.data?.disambiguateCount ?? 0 },
                ].map((group) => (
                  <View key={group.label} style={styles.groupRow}>
                    <Text style={styles.groupCount}>{group.value}</Text>
                    <Text style={styles.groupLabel}>{group.label}</Text>
                  </View>
                ))}
                <Text style={[styles.sessionCopy, styles.sessionCopySpaced]}>{summary.data?.sessionSize ?? 0} in this session · about {Math.max(1, Math.ceil((summary.data?.sessionSize ?? 0) * 0.7))} minutes</Text>
              </View>
              {!!summary.data?.leeches.length && (
                <View style={styles.leechPanel}>
                  <Text style={styles.eyebrow}>{summary.data.leechCount} STOPPED MOVING</Text>
                  <Text style={styles.leechCopy}>These words need a different prompt shape before they return.</Text>
                  {summary.data.leeches.slice(0, 3).map((item) => (
                    <Pressable
                      key={item.itemId}
                      disabled={submitting}
                      onPress={() => reencounter(item.itemId)}
                      style={styles.leechRow}>
                      <View style={styles.leechEntryCopy}>
                        <Text style={styles.leechEntry}>{item.entry}</Text>
                        <Text style={styles.leechMeta}>{item.failureCount} same-shape misses</Text>
                      </View>
                      <Text style={styles.leechAction}>Meet another way</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button loading={submitting} onPress={startSession}>Start this session</Button>
            </>
          ) : (
            <>
              <Image source={require('../assets/images/almo-asleep.png')} contentFit="contain" style={styles.almo} />
              <Text style={styles.eyebrow}>NOTHING DUE</Text>
              <Text style={styles.overviewTitle}>You are clear for now</Text>
              <Text style={styles.stateCopy}>Almo has nothing to ask you today. Reading a page will add more.</Text>
              <Button onPress={() => router.replace('/(tabs)/books')}>Open your shelf</Button>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const completed = feedback?.completedCount ?? currentIndex;
  const position = feedback?.completedCount ?? currentIndex + 1;
  return (
    <SafeAreaView style={styles.safe}>
      <SessionHeader completed={completed} position={position} total={session.items.length} onClose={leave} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {feedback ? (
          <FeedbackState
            feedback={feedback}
            prompt={current.prompt}
            sourceContext={current.sourceContext}
            submitting={submitting}
            mistypeRecorded={mistypeRecorded}
            error={error}
            onMistype={markMistype}
            onNext={nextItem}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.questionContent} keyboardShouldPersistTaps="handled">
            <View style={styles.questionHeading}>
              <Text style={styles.eyebrow}>{intentLabel(current.intent).toUpperCase()}</Text>
              <Text style={styles.instruction}>{intentInstruction(current.intent)}</Text>
              <Text style={styles.prompt}>{current.prompt}</Text>
              {!!current.sourceContext && <Text style={styles.sourceContext}>“{current.sourceContext}”</Text>}
            </View>
            <View style={styles.answerGroup}>
              <Text style={styles.answerLabel}>Your answer</Text>
              <TextInput
                autoFocus
                value={answer}
                onChangeText={setAnswer}
                onSubmitEditing={() => void submitAnswer(false)}
                placeholder={current.intent === 'PRODUCE' ? 'Word, with the article' : 'Meaning in your own words'}
                placeholderTextColor={colors.metadata}
                returnKeyType="done"
                style={styles.answerInput}
              />
            </View>
            {!!current.hints.length && (
              <View style={styles.hints}>
                <Text style={styles.eyebrow}>HINTS</Text>
                <Text style={styles.hintIntro}>Each one you open is recorded as part of this answer.</Text>
                {current.hints.map((hint) => {
                  const opened = openedHints.includes(hint.type);
                  return (
                    <Pressable
                      key={hint.type}
                      onPress={() => setOpenedHints((items) => opened ? items.filter((item) => item !== hint.type) : [...items, hint.type])}
                      style={[styles.hint, opened && styles.hintOpen]}>
                      <View style={styles.hintHeading}>
                        <Text style={styles.hintLabel}>{hint.label}</Text>
                        <Text style={styles.hintCost}>{hint.cost}</Text>
                      </View>
                      {opened && <Text style={styles.hintContent}>{hint.content}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button loading={submitting} disabled={!answer.trim()} onPress={() => submitAnswer(false)}>Check answer</Button>
            <Pressable disabled={submitting} onPress={() => submitAnswer(true)} style={styles.revealAction}>
              <Text style={styles.revealText}>Show me the answer</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SessionHeader({ completed, position, total, onClose }: { completed: number; position: number; total: number; onClose(): void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.sessionHeader}>
      <View style={styles.planks}>
        {Array.from({ length: total }, (_, index) => <View key={index} style={[styles.plank, index < completed && styles.plankDone]} />)}
      </View>
      <Text style={styles.progressText}>{position}/{total}</Text>
      <Pressable accessibilityLabel="Leave session" onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function FeedbackState({ feedback, prompt, sourceContext, submitting, mistypeRecorded, error, onMistype, onNext }: {
  feedback: ReviewAnswer;
  prompt: string;
  sourceContext: string | null;
  submitting: boolean;
  mistypeRecorded: boolean;
  error: string;
  onMistype(): void;
  onNext(): void;
}) {
  const styles = useStyles();
  const confused = feedback.confusedWith;
  return (
    <ScrollView contentContainerStyle={styles.feedbackContent}>
      <View style={styles.feedbackHeading}>
        <Text style={styles.eyebrow}>{confused ? 'CLOSE, BUT THAT WAS THE OTHER ONE' : feedback.outcome === 'CORRECT' ? 'THAT HELD' : 'LET’S NAME THE DIFFERENCE'}</Text>
        <Text style={styles.feedbackTitle}>{confused ? `You wrote ${confused.entry}` : feedback.outcome === 'CORRECT' ? 'You had it.' : 'This one comes back.'}</Text>
      </View>
      <View style={styles.comparisonCard}>
        <View style={styles.comparisonMuted}>
          <Text style={styles.comparisonLabel}>WHAT YOU WROTE</Text>
          <Text style={styles.comparisonEntry}>{confused?.entry || feedback.answer || 'Answer revealed'}</Text>
          {!!confused?.meaning && <Text style={styles.comparisonMeaning}>{confused.meaning}</Text>}
          {!!confused?.example && <Text style={styles.comparisonExample}>“{confused.example}”</Text>}
        </View>
        <View style={styles.comparisonAsked}>
          <Text style={[styles.comparisonLabel, styles.comparisonLabelAsked]}>WHAT WAS BEING ASKED</Text>
          <Text style={[styles.comparisonEntry, styles.comparisonEntryAsked]}>{feedback.expectedAnswer}</Text>
          <Text style={styles.comparisonMeaning}>{prompt}</Text>
          {!!sourceContext && <Text style={styles.comparisonExample}>“{sourceContext}”</Text>}
        </View>
        {confused && (
          <View style={styles.contrastPanel}>
            <Text style={styles.contrastLabel}>TELLING THEM APART</Text>
            <Text style={styles.contrastCopy}>Both words now stay connected in tell-apart practice. The next prompt will keep their meanings in view.</Text>
          </View>
        )}
      </View>
      {confused && <Text style={styles.confusionNote}>{confused.directionCount === 1 ? 'First time these two have crossed.' : `${confused.directionCount} times these two have crossed.`}</Text>}
      {feedback.leech && <Text style={styles.leechNotice}>This prompt shape has paused. Review will bring the word back another way.</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button loading={submitting} onPress={onNext}>Next word</Button>
      {confused && (
        <Pressable disabled={submitting || mistypeRecorded} onPress={onMistype} style={styles.revealAction}>
          <Text style={styles.revealText}>{mistypeRecorded ? 'Mistype recorded' : 'I only mistyped'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function CompleteState({ result, onDone }: { result: ReviewSessionResult; onDone(): void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [offerReminder, setOfferReminder] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState('');
  useEffect(() => {
    if (Platform.OS !== 'web') void shouldOfferReviewReminder().then(setOfferReminder);
  }, []);

  async function enableReminder() {
    setSavingReminder(true);
    setReminderError('');
    try {
      await configureDailyReminder(true, 20);
      setOfferReminder(false);
    } catch (cause) {
      setReminderError(cause instanceof Error ? cause.message : 'The reminder could not be enabled.');
    } finally {
      setSavingReminder(false);
    }
  }

  function dismissReminder() {
    setOfferReminder(false);
    void dismissReviewReminderOffer();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.completeContent}>
        <View style={styles.completeIcon}><Ionicons name="checkmark" size={38} color={colors.onPrimary} /></View>
        <Text style={styles.eyebrow}>SESSION COMPLETE</Text>
        <Text style={styles.overviewTitle}>{result.total} {result.total === 1 ? 'word' : 'words'}</Text>
        <View style={styles.summaryStats}>
          <SummaryStat value={result.straightThrough} label="Straight through" />
          <SummaryStat value={result.afterHint} label="After a hint" />
          <SummaryStat value={result.confused} label="Mixed up" />
        </View>
        {!!result.dessertSentences.length && (
          <View style={styles.dessertCard}>
            <Text style={styles.dessertEyebrow}>A SHORT RE-ENCOUNTER</Text>
            <Text style={styles.dessertTitle}>Saved sentences around the words that resisted</Text>
            {result.dessertSentences.slice(0, 3).map((sentence) => <Text key={sentence} style={styles.dessertCopy}>{sentence}</Text>)}
          </View>
        )}
        {offerReminder && (
          <View style={styles.reminderOffer}>
            <Ionicons name="notifications-outline" size={25} color={colors.primary} />
            <Text style={styles.reminderTitle}>Want one calm reminder?</Text>
            <Text style={styles.stateCopy}>Choose a daily 8:00 PM window. It stays off unless you say yes.</Text>
            {!!reminderError && <Text style={styles.error}>{reminderError}</Text>}
            <Button loading={savingReminder} onPress={enableReminder}>Turn on review reminder</Button>
            <Pressable disabled={savingReminder} onPress={dismissReminder} style={styles.revealAction}><Text style={styles.revealText}>Not now</Text></Pressable>
          </View>
        )}
        <Text style={styles.stateCopy}>{result.stillDue ? `${result.stillDue} still due. Nothing was lost by stopping here.` : 'You are clear for now.'}</Text>
        <Button onPress={onDone}>Back to Review</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  const styles = useStyles();
  return <View style={styles.summaryStat}><Text style={styles.summaryNumber}>{value}</Text><Text style={styles.summaryLabel}>{label.toUpperCase()}</Text></View>;
}

const useStyles = createThemedStyles((colors, isDark) => ({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13, padding: 32, backgroundColor: colors.canvas },
  stateTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 26, textAlign: 'center' },
  stateCopy: { maxWidth: 330, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  overview: { flexGrow: 1, justifyContent: 'center', gap: 14, padding: 20 },
  almo: { width: 120, height: 126, alignSelf: 'center' },
  closeOverview: { position: 'absolute', top: 8, right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.raspberry, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.5 },
  overviewTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: serifLineHeight(30), textAlign: 'center' },
  overviewCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  summaryCard: { gap: 6, padding: 18, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  groupRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  groupCount: { width: 32, color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 24 },
  groupLabel: { color: colors.ink, fontSize: 15 },
  summaryStats: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  summaryStat: { flex: 1, alignItems: 'center', gap: 3 },
  summaryNumber: { color: colors.ink, fontFamily: fonts.serif, fontSize: 25 },
  summaryLabel: { color: colors.primary, fontSize: 9, letterSpacing: 0.7, textAlign: 'center' },
  sessionCopy: { color: colors.muted, fontSize: 12.5, textAlign: 'center' },
  sessionCopySpaced: { paddingTop: 10 },
  leechPanel: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  leechCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  leechRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
  leechEntryCopy: { flex: 1, gap: 2 },
  leechEntry: { flex: 1, color: colors.ink, fontFamily: fonts.serif, fontSize: 16 },
  leechMeta: { color: colors.metadata, fontSize: 11 },
  leechAction: { alignSelf: 'center', color: colors.primary, fontFamily: fonts.sansMedium, fontSize: 11.5 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  sessionHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  planks: { flex: 1, flexDirection: 'row', gap: 4 },
  plank: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.disabled },
  plankDone: { backgroundColor: colors.primary },
  progressText: { color: colors.metadata, fontSize: 11.5 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  questionContent: { flexGrow: 1, justifyContent: 'center', gap: 18, padding: 20, paddingBottom: 32 },
  questionHeading: { alignItems: 'center', gap: 9 },
  instruction: { color: colors.muted, fontSize: 13.5 },
  prompt: { color: colors.ink, fontFamily: fonts.serif, fontSize: 29, lineHeight: serifLineHeight(29), textAlign: 'center' },
  sourceContext: { color: colors.muted, fontFamily: fonts.serifRegular, fontSize: 15, lineHeight: 23, fontStyle: 'italic', textAlign: 'center' },
  answerGroup: { gap: 7 },
  answerLabel: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 13 },
  answerInput: { minHeight: 54, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 27, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, ...shadows.field },
  hints: { gap: 8 },
  hintIntro: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  hint: { minHeight: 48, justifyContent: 'center', gap: 8, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface },
  hintOpen: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  hintHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  hintLabel: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 13.5 },
  hintCost: { color: colors.metadata, fontSize: 11 },
  hintContent: { color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 17, lineHeight: serifLineHeight(17) },
  revealAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  revealText: { color: colors.raspberry, fontFamily: fonts.sansMedium, fontSize: 13 },
  feedbackContent: { flexGrow: 1, justifyContent: 'center', gap: 14, padding: 16, paddingBottom: 30 },
  feedbackHeading: { gap: 6, paddingHorizontal: 4 },
  feedbackTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 26, lineHeight: serifLineHeight(26) },
  comparisonCard: { overflow: 'hidden', borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  comparisonMuted: { gap: 6, padding: 17, backgroundColor: colors.nested },
  comparisonAsked: { gap: 6, padding: 17 },
  comparisonLabel: { color: colors.metadata, fontSize: 10.5, letterSpacing: 1.2 },
  comparisonLabelAsked: { color: colors.primary },
  comparisonEntry: { color: colors.ink, fontFamily: fonts.serif, fontSize: 23 },
  comparisonEntryAsked: { color: colors.primary },
  comparisonMeaning: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  comparisonExample: { color: colors.reader, fontFamily: fonts.serifRegular, fontSize: 14, lineHeight: 21 },
  contrastPanel: { gap: 5, padding: 15, backgroundColor: isDark ? colors.overlay : colors.ink },
  contrastLabel: { color: colors.accentBorder, fontSize: 10.5, letterSpacing: 1.2 },
  contrastCopy: { color: isDark ? colors.ink : colors.canvas, fontSize: 13.5, lineHeight: 20 },
  confusionNote: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  leechNotice: { padding: 12, borderRadius: 14, backgroundColor: colors.accentSoft, color: colors.primaryDark, fontSize: 12.5, lineHeight: 18 },
  completeContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  completeIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.primary },
  dessertCard: { width: '100%', gap: 9, padding: 20, borderRadius: 24, backgroundColor: isDark ? colors.overlay : colors.reader, ...shadows.card },
  dessertEyebrow: { color: colors.accentBorder, fontSize: 10, letterSpacing: 1.3 },
  dessertTitle: { color: colors.canvas, fontFamily: fonts.serif, fontSize: 21, lineHeight: serifLineHeight(21) },
  dessertCopy: { color: colors.canvas, fontFamily: fonts.serifRegular, fontSize: 16, lineHeight: 25, opacity: 0.82 },
  reminderOffer: { width: '100%', alignItems: 'center', gap: 9, borderRadius: 24, padding: 18, backgroundColor: colors.surface, ...shadows.card },
  reminderTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20 },
}));
