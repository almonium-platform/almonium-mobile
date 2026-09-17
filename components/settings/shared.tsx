import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { createThemedStyles, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';

/**
 * A section of the settings page: kicker, optional title, rows separated by hairlines. The
 * eyebrow line can carry a caption at its right end ("4 of 4 active"), so a row of unlabelled
 * toggles has a meaning before the first one is touched.
 */
export function Section({
  eyebrow,
  title,
  caption,
  action,
  children,
}: PropsWithChildren<{ eyebrow: string; title?: string; caption?: string; action?: ReactNode }>) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
        </View>
        {action ?? (!!caption && <Text style={styles.caption}>{caption}</Text>)}
      </View>
      {children}
    </View>
  );
}

/**
 * One record per row: a label, a sub-line, and the one worded action on the right. A row whose
 * control is wider than a toggle and that carries a description `stack`s: title, description,
 * then the control right-aligned on its own line, so neither has to squeeze the other at 390pt.
 */
export function Row({
  icon,
  label,
  detail,
  note,
  stack = false,
  children,
  onPress,
}: PropsWithChildren<{ icon?: ReactNode; label: string; detail?: string; note?: string; stack?: boolean; onPress?(): void }>) {
  const styles = useStyles();
  const copy = (
    <View style={styles.rowCopy}>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
      {!!note && <Text style={styles.rowNote}>{note}</Text>}
    </View>
  );
  const body = stack ? (
    <View style={styles.stack}>
      <View style={styles.stackHead}>
        {icon}
        {copy}
      </View>
      <View style={styles.stackControl}>{children}</View>
    </View>
  ) : (
    <>
      {icon}
      {copy}
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

/**
 * Two or three words on one track. The track is what makes it a control: without it a white
 * pill beside plain words reads as one button and two labels. 32pt tall, 2pt inset, the chosen
 * segment lifted a hair off the track.
 */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange(value: T): void }) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
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

const useStyles = createThemedStyles((colors, isDark) => ({
  section: { gap: 4, paddingTop: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingBottom: 6 },
  sectionHeadCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, lineHeight: serifLineHeight(20) },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10 },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  // Descriptions are muted, never metadata grey: 4.5:1 on the page ground.
  rowDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  rowNote: { color: colors.metadata, fontSize: 12, lineHeight: 17 },
  stack: { flex: 1, gap: 10, paddingVertical: 2 },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stackControl: { flexDirection: 'row', justifyContent: 'flex-end' },
  pill: { minHeight: 36, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  pillDisabled: { borderColor: colors.line },
  pillText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  pillTextDanger: { color: colors.danger },
  pillTextDisabled: { color: colors.disabledText },
  pressed: { opacity: 0.72 },
  segmented: { flexDirection: 'row', height: 32, borderRadius: 999, padding: 2, backgroundColor: colors.track },
  segment: { minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999 },
  segmentSelected: { backgroundColor: colors.trackThumb, ...(isDark ? {} : shadows.segment) },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  segmentTextSelected: { color: colors.primaryDark, fontWeight: '600' },
  limit: { color: colors.muted, fontSize: 13.5, lineHeight: 20, paddingTop: 8 },
  limitLink: { color: colors.primary, fontWeight: '500' },
}));
