import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { downloadedBooks } from '@/src/offline-books';
import { filterLibrary, libraryEntries, presentLevels, shelfRows, thousands, type LengthFilter, type LibraryEntry } from '@/src/shelf';
import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';
import type { CefrLevel } from '@/src/types';

const lengths: { value: LengthFilter; label: string }[] = [
  { value: 'SHORT', label: 'Short' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LONG', label: 'Long' },
];

/**
 * The library (design 4a): every work in this language, one row each, pushed from the shelf.
 * Search and the level and length chips live here only; the level group shows the levels that
 * have a book. Sorted by level then title, no sort control.
 */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const params = useLocalSearchParams<{ language?: string }>();
  const language = params.language || profile?.learners.find((learner) => learner.active)?.language || '';
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [length, setLength] = useState<LengthFilter | null>(null);

  const query = useQuery({
    queryKey: ['bookshelf', firebaseUser?.uid, language],
    queryFn: () => api.bookshelf(language),
    enabled: Boolean(language && firebaseUser),
  });
  const downloads = useQuery({ queryKey: ['offline-books'], queryFn: downloadedBooks });
  const entries = useMemo(() => {
    if (!query.data) return [] as LibraryEntry[];
    const shelfIds = new Set(shelfRows(query.data.continueReading, downloads.data ?? [], language).map((row) => row.book.id));
    return libraryEntries([...query.data.available, ...query.data.favorites, ...query.data.continueReading], shelfIds);
  }, [downloads.data, language, query.data]);
  const levels = useMemo(() => presentLevels(entries), [entries]);
  const rows = useMemo(() => filterLibrary(entries, search, level, length), [entries, length, level, search]);

  function open(entry: LibraryEntry) {
    const { book } = entry;
    router.push({ pathname: '/book/[bookId]', params: { bookId: book.id, language, ...(book.editionSlug ? { slug: book.editionSlug } : {}) } });
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '', headerBackTitle: t('Shelf'), headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('LIBRARY · {language}', { language: languageName(language).toUpperCase() })}</Text>
          <Text style={styles.title}>{t('{count, plural, one {# book} other {# books}}', { count: entries.length })}</Text>
        </View>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('Title or author')}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('Search the library')}
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
          <Chip label={t('Any level')} selected={level === null} onPress={() => setLevel(null)} />
          {levels.map((value) => (
            <Chip key={value} label={value} selected={level === value} onPress={() => setLevel(level === value ? null : value)} />
          ))}
          <View style={styles.chipDivider} />
          {lengths.map((option) => (
            <Chip key={option.value} label={t(option.label)} selected={length === option.value} onPress={() => setLength(length === option.value ? null : option.value)} />
          ))}
        </ScrollView>
        {query.isLoading && !query.data ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : query.isError && !query.data ? (
          <View style={styles.empty}>
            <Text style={styles.status}>{query.error instanceof Error ? query.error.message : t('The library would not open.')}</Text>
            <Button onPress={() => query.refetch()}>{t('Try again')}</Button>
          </View>
        ) : rows.length ? (
          <View style={styles.card}>
            {rows.map((item, index) => (
              <Pressable
                key={item.workSlug}
                accessibilityRole="button"
                onPress={() => open(item)}
                style={({ pressed }) => [styles.row, index > 0 && styles.rowRule, pressed && styles.pressed]}>
                <BookCover title={item.title} author={item.author} workSlug={item.workSlug} coverUrl={item.book.coverUrl} width={44} height={64} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.rowAuthor} numberOfLines={1}>{item.author}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[...item.levels, t('{count} words', { count: thousands(item.wordCount) }), item.onShelf ? t('on your shelf') : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.status}>{entries.length ? t('No matching books') : t('No books here yet')}</Text>
            {!!entries.length && <Text style={styles.statusNote}>{t('Try a title or author with different words.')}</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingTop: 8, paddingBottom: 40, gap: 14 },
  heading: { gap: 5, paddingHorizontal: 16 },
  eyebrow: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 28, lineHeight: serifLineHeight(28) },
  search: { height: 46, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 0 },
  chipScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', alignItems: 'stretch', gap: 7, paddingHorizontal: 16 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  chipTextActive: { color: colors.primary },
  chipDivider: { width: 1, marginVertical: 4, marginHorizontal: 4, backgroundColor: colors.border },
  pressed: { opacity: 0.7 },
  card: { marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 4, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  row: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.line },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 16, lineHeight: serifLineHeight(16) },
  rowAuthor: { color: colors.muted, fontSize: 13 },
  rowMeta: { color: colors.muted, fontFamily: fonts.mono, fontSize: 11 },
  loading: { paddingVertical: 40 },
  empty: { gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  status: { color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  statusNote: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
}));
