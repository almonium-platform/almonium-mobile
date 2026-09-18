import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useNotice } from '@/src/notice-context';
import { downloadedBooks } from '@/src/offline-books';
import { editionLabel, libraryEntries, shelfRows, shortTitle, type LibraryEntry, type ShelfRow } from '@/src/shelf';
import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';

const shelfLanguageKey = 'almonium:shelf-language';

/**
 * The Read tab (design 4a): the shelf opens on the book. What you have started, each book once,
 * in one white card of hairline rows; under it the library's entrance, a rail of covers and the
 * count that opens the library screen. Search and filters live there, not here.
 */
export default function BooksScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const showNotice = useNotice();
  const online = useSyncExternalStore(
    useCallback((listen: () => void) => onlineManager.subscribe(listen), []),
    () => onlineManager.isOnline(),
    () => true,
  );
  const activeLanguages = useMemo(
    () => profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) || [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] || '');

  useEffect(() => {
    void AsyncStorage.getItem(shelfLanguageKey).then((stored) => {
      if (stored && activeLanguages.includes(stored)) setLanguage(stored);
    });
  }, [activeLanguages]);
  useEffect(() => {
    if ((!language || !activeLanguages.includes(language)) && activeLanguages[0]) setLanguage(activeLanguages[0]);
  }, [activeLanguages, language]);

  function chooseLanguage(nextLanguage: string) {
    setLanguage(nextLanguage);
    void AsyncStorage.setItem(shelfLanguageKey, nextLanguage);
  }

  const query = useQuery({
    queryKey: ['bookshelf', firebaseUser?.uid, language],
    queryFn: () => api.bookshelf(language),
    enabled: Boolean(language && firebaseUser),
  });
  const downloads = useQuery({ queryKey: ['offline-books'], queryFn: downloadedBooks });
  // Without a connection the shelf is what was cached plus what was downloaded; nothing else changes.
  const offline = !online || (query.isError && Boolean(query.data));

  const rows = useMemo(
    () => shelfRows(query.data?.continueReading ?? [], downloads.data ?? [], language),
    [downloads.data, language, query.data?.continueReading],
  );
  const library = useMemo(() => {
    if (!query.data) return [] as LibraryEntry[];
    const shelfIds = new Set(rows.map((row) => row.book.id));
    return libraryEntries([...query.data.available, ...query.data.favorites, ...query.data.continueReading], shelfIds);
  }, [query.data, rows]);
  const rail = useMemo(() => library.filter((entry) => !entry.onShelf).slice(0, 12), [library]);
  const fluent = profile?.fluentLangs[0] ?? '';

  async function resetProgress(row: ShelfRow) {
    if (!row.progress) return;
    Alert.alert(t('Reset reading progress?'), t('{title} will return to the beginning.', { title: row.book.title }), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Reset'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProgress(row.book.id);
            await query.refetch();
          } catch (error) {
            showNotice({ title: t('Could not reset progress'), message: error instanceof Error ? error.message : t('Try again.'), tone: 'error' });
          }
        },
      },
    ]);
  }

  function openRow(row: ShelfRow) {
    if (offline && !row.offline) return;
    const { book } = row;
    router.push({ pathname: '/reader/[bookId]', params: { bookId: book.id, language, title: book.title, ...(book.editionSlug ? { slug: book.editionSlug } : {}) } });
  }

  function openEntry(entry: LibraryEntry) {
    const { book } = entry;
    router.push({ pathname: '/book/[bookId]', params: { bookId: book.id, language, ...(book.editionSlug ? { slug: book.editionSlug } : {}) } });
  }

  if (!language) {
    return (
      <SafeAreaView style={styles.empty}>
        <Ionicons name="language" size={42} color={colors.primary} />
        <Text style={styles.emptyTitle}>{t('Choose a reading language')}</Text>
        <Text style={styles.emptyText}>{t('Activate a target language in Settings to build this shelf.')}</Text>
      </SafeAreaView>
    );
  }

  if (query.isLoading && !downloads.data?.length) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (query.isError && !query.data && !downloads.data?.length) {
    return (
      <SafeAreaView style={styles.empty}>
        <Ionicons name="cloud-offline-outline" size={42} color={colors.primary} />
        <Text style={styles.emptyTitle}>{t('Your shelf is out of reach')}</Text>
        <Text style={styles.emptyText}>
          {query.error instanceof Error ? query.error.message : t('Check your connection and try again.')}
        </Text>
        <Button onPress={() => query.refetch()}>{t('Try again')}</Button>
      </SafeAreaView>
    );
  }

  const count = rows.length;
  return (
    <View style={styles.screen}>
      <AppHeader language={language} onLanguageChange={activeLanguages.length > 1 ? chooseLanguage : undefined} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('YOUR SHELF')}</Text>
          <Text style={styles.title}>
            {count
              ? t('{count, plural, =1 {One book open} =2 {Two books open} =3 {Three books open} other {# books open}}', { count })
              : t('Nothing open yet')}
          </Text>
          {offline && <Text style={styles.subhead}>{t('No connection. Downloaded books open as usual.')}</Text>}
        </View>

        {count ? (
          <View style={styles.card}>
            {rows.map((row, index) => {
              const dim = offline && !row.offline;
              const place = row.book.currentChapter && row.book.chapterCount ? { chapter: row.book.currentChapter, total: row.book.chapterCount } : null;
              const target = row.book.hasParallelTranslation && fluent ? `${row.book.language} → ${fluent}` : row.book.language;
              const line = [
                target,
                t('{level} edition', { level: row.book.cefrLevel }),
                dim ? t('needs connection') : row.offline ? t('offline') : row.book.hasParallelTranslation ? null : t('no translation'),
              ].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={row.book.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: dim }}
                  onPress={() => openRow(row)}
                  onLongPress={() => resetProgress(row)}
                  style={({ pressed }) => [styles.row, index > 0 && styles.rowRule, dim && styles.rowDim, pressed && !dim && styles.pressed]}>
                  <BookCover title={row.book.title} author={row.book.author} workSlug={row.book.workSlug} coverUrl={row.book.coverUrl} width={52} height={76} rule />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{shortTitle(row.book.title)}</Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>{line}</Text>
                    <View style={styles.track}><View style={[styles.bar, { width: `${row.progress}%` }]} /></View>
                    <Text style={styles.rowPlace} numberOfLines={1}>
                      {place
                        ? t('{percentage}% · chapter {chapter} of {total}', { percentage: row.progress, chapter: place.chapter, total: place.total })
                        : t('{percentage}%', { percentage: row.progress })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.emptyRow}>
              <Text style={styles.emptyRowTitle}>{t('Choose your next page')}</Text>
              <Text style={styles.emptyRowText}>{t('A book you open sits here, with your place kept.')}</Text>
            </View>
          </View>
        )}

        <View style={styles.library}>
          <View style={styles.libraryHead}>
            <Text style={styles.eyebrow}>{t('LIBRARY')}</Text>
            {offline || !library.length ? (
              <Text style={styles.libraryNote}>{offline ? t('Back when you reconnect') : ''}</Text>
            ) : (
              <Pressable
                accessibilityRole="link"
                hitSlop={10}
                onPress={() => router.push({ pathname: '/library', params: { language } })}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.libraryLink}>{t('All {count, plural, one {# book} other {# books}}', { count: library.length })}</Text>
              </Pressable>
            )}
          </View>
          {!offline && rail.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {rail.map((entry) => (
                <Pressable
                  key={entry.workSlug}
                  accessibilityRole="button"
                  accessibilityLabel={t('{title} by {author}', { title: entry.title, author: entry.author })}
                  onPress={() => openEntry(entry)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <BookCover
                    title={entry.title}
                    author={entry.author}
                    workSlug={entry.workSlug}
                    coverUrl={entry.book.coverUrl}
                    width={96}
                    height={142}
                    foot={entry.editions.length > 1 ? entry.editions.map((edition) => editionLabel(t, edition)).join(' · ') : undefined}
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  content: { paddingTop: 18, paddingBottom: 32, gap: 16 },
  heading: { gap: 5, paddingHorizontal: 16 },
  eyebrow: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 28, lineHeight: serifLineHeight(28) },
  subhead: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  card: { marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.line },
  rowDim: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17, lineHeight: serifLineHeight(17) },
  rowMeta: { color: colors.muted, fontFamily: fonts.mono, fontSize: 11 },
  track: { height: 4, marginTop: 2, borderRadius: 999, backgroundColor: colors.track, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: colors.primary },
  rowPlace: { color: colors.muted, fontSize: 11.5 },
  emptyRow: { gap: 6, paddingVertical: 16 },
  emptyRowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17, lineHeight: serifLineHeight(17) },
  emptyRowText: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  library: { gap: 10 },
  libraryHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16 },
  libraryLink: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  libraryNote: { color: colors.muted, fontSize: 12.5 },
  rail: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  empty: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  emptyTitle: { color: colors.ink, fontWeight: '600', fontSize: 20 },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
}));
