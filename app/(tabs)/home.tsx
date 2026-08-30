import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { colors, fonts, shadows } from '@/src/theme';

export default function HomeScreen() {
  const { firebaseUser, profile } = useAuth();
  const activeLanguages = useMemo(
    () => profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) ?? [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] ?? '');

  useEffect(() => {
    if ((!language || !activeLanguages.includes(language)) && activeLanguages[0]) {
      setLanguage(activeLanguages[0]);
    }
  }, [activeLanguages, language]);

  const shelf = useQuery({
    queryKey: ['bookshelf', firebaseUser?.uid, language],
    queryFn: () => api.bookshelf(language),
    enabled: Boolean(firebaseUser && language),
  });
  const cards = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(firebaseUser && language),
  });
  const review = useQuery({
    queryKey: ['review-summary', firebaseUser?.uid, language],
    queryFn: () => api.reviewSummary(language),
    enabled: Boolean(firebaseUser && language),
  });
  const recentCards = useMemo(
    () =>
      [...(cards.data ?? [])]
        .sort((first, second) => (second.createdAt ?? '').localeCompare(first.createdAt ?? ''))
        .slice(0, 4),
    [cards.data],
  );
  const due = review.data?.dueCount ?? 0;
  const continueBook = shelf.data?.continueReading[0];
  const hasActivity = Boolean(continueBook || cards.data?.length);
  const loading = shelf.isLoading || cards.isLoading || review.isLoading;
  const refreshing = shelf.isRefetching || cards.isRefetching || review.isRefetching;

  async function refresh() {
    await Promise.all([shelf.refetch(), cards.refetch(), review.refetch()]);
  }

  function chooseNextLanguage() {
    if (activeLanguages.length < 2) return;
    const index = activeLanguages.indexOf(language);
    setLanguage(activeLanguages[(index + 1) % activeLanguages.length]);
  }

  if (!language) {
    return (
      <View style={styles.center}>
        <Ionicons name="language-outline" size={44} color={colors.primary} />
        <Text style={styles.emptyTitle}>Choose a learning language</Text>
        <Text style={styles.emptyCopy}>Add or activate a target language in Settings to build your home.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        language={language}
        onLanguagePress={activeLanguages.length > 1 ? chooseNextLanguage : undefined}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.topline}>
        <Text style={styles.date}>
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !hasActivity ? (
        <View style={styles.emptyCard}>
          <Ionicons name="book-outline" size={42} color={colors.primary} />
          <Text style={styles.eyebrow}>NOTHING HERE YET</Text>
          <Text style={styles.emptyTitle}>Start with one page</Text>
          <Text style={styles.emptyCopy}>Open a book from the library. The words you keep will collect here.</Text>
          <Button onPress={() => router.push('/(tabs)/books')}>Open the library</Button>
        </View>
      ) : (
        <>
          <View style={styles.continueCard}>
            {continueBook ? (
              <>
                <BookCover
                  title={continueBook.title}
                  author={continueBook.author}
                  workSlug={continueBook.workSlug}
                  coverUrl={continueBook.coverUrl}
                  style={styles.cover}
                />
                <View style={styles.continueCopy}>
                  <Text style={styles.eyebrow}>CONTINUE READING</Text>
                  <Text style={styles.bookTitle}>{continueBook.title}</Text>
                  <Text style={styles.meta}>{continueBook.author} · {continueBook.cefrLevel}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progress, { width: `${continueBook.progressPercentage ?? 0}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{continueBook.progressPercentage ?? 0}% · your place is saved</Text>
                  <Button onPress={() => router.push({ pathname: '/reader/[bookId]', params: { bookId: continueBook.id, title: continueBook.title } })}>
                    Continue
                  </Button>
                </View>
              </>
            ) : (
              <View style={styles.continueCopy}>
                <Text style={styles.eyebrow}>CONTINUE READING</Text>
                <Text style={styles.bookTitle}>Choose your next page</Text>
                <Text style={styles.meta}>Your saved words are waiting for somewhere to return.</Text>
                <Button onPress={() => router.push('/(tabs)/books')}>Open the library</Button>
              </View>
            )}
          </View>

          <View style={styles.reviewPanel}>
            <View style={styles.reviewCopy}>
              <Text style={styles.eyebrow}>REVIEW</Text>
              <Text style={styles.panelTitle}>{due === 1 ? 'One word is due' : `${due} words are due`}</Text>
              <Text style={styles.meta}>
                {review.data?.sessionSize ?? Math.min(10, due)} make a session, about {Math.max(1, Math.ceil((review.data?.sessionSize ?? Math.min(10, due)) * 0.7))} minutes.
              </Text>
            </View>
            <View style={styles.reviewStats}>
              <View><Text style={styles.reviewNumber}>{review.data?.understandCount ?? 0}</Text><Text style={styles.reviewLabel}>UNDERSTAND</Text></View>
              <View><Text style={styles.reviewNumber}>{review.data?.produceCount ?? 0}</Text><Text style={styles.reviewLabel}>PRODUCE</Text></View>
              <View><Text style={styles.reviewNumber}>{review.data?.disambiguateCount ?? 0}</Text><Text style={styles.reviewLabel}>TELL APART</Text></View>
            </View>
            <Button variant="secondary" onPress={() => router.push({ pathname: '/review', params: { language } })}>
              Start a session
            </Button>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeading}>
              <View>
                <Text style={styles.eyebrow}>KEPT WHILE READING</Text>
                <Text style={styles.panelTitle}>{cards.data?.length ?? 0} saved {(cards.data?.length ?? 0) === 1 ? 'word' : 'words'}</Text>
              </View>
              <Pressable onPress={() => router.push('/(tabs)/cards')} hitSlop={8}>
                <Text style={styles.link}>All words</Text>
              </Pressable>
            </View>
            {recentCards.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => router.push({ pathname: '/item/[itemId]', params: { itemId: card.id, language } })}
                style={styles.wordRow}>
                <View style={styles.wordCopy}>
                  <Text style={styles.word}>{card.entry}</Text>
                  <Text style={styles.translation} numberOfLines={1}>
                    {card.translations[0]?.translation ?? 'Translation not added yet'}
                  </Text>
                </View>
                {card.falseFriend && <Text style={styles.warning}>false friend</Text>}
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          <View style={styles.planLine}>
            <Text style={styles.meta}>You’re on {profile?.subscription?.name ?? (profile?.premium ? 'Premium' : 'Free')}.</Text>
            <Pressable onPress={() => router.push('/membership')}><Text style={styles.link}>Membership</Text></Pressable>
          </View>
        </>
      )}

      {(shelf.isError || cards.isError || review.isError) && (
        <Text style={styles.error}>Some home details could not be refreshed. Available sections are shown.</Text>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  topline: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { color: colors.muted, fontSize: 13 },
  loadingCard: { minHeight: 220, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.card },
  emptyCard: { minHeight: 390, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, backgroundColor: colors.surface, ...shadows.card },
  emptyTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 28, lineHeight: 35, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  continueCard: { flexDirection: 'row', gap: 18, padding: 18, borderRadius: 28, backgroundColor: colors.surface, ...shadows.card },
  cover: { width: 104, height: 150, borderRadius: 10 },
  continueCopy: { flex: 1, justifyContent: 'center', gap: 8 },
  bookTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 25, lineHeight: 30, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.line },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { color: colors.muted, fontSize: 11 },
  panel: { padding: 20, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  panelHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 8 },
  panelTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, lineHeight: 26, fontWeight: '600', marginTop: 4 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  wordRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 11 },
  wordCopy: { flex: 1, gap: 3 },
  word: { color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 18, fontWeight: '600' },
  translation: { color: colors.muted, fontSize: 13 },
  warning: { color: colors.raspberry, fontSize: 10, fontWeight: '600', backgroundColor: colors.accentSoft, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  reviewPanel: { gap: 14, padding: 18, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  reviewNumber: { color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 25, fontWeight: '600' },
  reviewCopy: { flex: 1, gap: 2 },
  reviewStats: { flexDirection: 'row', gap: 30 },
  reviewLabel: { color: colors.primary, fontSize: 10, letterSpacing: 1 },
  planLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 5 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
