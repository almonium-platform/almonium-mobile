import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { WantButton } from '@/components/want-button';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { type CatalogHit, catalogMeta, isCatalogQuery, planCatalogResults } from '@/src/catalog';
import { freeFromLabel } from '@/src/public-domain';
import { createThemedStyles, fonts, serifLineHeight, shadows } from '@/src/theme';
import { readersLabel } from '@/src/wanted';

/** Rows shown before "Show N more". */
const previewRows = 5;
/** How long the search waits for the reader to stop typing before it asks the catalogue. */
const debounceMs = 300;

/**
 * Under the library, while the reader searches (W1, W2): every notable book the shelf does not
 * have yet, as rows rather than covers. A dashed outline stands where a cover would be; nothing
 * here wears a lock. A book under copyright is said plainly once, on its own card. If the
 * catalogue fails, the library simply stands alone. A signed-in reader can want any of these books
 * in the library's language; the row then says how many readers want it there.
 */
export function CatalogResults({ query, language }: { query: string; language: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { firebaseUser } = useAuth();
  const [settled, setSettled] = useState(query.trim());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), debounceMs);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => setExpanded(false), [settled]);

  const search = useQuery({
    queryKey: ['catalog-search', settled, language, firebaseUser?.uid],
    queryFn: () => api.catalogSearch(settled, language || undefined),
    enabled: isCatalogQuery(settled),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const plan = useMemo(() => planCatalogResults(search.data ?? []), [search.data]);

  if (!isCatalogQuery(settled) || (!plan.copyright && plan.rows.length === 0)) return null;
  const visible = expanded ? plan.rows : plan.rows.slice(0, previewRows);
  const hidden = plan.rows.length - visible.length;

  return (
    <View style={styles.section}>
      <View style={styles.kickerRow}>
        <Text accessibilityRole="header" style={styles.kicker}>{t('Not on the shelf yet')}</Text>
        <View style={styles.rule} />
      </View>

      {plan.copyright && <CopyrightCard hit={plan.copyright} />}

      {visible.length > 0 && (
        <View style={styles.card}>
          {visible.map((hit, index) => (
            <View key={hit.id} style={[styles.row, index > 0 && styles.rowRule]}>
              <View style={styles.outline} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={2}>{hit.title}</Text>
                {!!catalogMeta(hit) && <Text style={styles.rowMeta} numberOfLines={1}>{catalogMeta(hit)}</Text>}
                {hit.state === 'NOT_IN_YOUR_COUNTRY' && <Text style={styles.muted}>{t('Not available in your country')}</Text>}
                {hit.state === 'WANTABLE' && !!readersLabel(hit.readers) && <Text style={styles.muted}>{readersLabel(hit.readers)}</Text>}
                {!!freeFromLabel(hit) && <Text style={styles.muted}>{freeFromLabel(hit)}</Text>}
              </View>
              {hit.state === 'WANTABLE' && !!firebaseUser && !!language && (
                <WantButton catalogWorkId={hit.id} language={language} wanted={hit.wantedByMe} queueLink />
              )}
            </View>
          ))}
        </View>
      )}
      {hidden > 0 && (
        <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <Text style={styles.moreText}>{t('Show {count} more', { count: hidden })}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CopyrightCard({ hit }: { hit: CatalogHit }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const meta = catalogMeta(hit);
  const free = freeFromLabel(hit);
  return (
    <View style={[styles.card, styles.copyrightCard]}>
      <View style={[styles.outline, styles.outlineLarge]} />
      <View style={styles.copyrightCopy}>
        <Text style={styles.copyrightTitle}>{hit.title}</Text>
        {!!meta && <Text style={styles.rowMeta}>{meta}</Text>}
        <View style={styles.chipRow}>
          <View style={styles.chip}><Text style={styles.chipText}>{t('Under copyright')}</Text></View>
          {!!free && <Text style={styles.countdown}>{free}</Text>}
        </View>
        <Text style={styles.copyrightText}>{t('We can only publish books whose copyright has expired, so we can’t offer this one.')}</Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  section: { gap: 10 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  kicker: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 13 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  card: { marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 4, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  row: { minHeight: 44, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.line },
  outline: { width: 30, height: 40, borderRadius: 3, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border },
  outlineLarge: { width: 44, height: 64 },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 16, lineHeight: serifLineHeight(16) },
  rowMeta: { color: colors.metadata, fontSize: 12.5 },
  muted: { color: colors.muted, fontSize: 12.5 },
  copyrightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
  copyrightCopy: { flex: 1, alignItems: 'flex-start', gap: 5 },
  copyrightTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 18, lineHeight: serifLineHeight(18) },
  chipRow: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.cautionSoft },
  chipText: { color: colors.caution, fontFamily: fonts.sansSemibold, fontSize: 11.5 },
  countdown: { color: colors.muted, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  copyrightText: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  more: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  moreText: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 13.5 },
  pressed: { opacity: 0.7 },
}));
