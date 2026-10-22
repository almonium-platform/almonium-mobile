import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { api } from '@/src/api';
import { countryName, groupUnlocksByYear } from '@/src/catalog';
import { unlockGroupLabel } from '@/src/public-domain';
import { createThemedStyles, fonts, serifLineHeight } from '@/src/theme';

/**
 * Where it's free (W7), the phone's form: the same data the web client draws as a map, as a list
 * grouped by the year each country frees the work, soonest first, the reader's own country marked.
 * Countries the rules table does not cover stand at the end as "Not checked yet" rather than guessed.
 */
export function UnlockSheet({ catalogWorkId, title, visible, onClose }: {
  catalogWorkId: string | null;
  title: string;
  visible: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const query = useQuery({
    queryKey: ['work-unlocks', catalogWorkId],
    queryFn: () => api.workUnlocks(catalogWorkId!),
    enabled: visible && catalogWorkId !== null,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
  const unlocks = query.data ?? null;
  const groups = unlocks ? groupUnlocksByYear(unlocks.countries) : [];
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <Text style={styles.eyebrow} numberOfLines={1}>{title}</Text>
        <Text accessibilityRole="header" style={styles.title}>{t('Where it’s free to read')}</Text>
      </View>
      {query.isPending && <ActivityIndicator style={styles.spinner} />}
      {query.isError && <Text style={styles.note}>{t('The list didn’t load. Try again in a moment.')}</Text>}
      {groups.map((group) => (
        <View key={group.year ?? 'unknown'} style={styles.group}>
          <Text style={styles.year}>{unlockGroupLabel(group.year)}</Text>
          <Text style={styles.countries}>
            {group.countries.map((unlock, index) => (
              <Text key={unlock.country} style={unlock.country === unlocks?.readerCountry ? styles.home : undefined}>
                {index > 0 ? ', ' : ''}{countryName(unlock.country)}
              </Text>
            ))}
          </Text>
        </View>
      ))}
      {!!unlocks && (
        <Text style={styles.note}>{t('The rules behind these dates are simplified; a country not yet checked is not guessed.')}</Text>
      )}
    </Sheet>
  );
}

const useStyles = createThemedStyles((colors) => ({
  head: { gap: 2, paddingHorizontal: 20, paddingBottom: 10 },
  eyebrow: { color: colors.metadata, fontSize: 12.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, lineHeight: serifLineHeight(20) },
  spinner: { paddingVertical: 24 },
  group: { gap: 3, paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  year: { color: colors.ink, fontFamily: fonts.sansSemibold, fontSize: 13.5 },
  countries: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  home: { color: colors.primary, fontFamily: fonts.sansSemibold },
  note: { paddingHorizontal: 20, paddingVertical: 12, color: colors.metadata, fontSize: 12.5, lineHeight: 18 },
}));
