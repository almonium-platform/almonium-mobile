import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { createThemedStyles, fonts, shadows, useTheme } from '@/src/theme';
import type { BookSummary } from '@/src/types';

export function BookCard({
  book,
  language,
  onLongPress,
  offline = false,
}: {
  book: BookSummary;
  language: string;
  onLongPress?(): void;
  offline?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() =>
        router.push(offline
          ? { pathname: '/reader/[bookId]', params: { bookId: String(book.id), language, title: book.title } }
          : { pathname: '/book/[bookId]', params: { bookId: String(book.id), language } })
      }
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.book, pressed && styles.pressed]}>
      <BookCover
        title={book.title}
        author={book.author}
        workSlug={book.workSlug}
        coverUrl={book.coverUrl}
        style={styles.cover}
      />
      <View style={styles.bookCopy}>
        <View style={styles.meta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {book.cefrLevel}
            </Text>
          </View>
          {book.hasParallelTranslation && (
            <View style={styles.parallel}>
              <Ionicons name="git-compare-outline" size={12} color={colors.primary} />
              <Text style={styles.parallelText}>Parallel</Text>
            </View>
          )}
          {offline && (
            <View style={styles.parallel}>
              <Ionicons name="cloud-done-outline" size={12} color={colors.success} />
              <Text style={styles.offlineText}>Offline</Text>
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

const useStyles = createThemedStyles((colors, isDark) => ({
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    minHeight: 138,
    borderRadius: 24,
    backgroundColor: colors.surface,
    ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.media),
  },
  pressed: { opacity: 0.8 },
  cover: { width: 78, height: 112, borderRadius: 10, backgroundColor: colors.accentSoft },
  bookCopy: { flex: 1, gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '600' },
  parallel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  parallelText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  offlineText: { color: colors.success, fontSize: 10, fontWeight: '600' },
  bookTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 19, lineHeight: 23, fontWeight: '600' },
  author: { color: colors.muted, fontSize: 14 },
  footer: { flexDirection: 'row', gap: 10 },
  year: { color: colors.muted, fontSize: 12 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
}));
