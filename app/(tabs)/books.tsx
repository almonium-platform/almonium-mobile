import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { BookCard } from '@/components/book-card';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { downloadedBooks } from '@/src/offline-books';
import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';
import type { BookSummary, CefrLevel } from '@/src/types';

const shelfLanguageKey = 'almonium:shelf-language';
const levelFilters: ('ALL' | CefrLevel)[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
type LengthFilter = 'ALL' | 'SHORT' | 'MEDIUM' | 'LONG';

export default function BooksScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const showNotice = useNotice();
  const activeLanguages = useMemo(
    () =>
      profile?.learners
        .filter((learner) => learner.active)
        .map((learner) => learner.language) || [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] || '');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | CefrLevel>('ALL');
  const [lengthFilter, setLengthFilter] = useState<LengthFilter>('ALL');

  useEffect(() => {
    void AsyncStorage.getItem(shelfLanguageKey).then((stored) => {
      if (stored && activeLanguages.includes(stored)) setLanguage(stored);
    });
  }, [activeLanguages]);

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

  const sections = useMemo(() => {
    if (!query.data && !downloads.data?.length) return [];
    const needle = search.trim().toLocaleLowerCase();
    const filter = (books: BookSummary[]) =>
      books.filter((book) => {
        const matchesSearch = !needle ||
          book.title.toLocaleLowerCase().includes(needle) ||
          book.author.toLocaleLowerCase().includes(needle);
        const matchesLevel = levelFilter === 'ALL' || book.cefrLevel === levelFilter;
        const matchesLength = lengthFilter === 'ALL' ||
          (lengthFilter === 'SHORT' && book.wordCount < 15_000) ||
          (lengthFilter === 'MEDIUM' && book.wordCount >= 15_000 && book.wordCount < 40_000) ||
          (lengthFilter === 'LONG' && book.wordCount >= 40_000);
        return matchesSearch && matchesLevel && matchesLength;
      });
    return [
      { title: 'Downloads', data: filter((downloads.data ?? []).filter((book) => book.language === language)) },
      { title: 'Continue reading', data: filter(query.data?.continueReading ?? []) },
      { title: 'Favorites', data: filter(query.data?.favorites ?? []) },
      { title: 'Available', data: filter(query.data?.available ?? []) },
    ].filter((section) => section.data.length);
  }, [downloads.data, language, lengthFilter, levelFilter, query.data, search]);

  async function resetProgress(book: BookSummary) {
    if (!book.progressPercentage) return;
    Alert.alert('Reset reading progress?', `${book.title} will return to the beginning.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProgress(book.id);
            await query.refetch();
          } catch (error) {
            showNotice({ title: 'Could not reset progress', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
          }
        },
      },
    ]);
  }

  if (!language) {
    return (
      <SafeAreaView style={styles.empty}>
        <Ionicons name="language" size={42} color={colors.primary} />
        <Text style={styles.emptyTitle}>Choose a reading language</Text>
        <Text style={styles.emptyText}>Activate a target language in Settings to build this shelf.</Text>
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
        <Text style={styles.emptyTitle}>Your shelf is out of reach</Text>
        <Text style={styles.emptyText}>
          {query.error instanceof Error ? query.error.message : 'Check your connection and try again.'}
        </Text>
        <Button onPress={() => query.refetch()}>Try again</Button>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        language={language}
        onLanguageChange={activeLanguages.length > 1 ? chooseLanguage : undefined}
      />
      <SectionList
      sections={sections}
      keyExtractor={(book, index) => `${book.id}-${index}`}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR SHELF</Text>
          <Text style={styles.heroTitle}>
            {query.data?.continueReading.length
              ? `${query.data.continueReading.length} ${query.data.continueReading.length === 1 ? 'book' : 'books'} open`
              : 'Choose your next page'}
          </Text>
          <Text style={styles.subhead}>Everything you have started, and where you stopped.</Text>
          <View style={styles.search}>
            <Ionicons name="search" size={19} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${languageName(language)} books`}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>LEVEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {levelFilters.map((value) => (
                <FilterChip key={value} label={value === 'ALL' ? 'Any level' : value} selected={levelFilter === value} onPress={() => setLevelFilter(value)} />
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>LENGTH</Text>
            <View style={styles.filters}>
              {(['ALL', 'SHORT', 'MEDIUM', 'LONG'] as const).map((value) => (
                <FilterChip key={value} label={value === 'ALL' ? 'Any' : value[0] + value.slice(1).toLowerCase()} selected={lengthFilter === value} onPress={() => setLengthFilter(value)} />
              ))}
            </View>
          </View>
          <Text style={styles.hint}>Tip: hold a book to reset its progress.</Text>
          {query.isError && query.data && (
            <Text style={styles.offline}>Showing your saved shelf. Reconnect to refresh it.</Text>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item, section }) => (
        <BookCard book={item} language={language} offline={section.title === 'Downloads'} onLongPress={() => resetProgress(item)} />
      )}
      SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      ListEmptyComponent={
        <View style={styles.emptyInline}>
          <Text style={styles.emptyTitle}>{search ? 'No matching books' : 'No books here yet'}</Text>
          <Text style={styles.emptyText}>
            {search ? 'Try a title or author with different words.' : 'Pull down to refresh this shelf.'}
          </Text>
        </View>
      }
      />
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.filter, selected && styles.filterActive]}>
      <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  list: { padding: 16, paddingBottom: 32, backgroundColor: colors.canvas, flexGrow: 1 },
  header: { gap: 12, paddingBottom: 20 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  heroTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: serifLineHeight(30), fontWeight: '600' },
  subhead: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  search: { minHeight: 50, borderRadius: 999, paddingHorizontal: 16, gap: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, ...shadows.field },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  filterGroup: { gap: 6 },
  filterLabel: { color: colors.metadata, fontSize: 9.5, fontWeight: '600', letterSpacing: 1.2 },
  filters: { flexDirection: 'row', gap: 7, paddingRight: 3 },
  filter: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 19, paddingHorizontal: 12, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  filterText: { color: colors.muted, fontSize: 11.5, fontWeight: '600' },
  filterTextActive: { color: colors.primary },
  hint: { color: colors.muted, fontSize: 11 },
  offline: { color: colors.primaryDark, fontSize: 12, fontWeight: '600', backgroundColor: colors.accentSoft, borderRadius: 10, padding: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  sectionCount: { color: colors.primary, fontSize: 12, fontWeight: '600', backgroundColor: colors.accentSoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  itemGap: { height: 12 },
  sectionGap: { height: 24 },
  empty: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  emptyInline: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { color: colors.ink, fontWeight: '600', fontSize: 20 },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
}));
