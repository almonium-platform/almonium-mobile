import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { createThemedStyles, fonts, useTheme } from '@/src/theme';

/** A section of the settings page: kicker, optional title, rows separated by hairlines. */
export function Section({ eyebrow, title, action, children }: PropsWithChildren<{ eyebrow: string; title?: string; action?: ReactNode }>) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

/** One record per row: a label, a sub-line, and the one worded action on the right. */
export function Row({
  icon,
  label,
  detail,
  note,
  children,
  onPress,
}: PropsWithChildren<{ icon?: ReactNode; label: string; detail?: string; note?: string; onPress?(): void }>) {
  const styles = useStyles();
  const body = (
    <>
      {icon}
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
        {!!note && <Text style={styles.rowNote}>{note}</Text>}
      </View>
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        {body}
      </Pressable>
    );
  }
  return <View style={styles.row}>{body}</View>;
}

/** Every action in the column is the same pill; only the word changes. */
export function ActionPill({
  label,
  onPress,
  disabled = false,
  busy = false,
  tone = 'default',
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'default' | 'danger';
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, disabled && styles.pillDisabled, pressed && styles.pressed]}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={[styles.pillText, tone === 'danger' && styles.pillTextDanger, disabled && styles.pillTextDisabled]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Grey text, plum link. A plan boundary is not a mistake the user made. */
export function LimitLine({ children, linkLabel, onPress }: PropsWithChildren<{ linkLabel: string; onPress(): void }>) {
  const styles = useStyles();
  return (
    <Text style={styles.limit}>
      {children}{' '}
      <Text onPress={onPress} style={styles.limitLink}>{linkLabel}</Text>
    </Text>
  );
}

const useStyles = createThemedStyles((colors) => ({
  section: { gap: 4, paddingTop: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingBottom: 6 },
  sectionHeadCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, lineHeight: 26 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10 },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  rowDetail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  rowNote: { color: colors.metadata, fontSize: 12, lineHeight: 17 },
  pill: { minHeight: 36, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  pillDisabled: { borderColor: colors.line },
  pillText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  pillTextDanger: { color: colors.danger },
  pillTextDisabled: { color: colors.disabledText },
  pressed: { opacity: 0.72 },
  limit: { color: colors.muted, fontSize: 13.5, lineHeight: 20, paddingTop: 8 },
  limitLink: { color: colors.primary, fontWeight: '500' },
}));
