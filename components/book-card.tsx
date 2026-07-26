import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shadows } from '@/src/theme';
import type { BookSummary } from '@/src/types';

export function BookCard({
  book,
  language,
  onLongPress,
}: {
  book: BookSummary;
  language: string;
  onLongPress?(): void;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/book/[bookId]',
          params: { bookId: String(book.id), language },
        })
      }
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.book, pressed && styles.pressed]}>
      <Image source={book.coverImageUrl} style={styles.cover} contentFit="cover" transition={180} />
      <View style={styles.bookCopy}>
        <View style={styles.meta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {book.levelFrom}–{book.levelTo}
            </Text>
          </View>
          {book.hasParallelTranslation && (
            <View style={styles.parallel}>
              <Ionicons name="git-compare-outline" size={12} color={colors.primary} />
              <Text style={styles.parallelText}>Parallel</Text>
            </View>
          )}
        </View>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {book.author}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.rating}>★ {book.rating.toFixed(1)}</Text>
          <Text style={styles.year}>{book.publicationYear}</Text>
        </View>
        {book.progressPercentage !== null && book.progressPercentage > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progress,
                { width: `${Math.max(0, Math.min(100, book.progressPercentage))}%` },
              ]}
            />
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.8 },
  cover: { width: 78, height: 112, borderRadius: 10, backgroundColor: colors.mint },
  bookCopy: { flex: 1, gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    borderRadius: 8,
    backgroundColor: colors.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  parallel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  parallelText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  bookTitle: { color: colors.ink, fontSize: 18, lineHeight: 22, fontWeight: '800' },
  author: { color: colors.muted, fontSize: 14 },
  footer: { flexDirection: 'row', gap: 10 },
  rating: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  year: { color: colors.muted, fontSize: 12 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.gold },
});
