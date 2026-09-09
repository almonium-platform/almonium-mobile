import { Text, View } from 'react-native';

import { paceFraction, type LanguageRhythm } from '@/src/rhythm';
import { createThemedStyles, fonts, serifLineHeight } from '@/src/theme';
import type { LearningStats } from '@/src/types';

/**
 * The three numbers that only move by reading: words you can read, books finished, weeks at
 * pace. No zero-state hero numbers: before there is data the space says what will live there.
 */
export function RecordStrip({
  stats,
  rhythm,
  emptyCopy = 'Nothing here until you finish a first session. Then this holds the words you can read, the books you finished, and the weeks you kept pace.',
}: {
  stats: LearningStats | undefined;
  rhythm: LanguageRhythm | null;
  emptyCopy?: string;
}) {
  const styles = useStyles();
  const pace = rhythm ? paceFraction(rhythm) : { met: 0, counted: 0 };
  const hasRecord = Boolean(stats && (stats.wordsKept > 0 || stats.booksFinished > 0 || pace.counted > 0));
  if (!hasRecord) return <Text style={styles.empty}>{emptyCopy}</Text>;
  return (
    <View style={styles.strip}>
      <Stat value={stats!.wordsKept.toLocaleString()} label="Words you can read" />
      <Stat value={stats!.booksFinished.toLocaleString()} label="Books finished" />
      <Stat value={pace.counted ? `${pace.met}/${pace.counted}` : '—'} label="Weeks at pace" />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  strip: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  value: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: serifLineHeight(24) },
  label: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 21 },
}));
