import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { BookCover } from '@/components/book-cover';
import { Harness } from '@/components/harness';
import { RecordStrip } from '@/components/record-strip';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useCrest } from '@/src/crest-context';
import { languageName } from '@/src/languages';
import { freeSavedItemLimit } from '@/src/limits';
import { membershipName } from '@/src/membership';
import { intentLabel } from '@/src/review';
import { createThemedStyles, fonts, shadows, useTheme } from '@/src/theme';
import { rhythmFor, useLearningStats, useRhythm } from '@/src/use-rhythm';

const wordsPerMinute = 200;

/**
 * Home 3a: the book is the only card. Review, the kept words, the record and the plan sit on the
 * ground, separated by hairlines. One primary action (Continue); Start a session outlines toward ink.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const { crestFor } = useCrest();
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
  const rhythm = useRhythm();
  const stats = useLearningStats(language);
  const languageRhythm = rhythmFor(rhythm.data, language);
  const weekAgo = useMemo(() => Date.now() - 7 * 86_400_000, []);
  const recentCards = useMemo(
    () =>
      [...(cards.data ?? [])]
        .sort((first, second) => (second.createdAt ?? '').localeCompare(first.createdAt ?? ''))
        .slice(0, 4),
    [cards.data],
  );
  const keptThisWeek = useMemo(
    () => (cards.data ?? []).filter((card) => card.createdAt && new Date(card.createdAt).getTime() >= weekAgo).length,
    [cards.data, weekAgo],
  );
  const due = review.data?.dueCount ?? 0;
  const sessionSize = review.data?.sessionSize ?? Math.min(10, due);
  const continueBook = shelf.data?.continueReading[0];
  const hasActivity = Boolean(continueBook || cards.data?.length);
  const loading = shelf.isLoading || cards.isLoading || review.isLoading;
  const refreshing = shelf.isRefetching || cards.isRefetching || review.isRefetching;
  const crest = crestFor(language);
  const savedCount = cards.data?.length ?? 0;

  async function refresh() {
    await Promise.all([shelf.refetch(), cards.refetch(), review.refetch(), rhythm.refetch(), stats.refetch()]);
  }

  if (!language) {
    return (
      <View style={styles.center}>
        <Text style={styles.sectionTitle}>Choose a learning language</Text>
        <Text style={styles.copy}>Add or activate a target language in Settings to build your home.</Text>
        <Button onPress={() => router.push({ pathname: '/(tabs)/settings', params: { tab: 'learning' } })}>Open settings</Button>
      </View>
    );
  }

  const groups = [
    { label: intentLabel('UNDERSTAND'), count: review.data?.understandCount ?? 0 },
    { label: intentLabel('PRODUCE'), count: review.data?.produceCount ?? 0 },
    { label: intentLabel('DISAMBIGUATE'), count: review.data?.disambiguateCount ?? 0 },
  ].filter((group) => group.count > 0);

  return (
    <View style={styles.screen}>
      <AppHeader language={language} onLanguageChange={activeLanguages.length > 1 ? setLanguage : undefined} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <Text style={styles.date}>
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </Text>

        {loading ? (
          <View style={styles.loadingCard}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : !hasActivity ? (
          <View style={styles.card}>
            <Image source={require('../../assets/images/almo-standing.png')} contentFit="contain" style={styles.almo} />
            <Text style={styles.eyebrow}>NOTHING HERE YET</Text>
            <Text style={styles.bookTitle}>Start with one page</Text>
            <Text style={styles.copy}>Open a book and the words you keep collect here, next to the sentence you met them in. One page is enough to see how it works.</Text>
            <Button onPress={() => router.push('/(tabs)/books')}>Open the library</Button>
            <Pressable onPress={() => router.push('/(tabs)/lookup')} style={styles.inlineAction}>
              <Text style={styles.link}>Or paste a sentence into Look up</Text>
            </Pressable>
          </View>
        ) : continueBook ? (
          <View style={styles.card}>
            <View style={styles.continueRow}>
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
                <Text style={styles.meta}>
                  {continueBook.author} · {continueBook.cefrLevel}
                  {continueBook.hasParallelTranslation ? ` · ${languageName(continueBook.language)} beside ${languageName(profile?.fluentLangs[0] ?? '')}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progress, { width: `${continueBook.progressPercentage ?? 0}%` }]} />
            </View>
            <Text style={styles.meta}>
              {continueBook.progressPercentage ?? 0}% · about {minutesLeft(continueBook.wordCount, continueBook.progressPercentage ?? 0)} minutes left
            </Text>
            <Button onPress={() => router.push({ pathname: '/reader/[bookId]', params: { bookId: continueBook.id, title: continueBook.title } })}>
              Continue
            </Button>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>CONTINUE READING</Text>
            <Text style={styles.bookTitle}>Choose your next page</Text>
            <Text style={styles.copy}>Your saved words are waiting for somewhere to return.</Text>
            <Button onPress={() => router.push('/(tabs)/books')}>Open the library</Button>
          </View>
        )}

        {!loading && (
          <>
            <View style={styles.section}>
              <Text style={styles.eyebrow}>REVIEW</Text>
              <Text style={styles.sectionTitle}>
                {due === 0 ? 'Nothing due' : due === 1 ? 'One word is due' : `${due} words are due`}
              </Text>
              <Text style={styles.copy}>
                {due === 0
                  ? hasActivity ? 'Reading a page will give Almo more to ask you.' : 'Reviews appear a day after you keep your first word.'
                  : `${sessionSize} make a session, about ${Math.max(1, Math.ceil(sessionSize * 0.7))} minutes.`}
              </Text>
              {groups.map((group) => (
                <View key={group.label} style={styles.groupRow}>
                  <Text style={styles.groupCount}>{group.count}</Text>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                </View>
              ))}
              {due > 0 && (
                <Button variant="secondary" onPress={() => router.push({ pathname: '/review', params: { language } })}>
                  Start a session
                </Button>
              )}
            </View>

            {savedCount > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.eyebrow}>KEPT WHILE READING</Text>
                    <Text style={styles.sectionTitle}>
                      {keptThisWeek === 0 ? 'Nothing new this week' : keptThisWeek === 1 ? 'One word this week' : `${keptThisWeek} words this week`}
                    </Text>
                  </View>
                  <Pressable onPress={() => router.push('/(tabs)/cards')} hitSlop={8}>
                    <Text style={styles.link}>All {savedCount}</Text>
                  </Pressable>
                </View>
                {recentCards.map((card) => (
                  <Pressable
                    key={card.id}
                    onPress={() => router.push({ pathname: '/item/[itemId]', params: { itemId: card.id, language } })}
                    style={styles.wordRow}>
                    <View style={styles.wordCopy}>
                      <View style={styles.wordLine}>
                        <Text style={styles.word}>{card.entry}</Text>
                        {!!card.partOfSpeech && <Text style={styles.wordMeta}>{card.partOfSpeech.toLowerCase()}</Text>}
                      </View>
                      <Text style={styles.translation} numberOfLines={1}>
                        {card.translations[0]?.translation ?? 'Translation not added yet'}
                      </Text>
                    </View>
                    {card.falseFriend && <Text style={styles.wordMeta}>false friend</Text>}
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Harness rhythm={languageRhythm} crest={crest} language={language} loading={rhythm.isLoading} />
              <RecordStrip stats={stats.data} rhythm={languageRhythm} emptyCopy="" />
            </View>

            <View style={styles.planLine}>
              <Text style={styles.copy}>
                {profile?.premium
                  ? `You’re on ${membershipName(profile.subscription)}.`
                  : `Free covers one language and ${freeSavedItemLimit} saved words.${savedCount ? ` You have kept ${savedCount}, all in ${languageName(language)}.` : ''}`}{' '}
                <Text onPress={() => router.push('/membership')} style={styles.link}>
                  {profile?.premium ? 'Membership' : 'See what Premium adds'}
                </Text>
              </Text>
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

function minutesLeft(wordCount: number, percentage: number) {
  return Math.max(1, Math.round((wordCount * (1 - percentage / 100)) / wordsPerMinute));
}

const useStyles = createThemedStyles((colors, isDark) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 38, gap: 18 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  date: { color: colors.muted, fontSize: 13 },
  loadingCard: { minHeight: 220, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.card },
  card: { gap: 12, padding: 18, borderRadius: 28, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  almo: { width: 92, height: 96, alignSelf: 'center' },
  continueRow: { flexDirection: 'row', gap: 16 },
  cover: { width: 84, height: 122, borderRadius: 10 },
  continueCopy: { flex: 1, justifyContent: 'center', gap: 6 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  bookTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 25, lineHeight: 30, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.line },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  inlineAction: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, paddingHorizontal: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22, lineHeight: 28, fontWeight: '600', marginTop: 2 },
  groupRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 4 },
  groupCount: { width: 32, color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 22 },
  groupLabel: { color: colors.ink, fontSize: 14 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  wordRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10 },
  wordCopy: { flex: 1, gap: 3 },
  wordLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  word: { color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 18, fontWeight: '600' },
  wordMeta: { color: colors.metadata, fontSize: 11 },
  translation: { color: colors.muted, fontSize: 13 },
  planLine: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, paddingHorizontal: 2 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
}));
