import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCard } from '@/components/book-card';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { colors, fonts, shadows } from '@/src/theme';
import type { BookSummary } from '@/src/types';

const shelfLanguageKey = 'almonium:shelf-language';

export default function BooksScreen() {
  const { firebaseUser, profile } = useAuth();
  const activeLanguages = useMemo(
    () =>
      profile?.learners
        .filter((learner) => learner.active)
        .map((learner) => learner.language) || [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] || '');
  const [search, setSearch] = useState('');

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

  const sections = useMemo(() => {
    if (!query.data) return [];
    const needle = search.trim().toLocaleLowerCase();
    const filter = (books: BookSummary[]) =>
      books.filter(
        (book) =>
          !needle ||
          book.title.toLocaleLowerCase().includes(needle) ||
          book.author.toLocaleLowerCase().includes(needle),
      );
    return [
      { title: 'Continue reading', data: filter(query.data.continueReading) },
      { title: 'Favorites', data: filter(query.data.favorites) },
      { title: 'Available', data: filter(query.data.available) },
    ].filter((section) => section.data.length);
  }, [query.data, search]);

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
            Alert.alert('Could not reset progress', error instanceof Error ? error.message : 'Try again.');
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

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (query.isError && !query.data) {
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
          <Text style={styles.eyebrow}>YOUR LIBRARY</Text>
          <Text style={styles.heroTitle}>Keep the story moving.</Text>
          {activeLanguages.length > 1 && (
            <View style={styles.languageChips}>
              {activeLanguages.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => chooseLanguage(code)}
                  style={[styles.languageChip, language === code && styles.languageChipActive]}>
                  <Text
                    style={[
                      styles.languageChipText,
                      language === code && styles.languageChipTextActive,
                    ]}>
                    {languageName(code)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
      renderItem={({ item }) => (
        <BookCard book={item} language={language} onLongPress={() => resetProgress(item)} />
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
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  list: { padding: 20, backgroundColor: colors.canvas, flexGrow: 1 },
  header: { gap: 12, paddingBottom: 20 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  heroTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, fontWeight: '600' },
  languageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.accentSoft },
  languageChipActive: { backgroundColor: colors.primary },
  languageChipText: { color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  languageChipTextActive: { color: colors.white },
  search: { minHeight: 50, borderRadius: 999, paddingHorizontal: 16, gap: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, ...shadows.field },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
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
});
