import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui';
import { WantButton } from '@/components/want-button';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';
import { type ArrivedRow, type WantedRow, readersLabel, wantedRowMeta } from '@/src/wanted';

/**
 * The Wanted page (W3): what readers want, in one public order ranked by readers. Up to two works
 * editorial has started sit on their own cards; the queue follows, each row with its place and the
 * same "I want this" toggle as search; under it, wanted books that arrived in the last two weeks.
 * Order and state only, never dates: a rank is a strong hint to editorial, not a promise.
 */
export default function WantedScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser } = useAuth();
  const showNotice = useNotice();
  const [mine, setMine] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['wanted', firebaseUser?.uid, mine],
    queryFn: () => api.wanted(mine),
    enabled: Boolean(firebaseUser),
    placeholderData: (previous) => previous,
  });
  const data = query.data;
  const empty = data && !data.beingPrepared.length && !data.queue.length;

  /** The arrived row knows its edition; the book screen wants the book's id, so ask once. */
  async function read(row: ArrivedRow) {
    if (opening) return;
    setOpening(row.editionSlug);
    try {
      const book = await api.publicBook(row.editionSlug);
      router.push({ pathname: '/book/[bookId]', params: { bookId: String(book.id), language: row.language, slug: row.editionSlug } });
    } catch (error) {
      showNotice({ title: error instanceof Error && error.message ? error.message : t('Something went wrong. Try again.'), tone: 'error' });
    } finally {
      setOpening(null);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '', headerBackTitle: t('Library'), headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{t('Wanted')}</Text>
        <View accessibilityRole="radiogroup" style={styles.toggle}>
          <Segment label={t('Everyone’s')} selected={!mine} onPress={() => setMine(false)} />
          <Segment label={t('Yours · {count}', { count: data?.mineCount ?? 0 })} selected={mine} onPress={() => setMine(true)} />
        </View>

        {query.isLoading && !data ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : query.isError && !data ? (
          <View style={styles.empty}>
            <Text style={styles.status}>{query.error instanceof Error ? query.error.message : t('Something went wrong. Try again.')}</Text>
            <Button onPress={() => query.refetch()}>{t('Try again')}</Button>
          </View>
        ) : data ? (
          <>
            {data.beingPrepared.map((row) => <PreparedCard key={`${row.catalogWorkId}-${row.language}`} row={row} />)}
            {empty ? (
              <Text style={styles.emptyNote}>{t('Nothing yet. Search for a book you’d like to read.')}</Text>
            ) : data.queue.length > 0 && (
              <View style={styles.card}>
                {data.queue.map((row, index) => <QueueRow key={`${row.catalogWorkId}-${row.language}`} row={row} first={index === 0} />)}
              </View>
            )}
            {data.recentlyArrived.length > 0 && (
              <>
                <View style={styles.kickerRow}>
                  <Text accessibilityRole="header" style={styles.kicker}>{t('Recently arrived')}</Text>
                  <View style={styles.rule} />
                </View>
                <View style={styles.card}>
                  {data.recentlyArrived.map((row, index) => (
                    <View key={`${row.catalogWorkId}-${row.language}`} style={[styles.row, index > 0 && styles.rowRule]}>
                      <BookCover title={row.title} author={row.author ?? ''} workSlug={row.editionSlug} coverUrl={row.coverUrl} width={36} height={52} />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle} numberOfLines={2}>{row.title}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{[row.author, languageName(row.language), row.cefrLevel].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('Read {title}', { title: row.title })}
                        disabled={opening !== null}
                        hitSlop={6}
                        onPress={() => void read(row)}
                        style={({ pressed }) => [styles.read, pressed && styles.pressed]}>
                        {opening === row.editionSlug ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.readText}>{t('Read')}</Text>}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** A work editorial has started: said plainly, with no stage bars or dates. */
function PreparedCard({ row }: { row: WantedRow }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.prepared]}>
      <Text style={styles.label}>{t('Being prepared')}</Text>
      <Text style={styles.preparedTitle}>{row.title}</Text>
      <Text style={styles.rowMeta}>{wantedRowMeta(row)}</Text>
      {row.wantedByMe && <Text style={styles.mine}>{t('You want this')}</Text>}
    </View>
  );
}

function QueueRow({ row, first }: { row: WantedRow; first: boolean }) {
  const styles = useStyles();
  const readers = readersLabel(row.readers);
  return (
    <View style={[styles.row, !first && styles.rowRule]}>
      <Text style={styles.rank}>{row.rank}</Text>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={2}>{row.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{wantedRowMeta(row)}</Text>
        {!!readers && <Text style={styles.readers}>{readers}</Text>}
      </View>
      <WantButton catalogWorkId={row.catalogWorkId} language={row.language} wanted={row.wantedByMe} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingTop: 8, paddingBottom: 40, gap: 14 },
  title: { paddingHorizontal: 16, color: colors.ink, fontFamily: fonts.serif, fontSize: 28, lineHeight: serifLineHeight(28) },
  toggle: { flexDirection: 'row', gap: 7, paddingHorizontal: 16 },
  segment: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  segmentText: { color: colors.muted, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  segmentTextActive: { color: colors.primary },
  pressed: { opacity: 0.7 },
  card: { marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 4, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  prepared: { paddingVertical: 16, gap: 4 },
  label: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  preparedTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 18, lineHeight: serifLineHeight(18) },
  mine: { marginTop: 2, color: colors.primary, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  row: { minHeight: 44, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.line },
  rank: { width: 24, color: colors.muted, fontFamily: fonts.mono, fontSize: 13, textAlign: 'right' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 16, lineHeight: serifLineHeight(16) },
  rowMeta: { color: colors.metadata, fontSize: 12.5 },
  readers: { color: colors.muted, fontSize: 12.5 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  kicker: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 13 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  read: { minHeight: 36, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  readText: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  loading: { paddingVertical: 40 },
  empty: { gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  status: { color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyNote: { paddingVertical: 24, paddingHorizontal: 24, color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
}));
