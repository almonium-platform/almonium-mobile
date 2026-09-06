import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PaywallModal } from '@/components/paywall-modal';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import type { BookDetails, TranslationOrder } from '@/src/types';

function monthName(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toLocaleDateString(undefined, { month: 'long' });
}

/**
 * The parallel-text row on a book, three chip states: solid is the pair you read, outline is
 * available in one tap, dashed with a plus is requestable and only appears for languages on your
 * fluent list. No badge, no count, no "3 people want this". The ask is a sheet; at the cap the
 * same sheet lists what the allowance went to, with Withdraw.
 */
export function AlignmentRow({ book, language, onOpenParallel }: { book: BookDetails; language: string; onOpenParallel(parallel: string): void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const showNotice = useNotice();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<string | null>(null);
  const [wallVisible, setWallVisible] = useState(false);
  const orders = useQuery({ queryKey: ['translation-orders', firebaseUser?.uid], queryFn: api.translationOrders, enabled: Boolean(firebaseUser) });
  const quota = useQuery({ queryKey: ['translation-quota', firebaseUser?.uid], queryFn: api.translationQuota, enabled: Boolean(firebaseUser) });
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['translation-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['translation-quota'] }),
    ]);
  const request = useMutation({
    mutationFn: (target: string) => api.requestTranslation(book.id, target),
    onSuccess: async (_, target) => {
      await invalidate();
      setAsking(null);
      showNotice({ title: `${languageName(target)} requested`, message: 'When this one is ready, the bell will say so.', tone: 'success' });
    },
    onError: (error) => showNotice({ title: 'Could not send the request', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' }),
  });
  const withdraw = useMutation({
    mutationFn: (order: TranslationOrder) => api.withdrawTranslation(order.bookId, order.language),
    onSuccess: invalidate,
    onError: (error) => showNotice({ title: 'Could not withdraw', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' }),
  });

  const aligned = book.languageVariants.filter((variant) => variant.language !== book.language);
  const fluent = (profile?.fluentLangs ?? []).filter((code) => code !== book.language);
  const readingPair = aligned.find((variant) => fluent.includes(variant.language))?.language ?? aligned[0]?.language;
  const requestable = fluent.filter((code) => !aligned.some((variant) => variant.language === code));
  const asked = (orders.data ?? []).filter((order) => order.status === 'ASKED');
  const askedHere = (code: string) => asked.find((order) => order.bookId === book.id && order.language === code);
  const limit = quota.data?.limit ?? profile?.subscription.limits.MAX_TRANSLATION_REQUESTS_PER_MONTH ?? 1;
  const used = quota.data?.used ?? asked.length;
  const remaining = Math.max(0, limit - used);
  const month = monthName(quota.data?.periodStartsAt);
  const askingOrder = asking ? askedHere(asking) : undefined;

  if (!aligned.length && !requestable.length) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.eyebrow}>PARALLEL TEXT</Text>
      <View style={styles.chips}>
        {aligned.map((variant) => {
          const solid = variant.language === readingPair;
          return (
            <Pressable
              key={variant.language}
              accessibilityRole="button"
              accessibilityLabel={`Read with ${languageName(variant.language)}`}
              onPress={() => onOpenParallel(variant.language)}
              style={[styles.chip, solid ? styles.chipSolid : styles.chipOutline]}>
              <Text style={[styles.chipText, solid && styles.chipTextSolid]}>{languageName(variant.language)}</Text>
            </Pressable>
          );
        })}
        {requestable.map((code) => {
          const pending = askedHere(code);
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={pending ? `${languageName(code)} requested` : `Ask for ${languageName(code)}`}
              onPress={() => setAsking(code)}
              style={[styles.chip, styles.chipDashed]}>
              <Ionicons name={pending ? 'time-outline' : 'add'} size={14} color={colors.muted} />
              <Text style={styles.chipText}>{languageName(code)}</Text>
            </Pressable>
          );
        })}
      </View>
      {requestable.length > 0 && (
        <Text style={styles.note}>
          {askedHere(requestable[0])
            ? `${languageName(requestable[0])} is on its way. You asked for it; there is no date, and the bell says when it is ready.`
            : `${languageName(requestable[0])} is not aligned for this book yet. You can ask for it.`}
        </Text>
      )}

      <Sheet visible={asking !== null} onClose={() => setAsking(null)}>
        {asking && askingOrder ? (
          <>
            <Text style={styles.sheetTitle}>{languageName(asking)} for {book.title}</Text>
            <Text style={styles.note}>You asked for this one in {monthName(askingOrder.createdAt)}. When it is ready, every reader of the pair has it, and you hear first.</Text>
            <Button variant="secondary" loading={withdraw.isPending} onPress={() => withdraw.mutate(askingOrder, { onSuccess: () => setAsking(null) })}>
              Withdraw the request
            </Button>
          </>
        ) : asking && remaining > 0 ? (
          <>
            <Text style={styles.sheetTitle}>{languageName(asking)} for {book.title}</Text>
            <Text style={styles.note}>We add requested translations as we go. There is no date and no queue position — when this one is ready, the bell says so.</Text>
            <Text style={styles.quota}>This uses 1 of your {limit} {limit === 1 ? 'request' : 'requests'} for {month}.</Text>
            <Button loading={request.isPending} onPress={() => request.mutate(asking)}>Request {languageName(asking)}</Button>
            <Pressable onPress={() => setAsking(null)} style={styles.dismiss}><Text style={styles.link}>Not now</Text></Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>You have used your {month} {limit === 1 ? 'request' : 'requests'}</Text>
            <Text style={styles.note}>
              {asked.length
                ? `Withdraw one to spend it here instead, or ask again next month.`
                : 'Ask again next month.'}
            </Text>
            {asked.map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={styles.orderCopy}>
                  <Text style={styles.orderTitle}>{order.bookTitle} → {languageName(order.language)}</Text>
                  <Text style={styles.orderMeta}>Asked {new Date(order.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                </View>
                <Pressable disabled={withdraw.isPending} onPress={() => withdraw.mutate(order)} hitSlop={8}>
                  <Text style={styles.link}>Withdraw</Text>
                </Pressable>
              </View>
            ))}
            {!profile?.premium && (
              <Pressable onPress={() => { setAsking(null); setWallVisible(true); }} style={styles.dismiss}>
                <Text style={styles.link}>Premium gets three a month, read first.</Text>
              </Pressable>
            )}
          </>
        )}
      </Sheet>
      <PaywallModal context="alignment-request" visible={wallVisible} onClose={() => setWallVisible(false)} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  block: { gap: 10 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  chipSolid: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOutline: { borderColor: colors.primary, backgroundColor: colors.surface },
  chipDashed: { borderStyle: 'dashed', borderColor: colors.border },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  chipTextSolid: { color: colors.onPrimary },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  quota: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  dismiss: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10 },
  orderCopy: { flex: 1, gap: 2 },
  orderTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  orderMeta: { color: colors.metadata, fontSize: 12 },
}));
