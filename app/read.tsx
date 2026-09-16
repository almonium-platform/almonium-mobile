import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { AuthSheet, type AuthReason } from '@/components/auth-sheet';
import { BookCover } from '@/components/book-cover';
import { GuestHeader } from '@/components/guest-header';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { defaultGuestLanguage, readGuestLastRead, type GuestLastRead } from '@/src/guest';
import { languageName } from '@/src/languages';
import { createThemedStyles, darkColors, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';
import type { BookSummary } from '@/src/types';

/**
 * The front door when nobody is signed in: every published edition, filtered by language, with
 * the one book this phone was reading on top. No tab bar; the app is a stack from here.
 */
export default function GuestLibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const books = useQuery({ queryKey: ['public-books'], queryFn: api.publicBooks, staleTime: 10 * 60_000 });
  const [language, setLanguage] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<GuestLastRead | null>(null);
  const [auth, setAuth] = useState<AuthReason | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void readGuestLastRead().then((value) => { if (active) setLastRead(value); });
    return () => { active = false; };
  }, []));

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const book of books.data ?? []) map.set(book.language, (map.get(book.language) ?? 0) + 1);
    return map;
  }, [books.data]);
  const languages = useMemo(() => [...counts.keys()].sort((a, b) => languageName(a).localeCompare(languageName(b))), [counts]);
  const selected = language && counts.has(language) ? language : defaultGuestLanguage(counts, getLocales().map((locale) => locale.languageTag));
  const rows = useMemo(
    () => (books.data ?? []).filter((book) => book.language === selected && book.editionSlug !== lastRead?.slug),
    [books.data, lastRead?.slug, selected],
  );

  function open(book: BookSummary) {
    router.push({ pathname: '/book/[bookId]', params: { bookId: String(book.id), language: book.language, ...(book.editionSlug ? { slug: book.editionSlug } : {}) } });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <GuestHeader onSignIn={() => setAuth({ kind: 'signin' })} onReadFree={() => setAuth({ kind: 'start' })} />
      <FlatList
        data={rows}
        keyExtractor={(book) => book.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.top}>
            {lastRead ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/reader/[bookId]', params: { bookId: lastRead.bookId, language: lastRead.language, title: lastRead.title, slug: lastRead.slug } })}
                  style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}>
                  <View style={styles.continueCopy}>
                    <Text style={styles.continueEyebrow}>{t('CONTINUE')}</Text>
                    <Text style={styles.continueTitle} numberOfLines={2}>{lastRead.title}</Text>
                    <Text style={styles.continueMeta} numberOfLines={1}>
                      {lastRead.chapterTitle ? `${lastRead.chapterTitle} · ` : ''}{t('{percentage}% of the book', { percentage: String(lastRead.percentage) })}
                    </Text>
                    <View style={styles.continueTrack}><View style={[styles.continueBar, { width: `${lastRead.percentage}%` }]} /></View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={darkColors.metadata} />
                </Pressable>
                <Text style={styles.libraryTitle}>{t('Library')}</Text>
              </>
            ) : (
              <View style={styles.promise}>
                <Text style={styles.title}>{t('Read books in the language you’re learning')}</Text>
                <Text style={styles.subtitle}>{t('Tap any word for its meaning. Every book here is free to read.')}</Text>
              </View>
            )}
            {languages.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {languages.map((code) => {
                  const active = code === selected;
                  return (
                    <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setLanguage(code)}
                      style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{languageName(code)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <BookCover title={item.title} author={item.author} workSlug={item.workSlug} coverUrl={item.coverUrl} style={styles.cover} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.rowAuthor} numberOfLines={1}>{item.author}</Text>
              <View style={styles.rowMeta}>
                <View style={styles.level}><Text style={styles.levelText}>{item.cefrLevel}</Text></View>
                {item.hasParallelTranslation && <Text style={styles.rowNote}>{t('Parallel text')}</Text>}
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          books.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : books.isError ? (
            <View style={styles.empty}>
              <Text style={styles.status}>{books.error instanceof Error ? books.error.message : t('The library would not open.')}</Text>
              <Button onPress={() => books.refetch()}>{t('Try again')}</Button>
            </View>
          ) : (
            <Text style={styles.status}>{t('No published books yet.')}</Text>
          )
        }
      />
      <AuthSheet reason={auth} onClose={() => setAuth(null)} onSignedIn={() => { setAuth(null); router.replace('/'); }} />
    </View>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  top: { gap: 18, paddingBottom: 6 },
  promise: { gap: 8, paddingHorizontal: 4, paddingTop: 4 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: serifLineHeight(30) },
  subtitle: { color: colors.muted, fontSize: 14.5, lineHeight: 22 },
  libraryTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22, lineHeight: serifLineHeight(22), paddingHorizontal: 4 },
  chips: { gap: 8, paddingHorizontal: 4 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 13 },
  chipTextActive: { color: colors.canvas, fontFamily: fonts.sansSemibold },
  continueCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: isDark ? colors.surface : colors.ink },
  continueCopy: { flex: 1, gap: 5 },
  continueEyebrow: { color: darkColors.primary, fontSize: 10.5, fontWeight: '600', letterSpacing: 1.4 },
  continueTitle: { color: darkColors.ink, fontFamily: fonts.serif, fontSize: 19, lineHeight: serifLineHeight(19) },
  continueMeta: { color: darkColors.muted, fontSize: 13 },
  continueTrack: { height: 3, borderRadius: 2, marginTop: 6, backgroundColor: darkColors.border, overflow: 'hidden' },
  continueBar: { height: 3, borderRadius: 2, backgroundColor: darkColors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  pressed: { opacity: 0.8 },
  cover: { width: 64, height: 92, borderRadius: 8, backgroundColor: colors.accentSoft },
  rowCopy: { flex: 1, gap: 5 },
  rowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17, lineHeight: serifLineHeight(17) },
  rowAuthor: { color: colors.muted, fontSize: 13 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  level: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.chatMine },
  levelText: { color: colors.white, fontFamily: fonts.mono, fontSize: 10.5 },
  rowNote: { color: colors.muted, fontSize: 12 },
  loading: { paddingVertical: 40 },
  empty: { gap: 14, paddingVertical: 24 },
  status: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
}));
