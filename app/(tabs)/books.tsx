import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { colors, shadows } from '@/src/theme';
import type { Book } from '@/src/types';

function BookCard({ book, language }: { book: Book; language: string }) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/reader/[bookId]',
          params: { bookId: String(book.id), language, title: book.title },
        })
      }
      style={({ pressed }) => [styles.book, pressed && { opacity: 0.8 }]}>
      <Image source={book.coverImageUrl} style={styles.cover} contentFit="cover" transition={180} />
      <View style={styles.bookCopy}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {book.levelFrom}–{book.levelTo}
          </Text>
        </View>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {book.author}
        </Text>
        {book.progressPercentage !== null && (
          <View style={styles.progressTrack}>
            <View style={[styles.progress, { width: `${book.progressPercentage}%` }]} />
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

export default function BooksScreen() {
  const { profile } = useAuth();
  const language = profile?.learners.find((learner) => learner.active)?.language;
  const query = useQuery({
    queryKey: ['bookshelf', language],
    queryFn: () => api.bookshelf(language!),
    enabled: Boolean(language),
  });

  const books = query.data
    ? [...query.data.continueReading, ...query.data.favorites, ...query.data.available].filter(
        (book, index, all) => all.findIndex((candidate) => candidate.id === book.id) === index,
      )
    : [];

  if (!language) {
    return (
      <SafeAreaView style={styles.empty}>
        <Ionicons name="language" size={42} color={colors.primary} />
        <Text style={styles.emptyTitle}>Choose a reading language</Text>
        <Text style={styles.emptyText}>
          Add a target language on the web app for now; it will appear here automatically.
        </Text>
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

  return (
    <FlatList
      data={books}
      keyExtractor={(book) => String(book.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{language.toUpperCase()} SHELF</Text>
          <Text style={styles.heroTitle}>
            {query.data?.continueReading.length ? 'Keep the story moving.' : 'Pick your next page.'}
          </Text>
          <Text style={styles.heroText}>
            {books.length} {books.length === 1 ? 'book' : 'books'} matched to your learning profile.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyInline}>
          <Text style={styles.emptyTitle}>No books here yet</Text>
          <Text style={styles.emptyText}>Try another active language in Settings.</Text>
        </View>
      }
      renderItem={({ item }) => <BookCard book={item} language={language} />}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  list: { padding: 20, gap: 14, backgroundColor: colors.canvas, flexGrow: 1 },
  hero: { paddingVertical: 12, gap: 8 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 },
  heroText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    minHeight: 138,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  cover: { width: 78, height: 112, borderRadius: 10, backgroundColor: colors.mint },
  bookCopy: { flex: 1, gap: 5 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: colors.mint, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  bookTitle: { color: colors.ink, fontSize: 18, lineHeight: 22, fontWeight: '800' },
  author: { color: colors.muted, fontSize: 14 },
  progressTrack: { height: 5, borderRadius: 3, marginTop: 5, backgroundColor: colors.line, overflow: 'hidden' },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.gold },
  empty: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  emptyInline: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 20 },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
