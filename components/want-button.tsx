import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { api } from '@/src/api';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts } from '@/src/theme';
import { wantedNoticeTitle } from '@/src/wanted';

/**
 * "I want this" and "✓ Wanted" (W1, W3): one tap wants the work in the language, the next takes
 * the want back without a word. A want is answered with its place in line; a refusal (under
 * copyright, already on the shelf) with the server's sentence. Search and the Wanted page then
 * ask again, so counts and ranks stay the server's.
 */
export function WantButton({ catalogWorkId, language, wanted, queueLink = false }: {
  catalogWorkId: string;
  language: string;
  wanted: boolean;
  /** Offer "See the queue" after a want; off on the Wanted page itself. */
  queueLink?: boolean;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const showNotice = useNotice();
  const mutation = useMutation({
    mutationFn: async (next: boolean) => (next ? api.wantBook(catalogWorkId, language) : api.withdrawWant(catalogWorkId, language)),
    onSuccess: async (receipt, next) => {
      if (next && receipt) {
        showNotice({
          title: wantedNoticeTitle(receipt.rank),
          tone: 'success',
          action: queueLink ? { label: t('See the queue'), onPress: () => router.push({ pathname: '/wanted', params: { language } }) } : undefined,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wanted'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog-search'] }),
      ]);
    },
    onError: (error) => showNotice({ title: error instanceof Error && error.message ? error.message : t('Something went wrong. Try again.'), tone: 'error' }),
  });
  // While the request runs, the button already shows where it is going.
  const shown = mutation.isPending ? Boolean(mutation.variables) : wanted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: shown, busy: mutation.isPending }}
      accessibilityHint={shown ? t('Takes it off your Wanted list') : undefined}
      disabled={mutation.isPending}
      hitSlop={6}
      onPress={() => mutation.mutate(!wanted)}
      style={({ pressed }) => [styles.button, shown && styles.wanted, pressed && styles.pressed]}>
      <Text style={styles.text}>{shown ? t('✓ Wanted') : t('I want this')}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  button: { minHeight: 36, minWidth: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  wanted: { borderColor: colors.accentSoft, backgroundColor: colors.accentSoft },
  text: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  pressed: { opacity: 0.7 },
}));
