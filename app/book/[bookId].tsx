import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { colors } from '@/src/theme';

export default function BookDetailsScreen() {
  const params = useLocalSearchParams<{ bookId: string; language?: string }>();
  const bookId = Number(params.bookId);
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const language =
    params.language ||
    profile?.learners.find((learner) => learner.active)?.language ||
    '';

  const query = useQuery({
    queryKey: ['book', firebaseUser?.uid, bookId, language],
    queryFn: () => api.book(bookId, language),
    enabled: Number.isInteger(bookId) && bookId > 0 && Boolean(language),
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) return;
      await api.setFavorite(query.data.id, language, !query.data.favorite);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['book', firebaseUser?.uid, bookId] }),
        queryClient.invalidateQueries({ queryKey: ['bookshelf', firebaseUser?.uid] }),
      ]);
    },
  });

  if (!Number.isInteger(bookId) || bookId <= 0 || !language) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.errorTitle}>This book link is invalid.</Text>
        <Button onPress={() => router.back()}>Back to library</Button>
      </Screen>
    );
  }

  if (query.isLoading) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.loading}>Opening book details…</Text>
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen contentStyle={styles.center}>
        <Ionicons name="book-outline" size={42} color={colors.primary} />
        <Text style={styles.errorTitle}>This book would not open.</Text>
        <Text style={styles.errorText}>
          {query.error instanceof Error ? query.error.message : 'Please try again.'}
        </Text>
        <Button onPress={() => query.refetch()}>Try again</Button>
      </Screen>
    );
  }

  const book = query.data;
  const pages = Math.max(1, Math.ceil(book.wordCount / 250));

  return (
    <Screen>
      <Stack.Screen options={{ title: book.title }} />
      <View style={styles.hero}>
        <Image source={book.coverImageUrl} style={styles.cover} contentFit="cover" transition={180} />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>★ {book.rating.toFixed(1)}</Text>
            <Text style={styles.meta}>{book.publicationYear}</Text>
          </View>
          <Pressable
            disabled={favoriteMutation.isPending}
            onPress={() => favoriteMutation.mutate()}
            style={styles.favorite}>
            <Ionicons
              name={book.favorite ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.favoriteText}>
              {book.favorite ? 'Saved to favorites' : 'Save to favorites'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Button
        onPress={() =>
          router.push({
            pathname: '/reader/[bookId]',
            params: { bookId: String(book.id), language, title: book.title },
          })
        }>
        {book.progressPercentage ? `Continue at ${book.progressPercentage}%` : 'Start reading'}
      </Button>

      <Card>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {book.levelFrom}–{book.levelTo}
            </Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pages}</Text>
            <Text style={styles.statLabel}>Est. pages</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{languageName(book.language)}</Text>
            <Text style={styles.statLabel}>Language</Text>
          </View>
        </View>
      </Card>

      {book.languageVariants.length > 1 && (
        <Card>
          <Text style={styles.sectionTitle}>Available versions</Text>
          <View style={styles.variants}>
            {book.languageVariants.map((variant) => (
              <Pressable
                key={`${variant.id}-${variant.language}`}
                onPress={() =>
                  router.replace({
                    pathname: '/book/[bookId]',
                    params: { bookId: String(variant.id), language },
                  })
                }
                style={[
                  styles.variant,
                  variant.id === book.id && styles.variantActive,
                ]}>
                <Text
                  style={[
                    styles.variantText,
                    variant.id === book.id && styles.variantTextActive,
                  ]}>
                  {languageName(variant.language)}
                </Text>
              </Pressable>
            ))}
          </View>
          {book.hasParallelTranslation && (
            <View style={styles.parallelNote}>
              <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
              <Text style={styles.parallelText}>Parallel reading is available for this title.</Text>
            </View>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.sectionTitle}>About this book</Text>
        {book.translator && (
          <Text style={styles.translator}>Translated by {book.translator}</Text>
        )}
        <Text style={styles.description}>{book.description}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: colors.muted, fontSize: 16 },
  errorTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  errorText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  hero: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  cover: { width: 126, height: 184, borderRadius: 15, backgroundColor: colors.mint },
  heroCopy: { flex: 1, gap: 9, paddingTop: 4 },
  title: { color: colors.ink, fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.4 },
  author: { color: colors.muted, fontSize: 16 },
  ratingRow: { flexDirection: 'row', gap: 10 },
  rating: { color: colors.gold, fontWeight: '900' },
  meta: { color: colors.muted, fontWeight: '600' },
  favorite: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 5 },
  favoriteText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, gap: 3, alignItems: 'center' },
  divider: { width: 1, height: 32, backgroundColor: colors.line },
  statValue: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: colors.muted, fontSize: 11 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.canvas },
  variantActive: { backgroundColor: colors.primary },
  variantText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  variantTextActive: { color: colors.white },
  parallelNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parallelText: { flex: 1, color: colors.muted, fontSize: 13 },
  translator: { color: colors.primary, fontSize: 14, fontStyle: 'italic' },
  description: { color: colors.ink, fontSize: 16, lineHeight: 25 },
});
