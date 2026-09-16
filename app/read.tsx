import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, SectionList, Text, View } from 'react-native';

import { BookCard } from '@/components/book-card';
import { GuestHeader } from '@/components/guest-header';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { languageName } from '@/src/languages';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';
import type { BookSummary } from '@/src/types';

/**
 * The library without an account: every published edition, by language. Everything reads;
 * keeping a place across devices and saving words are what the account adds.
 */
export default function GuestLibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const books = useQuery({ queryKey: ['public-books'], queryFn: api.publicBooks, staleTime: 10 * 60_000 });
  const sections = useMemo(() => {
    const byLanguage = new Map<string, BookSummary[]>();
    for (const book of books.data ?? []) {
      byLanguage.set(book.language, [...(byLanguage.get(book.language) ?? []), book]);
    }
    return [...byLanguage.entries()]
      .sort(([a], [b]) => languageName(a).localeCompare(languageName(b)))
      .map(([language, data]) => ({ title: languageName(language), language, data }));
  }, [books.data]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <GuestHeader returnTo="/read" />
      <SectionList
        sections={sections}
        keyExtractor={(book) => book.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.title}>{t('Read')}</Text>
            <Text style={styles.subtitle}>{t('Every book here opens without an account. Your place stays on this phone; a free account keeps it everywhere and lets you save words.')}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item, section }) => <BookCard book={item} language={section.language} />}
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
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  intro: { gap: 8, paddingBottom: 8 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 32, lineHeight: serifLineHeight(32) },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  section: { color: colors.metadata, fontSize: 11, fontWeight: '600', letterSpacing: 1.3, paddingTop: 12, paddingBottom: 4 },
  loading: { paddingVertical: 40 },
  empty: { gap: 14, paddingVertical: 24 },
  status: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
}));
