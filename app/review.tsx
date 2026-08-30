import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { BrandMark } from '@/components/brand-mark';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import {
  dueCards,
  nextReview,
  type ReviewRating,
  type ReviewState,
} from '@/src/card-utils';
import { languageName } from '@/src/languages';
import { colors, fonts, shadows } from '@/src/theme';

const reviewKey = (uid: string, language: string) => `almonium:review:${uid}:${language}`;

const ratings: { value: ReviewRating; label: string; hint: string; color: string }[] = [
  { value: 'again', label: 'Again', hint: '10m', color: colors.danger },
  { value: 'hard', label: 'Hard', hint: '1d+', color: '#a66c30' },
  { value: 'good', label: 'Good', hint: '2d+', color: colors.primary },
  { value: 'easy', label: 'Easy', hint: '4d+', color: '#466d9b' },
];

export default function ReviewScreen() {
  const { language = '', ahead } = useLocalSearchParams<{ language: string; ahead?: string }>();
  const { firebaseUser } = useAuth();
  const [schedule, setSchedule] = useState<Record<string, ReviewState>>({});
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
  const [ratingsGiven, setRatingsGiven] = useState<Record<ReviewRating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const query = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(firebaseUser && language),
  });

  useEffect(() => {
    if (!firebaseUser || !language) return;
    void AsyncStorage.getItem(reviewKey(firebaseUser.uid, language)).then((value) => {
      try {
        setSchedule(value ? (JSON.parse(value) as Record<string, ReviewState>) : {});
      } catch {
        setSchedule({});
      } finally {
        setReady(true);
      }
    });
  }, [firebaseUser, language]);

  const due = useMemo(
    () => ahead === '1' ? [...(query.data ?? [])] : dueCards(query.data ?? [], schedule),
    [ahead, query.data, schedule],
  );
  useEffect(() => {
    if (ready && query.data && sessionIds === null) {
      setSessionIds(due.map((card) => card.id));
    }
  }, [due, query.data, ready, sessionIds]);
  const remaining = due.filter((card) => sessionIds?.includes(card.id));
  const current = remaining[0];

  async function rate(value: ReviewRating) {
    if (!current || !firebaseUser) return;
    const updated = {
      ...schedule,
      [current.id]: nextReview(schedule[current.id], value),
    };
    setSchedule(updated);
    setRevealed(false);
    setReviewed((count) => count + 1);
    setRatingsGiven((counts) => ({ ...counts, [value]: counts[value] + 1 }));
    setSessionIds((ids) => ids?.filter((id) => id !== current.id) ?? null);
    await AsyncStorage.setItem(reviewKey(firebaseUser.uid, language), JSON.stringify(updated));
  }

  if (query.isLoading || !ready || (Boolean(query.data) && sessionIds === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (query.isError && !query.data) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={42} color={colors.primary} />
        <Text style={styles.completeTitle}>Review is unavailable</Text>
        <Text style={styles.completeCopy}>
          {query.error instanceof Error ? query.error.message : 'Check your connection and try again.'}
        </Text>
        <Button onPress={() => query.refetch()}>Try again</Button>
        <Button variant="secondary" onPress={() => router.back()}>Back to cards</Button>
      </SafeAreaView>
    );
  }

  if (!current) {
    const dessert = query.data
      ?.flatMap((card) => card.examples ?? [])
      .map((example) => example.example)
      .find(Boolean);
    return (
      <SafeAreaView style={styles.completeSafe}>
        <ScrollView contentContainerStyle={styles.completeContent}>
          {reviewed ? (
            <>
              <View style={styles.completeIcon}>
                <Ionicons name="checkmark" size={38} color={colors.white} />
              </View>
              <Text style={styles.completeEyebrow}>SESSION COMPLETE</Text>
              <Text style={styles.completeTitle}>{reviewed} {reviewed === 1 ? 'word' : 'words'}</Text>
              <View style={styles.recordRow}>
                <View style={styles.record}>
                  <Text style={styles.recordNumber}>{ratingsGiven.good + ratingsGiven.easy}</Text>
                  <Text style={styles.recordLabel}>STRAIGHT THROUGH</Text>
                </View>
                <View style={styles.record}>
                  <Text style={styles.recordNumber}>{ratingsGiven.hard}</Text>
                  <Text style={styles.recordLabel}>WITH EFFORT</Text>
                </View>
                <View style={styles.record}>
                  <Text style={styles.recordNumber}>{ratingsGiven.again}</Text>
                  <Text style={styles.recordLabel}>COMING BACK</Text>
                </View>
              </View>
              <View style={styles.dessertCard}>
                <Text style={styles.dessertEyebrow}>A SHORT RE-ENCOUNTER</Text>
                <Text style={styles.dessertTitle}>One more sentence, while the words are warm</Text>
                <Text style={styles.dessertCopy}>
                  {dessert || 'The words you met today will return in a new context.'}
                </Text>
              </View>
              <Button onPress={() => router.replace('/(tabs)/books')}>Back to reading</Button>
            </>
          ) : (
            <>
              <BrandMark size={118} />
              <Text style={styles.completeEyebrow}>NOTHING DUE</Text>
              <Text style={styles.completeTitle}>You are clear for now</Text>
              <Text style={styles.completeCopy}>
                Almo has nothing to ask you today. Reading a page will add more.
              </Text>
              <Button onPress={() => router.replace('/(tabs)/books')}>Open your shelf</Button>
              {!!query.data?.length && (
                <Button
                  variant="secondary"
                  onPress={() => router.replace({ pathname: '/review', params: { language, ahead: '1' } })}>
                  Practise ahead
                </Button>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const position = reviewed + 1;
  const total = reviewed + remaining.length;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.ink} />
        </Pressable>
        <Text style={styles.progress}>{position} / {total}</Text>
        <Text style={styles.language}>{languageName(language)}</Text>
      </View>
      <View style={styles.body}>
        <Pressable onPress={() => setRevealed(true)} style={styles.flashcard}>
          <Text style={styles.prompt}>WHAT DOES THIS MEAN?</Text>
          <Text style={styles.word}>{current.entry}</Text>
          {revealed ? (
            <View style={styles.answer}>
              <View style={styles.divider} />
              {current.translations.map((translation) => (
                <Text key={translation.id ?? translation.translation} style={styles.translation}>
                  {translation.translation}
                </Text>
              ))}
              {!!current.notes && <Text style={styles.notes}>{current.notes}</Text>}
              {!!current.examples?.length && (
                <View style={styles.examples}>
                  {current.examples.map((example) => (
                    <Text key={example.id ?? example.example} style={styles.example}>
                      “{example.example}”{example.translation ? ` — ${example.translation}` : ''}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.revealHint}>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
              <Text style={styles.revealText}>Tap to reveal</Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.footer}>
        {revealed ? (
          <>
            <Text style={styles.ratePrompt}>How well did you remember?</Text>
            <View style={styles.ratingRow}>
              {ratings.map((rating) => (
                <Pressable
                  key={rating.value}
                  onPress={() => rate(rating.value)}
                  style={[styles.rating, { borderColor: rating.color }]}>
                  <Text style={[styles.ratingLabel, { color: rating.color }]}>{rating.label}</Text>
                  <Text style={styles.ratingHint}>{rating.hint}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Button onPress={() => setRevealed(true)}>Show answer</Button>
        )}
        <Text style={styles.localNote}>Review timing is stored on this device.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  top: { minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  language: { color: colors.primary, fontWeight: '600', fontSize: 13, minWidth: 45, textAlign: 'right' },
  body: { flex: 1, justifyContent: 'center', padding: 20 },
  flashcard: { minHeight: 380, padding: 28, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 22, backgroundColor: colors.surface, ...shadows.card },
  prompt: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  word: { color: colors.ink, fontFamily: fonts.serif, fontSize: 38, lineHeight: 46, textAlign: 'center', fontWeight: '600' },
  answer: { width: '100%', alignItems: 'center', gap: 8 },
  divider: { height: 1, width: '70%', backgroundColor: colors.line, marginBottom: 12 },
  translation: { color: colors.primaryDark, fontSize: 23, lineHeight: 30, fontWeight: '600', textAlign: 'center' },
  notes: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  examples: { gap: 5, marginTop: 6 },
  example: { color: colors.ink, fontSize: 13, lineHeight: 19, fontStyle: 'italic', textAlign: 'center' },
  revealHint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  revealText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  footer: { gap: 12, padding: 20, paddingTop: 4 },
  ratePrompt: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', gap: 7 },
  rating: { flex: 1, minHeight: 56, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: colors.surface },
  ratingLabel: { fontSize: 13, fontWeight: '600' },
  ratingHint: { color: colors.muted, fontSize: 10 },
  localNote: { color: colors.muted, textAlign: 'center', fontSize: 10 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: colors.canvas },
  completeSafe: { flex: 1, backgroundColor: colors.canvas },
  completeContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 13, padding: 24 },
  completeIcon: { width: 72, height: 72, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  completeEyebrow: { color: colors.raspberry, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.5 },
  completeTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 29, lineHeight: 36, textAlign: 'center' },
  completeCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 330 },
  recordRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 },
  record: { flex: 1, alignItems: 'center', gap: 3 },
  recordNumber: { color: colors.ink, fontFamily: fonts.serif, fontSize: 25 },
  recordLabel: { color: colors.primary, fontSize: 9, letterSpacing: 0.8, textAlign: 'center' },
  dessertCard: { width: '100%', gap: 9, padding: 20, borderRadius: 24, backgroundColor: colors.reader, ...shadows.card },
  dessertEyebrow: { color: colors.accentBorder, fontFamily: fonts.sansSemibold, fontSize: 10, letterSpacing: 1.3 },
  dessertTitle: { color: colors.canvas, fontFamily: fonts.serif, fontSize: 21, lineHeight: 27 },
  dessertCopy: { color: colors.canvas, fontFamily: fonts.serifRegular, fontSize: 16, lineHeight: 25, opacity: 0.82 },
});
