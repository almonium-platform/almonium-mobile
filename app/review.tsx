import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
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
  const { language = '' } = useLocalSearchParams<{ language: string }>();
  const { firebaseUser } = useAuth();
  const [schedule, setSchedule] = useState<Record<string, ReviewState>>({});
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
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

  const due = useMemo(() => dueCards(query.data ?? [], schedule), [query.data, schedule]);
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
    await AsyncStorage.setItem(reviewKey(firebaseUser.uid, language), JSON.stringify(updated));
  }

  if (query.isLoading || !ready) {
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
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.completeIcon}>
          <Ionicons name="checkmark" size={38} color={colors.white} />
        </View>
        <Text style={styles.completeTitle}>{reviewed ? 'Session complete' : 'You’re caught up'}</Text>
        <Text style={styles.completeCopy}>
          {reviewed
            ? `You reviewed ${reviewed} ${reviewed === 1 ? 'card' : 'cards'}. Come back when the next one is due.`
            : `No ${languageName(language)} cards are due right now.`}
        </Text>
        <Button onPress={() => router.back()}>Back to cards</Button>
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
  completeIcon: { width: 72, height: 72, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  completeTitle: { color: colors.ink, fontSize: 25, fontWeight: '600', textAlign: 'center' },
  completeCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 330 },
});
