import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { AlignmentRow } from '@/components/alignment-request';
import { GuestHeaderActions } from '@/components/guest-header';
import { BookCover } from '@/components/book-cover';
import { Screen } from '@/components/screen';
import { Button, Card } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { downloadBook, downloadedBooks, formattedDownloadSize, removeDownloadedBook } from '@/src/offline-books';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';
import { isUuid } from '@/src/uuid';
import { editionLabel } from '@/src/reader-editions';
import type { BookDetails } from '@/src/types';

export default function BookDetailsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ bookId: string; language?: string; slug?: string }>();
  const bookId = params.bookId;
  const validBookId = isUuid(bookId);
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  // Without an account the book is its public edition: addressed by slug, read without a token.
  const guest = !authLoading && !firebaseUser;
  const slug = params.slug;
  const language =
    params.language ||
    profile?.learners.find((learner) => learner.active)?.language ||
    '';

  const query = useQuery({
    queryKey: guest ? ['public-book', slug] : ['book', firebaseUser?.uid, bookId, language],
    queryFn: () => (guest ? api.publicBook(slug!) : api.book(bookId, language)),
    enabled: guest ? Boolean(slug) : Boolean(firebaseUser) && validBookId && Boolean(language),
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
  const downloadsQuery = useQuery({ queryKey: ['offline-books'], queryFn: downloadedBooks });
  const downloaded = downloadsQuery.data?.find((entry) => entry.id === bookId);
  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) return;
      await downloadBook(query.data, await api.bookText(query.data.id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offline-books'] }),
  });
  const removeDownloadMutation = useMutation({
    mutationFn: () => removeDownloadedBook(bookId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offline-books'] }),
  });

  if (guest ? !slug : !validBookId || !language) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.errorTitle}>{t('This book link is invalid.')}</Text>
        <Button onPress={() => router.back()}>{t('Back to library')}</Button>
      </Screen>
    );
  }

  if (query.isLoading || authLoading) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.loading}>{t('Opening book details…')}</Text>
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen contentStyle={styles.center}>
        <Ionicons name="book-outline" size={42} color={colors.primary} />
        <Text style={styles.errorTitle}>{t('This book would not open.')}</Text>
        <Text style={styles.errorText}>
          {query.error instanceof Error ? query.error.message : t('Please try again.')}
        </Text>
        <Button onPress={() => query.refetch()}>{t('Try again')}</Button>
      </Screen>
    );
  }

  const book = query.data;
  const pages = Math.max(1, Math.ceil(book.wordCount / 250));
  const readerParams = { bookId: String(book.id), language: language || book.language, title: book.title, ...(book.editionSlug ? { slug: book.editionSlug } : {}) };

  return (
    <Screen>
      <Stack.Screen options={{ title: book.title, headerRight: guest ? () => <GuestHeaderActions returnTo={`/book/${encodeURIComponent(bookId)}?slug=${encodeURIComponent(slug ?? '')}`} /> : undefined }} />
      <View style={styles.hero}>
        <BookCover
          title={book.title}
          author={book.author}
          workSlug={book.workSlug}
          coverUrl={book.coverUrl}
          style={styles.cover}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>
          <Text style={styles.meta}>{book.publicationYear}</Text>
          {!guest && <Pressable
            disabled={favoriteMutation.isPending}
            onPress={() => favoriteMutation.mutate()}
            style={styles.favorite}>
            <Ionicons
              name={book.favorite ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.favoriteText}>
              {book.favorite ? t('Saved to favorites') : t('Save to favorites')}
            </Text>
          </Pressable>}
        </View>
      </View>

      <Button onPress={() => router.push({ pathname: '/reader/[bookId]', params: readerParams })}>
        {book.progressPercentage ? t('Continue at {percentage}%', { percentage: book.progressPercentage }) : t('Start reading')}
      </Button>

      {guest ? null : downloaded ? (
        <View style={styles.downloadRow}>
          <View style={styles.downloadCopy}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.downloadText}>{t('Available offline · {size}', { size: formattedDownloadSize(downloaded.size) })}</Text>
          </View>
          <Pressable disabled={removeDownloadMutation.isPending} onPress={() => removeDownloadMutation.mutate()} hitSlop={8}>
            <Text style={styles.removeDownload}>{t('Remove')}</Text>
          </Pressable>
        </View>
      ) : (
        <Button variant="secondary" loading={downloadMutation.isPending} onPress={() => downloadMutation.mutate()}>
          {t('Download for offline reading')}
        </Button>
      )}
      {(downloadMutation.isError || removeDownloadMutation.isError) && (
        <Text accessibilityRole="alert" style={styles.downloadError}>
          {(downloadMutation.error || removeDownloadMutation.error) instanceof Error
            ? (downloadMutation.error || removeDownloadMutation.error)?.message
            : t('The offline copy could not be changed.')}
        </Text>
      )}

      <Card>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {book.cefrLevel}
            </Text>
            <Text style={styles.statLabel}>{t('Level')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pages}</Text>
            <Text style={styles.statLabel}>{t('Est. pages')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{languageName(book.language)}</Text>
            <Text style={styles.statLabel}>{t('Language')}</Text>
          </View>
        </View>
      </Card>

      <Card>
        {guest ? (
          <GuestParallelRow book={book} onOpenParallel={(parallel) => router.push({ pathname: '/reader/[bookId]', params: { ...readerParams, parallel } })} />
        ) : (
          <AlignmentRow
            book={book}
            language={language}
            onOpenParallel={(parallel) => router.push({ pathname: '/reader/[bookId]', params: { ...readerParams, parallel } })}
          />
        )}
        {book.languageVariants.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>{t('Read it in')}</Text>
            <View style={styles.variants}>
              {book.languageVariants.map((variant) => (
                <Pressable
                  key={`${variant.id}-${variant.language}`}
                  onPress={() =>
                    router.replace({
                      pathname: '/book/[bookId]',
                      params: { bookId: String(variant.id), language, ...(variant.editionSlug ? { slug: variant.editionSlug } : {}) },
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
                    {editionLabel(variant)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Card>

      {book.translator && (
        <Card>
          <Text style={styles.sectionTitle}>{t('Translation')}</Text>
          <Text style={styles.translator}>{t('Translated by {translator}', { translator: book.translator })}</Text>
        </Card>
      )}
    </Screen>
  );
}

/**
 * The parallel-text row for a guest: the companions that exist open in one tap; asking for a new
 * one is keeping, so the chip opens the auth screens and returns here.
 */
function GuestParallelRow({ book, onOpenParallel }: { book: BookDetails; onOpenParallel(parallel: string): void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const companions = book.languageVariants.filter((variant) => variant.id !== book.id && variant.editionSlug);
  const returnTo = `/book/${encodeURIComponent(String(book.id))}?slug=${encodeURIComponent(book.editionSlug ?? '')}`;
  return (
    <>
      <Text style={styles.sectionTitle}>{t('Parallel text')}</Text>
      <View style={styles.variants}>
        {companions.map((variant) => (
          <Pressable key={variant.id} accessibilityRole="button" onPress={() => onOpenParallel(variant.editionSlug!)} style={styles.variant}>
            <Text style={styles.variantText}>{editionLabel(variant)}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { returnTo } })} style={[styles.variant, styles.variantAsk]}>
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text style={styles.variantText}>{t('Request a translation')}</Text>
        </Pressable>
      </View>
      <Text style={styles.guestNote}>{t('Requesting a translation needs a free account.')}</Text>
    </>
  );
}

const useStyles = createThemedStyles((colors) => ({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: colors.muted, fontSize: 16 },
  errorTitle: { color: colors.ink, fontSize: 21, fontWeight: '600', textAlign: 'center' },
  errorText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  hero: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  cover: { width: 126, height: 184, borderRadius: 15, backgroundColor: colors.accentSoft },
  heroCopy: { flex: 1, gap: 9, paddingTop: 4 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 27, lineHeight: serifLineHeight(27), fontWeight: '600' },
  author: { color: colors.muted, fontFamily: fonts.serif, fontSize: 18 },
  meta: { color: colors.muted, fontWeight: '600' },
  favorite: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 5 },
  favoriteText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, gap: 3, alignItems: 'center' },
  divider: { width: 1, height: 32, backgroundColor: colors.line },
  statValue: { color: colors.ink, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  statLabel: { color: colors.muted, fontSize: 11 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.canvas },
  variantActive: { backgroundColor: colors.primary },
  variantText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  variantTextActive: { color: colors.onPrimary },
  variantAsk: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  guestNote: { color: colors.metadata, fontSize: 12, lineHeight: 17 },
  translator: { color: colors.primary, fontSize: 14, fontStyle: 'italic' },
  downloadRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 20, paddingHorizontal: 15, backgroundColor: colors.successSoft },
  downloadCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
  removeDownload: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  downloadError: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
}));
