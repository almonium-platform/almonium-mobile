import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { crestRamp } from '@/src/crest';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import {
  bandWeeks,
  cadenceLabel,
  hasTarget,
  isEmptyRecord,
  paceFraction,
  rhythmSummary,
  targetOptions,
  weekLevel,
  weekMinutes,
  type LanguageRhythm,
  type RhythmWeek,
  type WeeklyTarget,
} from '@/src/rhythm';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import { useSetRhythmTarget } from '@/src/use-rhythm';

/**
 * The twelve-week band in the language's own colour. Tint is time learning, never a score;
 * a frozen week draws dashed because nothing was asked of it. Six steps, the same everywhere
 * weeks appear.
 */
export function WeekBand({ weeks, crest, dimmed = false }: { weeks: RhythmWeek[]; crest: string; dimmed?: boolean }) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const ramp = crestRamp(crest, isDark ? colors.surface : colors.canvas, isDark ? colors.nested : '#F1ECEF');
  const slots = [...Array.from({ length: Math.max(0, 12 - weeks.length) }, () => null), ...weeks];
  return (
    <View
      accessibilityRole="image"
      style={[styles.band, dimmed && styles.bandDimmed]}>
      {slots.map((week, index) => (
        <View
          key={week?.weekStart ?? `empty-${index}`}
          accessibilityLabel={week ? `${week.weekStart}, ${weekMinutes(week)} minutes` : undefined}
          style={[
            styles.week,
            { backgroundColor: week ? ramp[weekLevel(week)] : ramp[0] },
            week?.frozen && styles.weekFrozen,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The record card, where the target is actually set. It lives on home, scoped to the active
 * language; settings holds no target picker. Middle state is the same card with the panel open,
 * so the weeks stay visible behind the choice they re-read.
 */
export function Harness({
  rhythm,
  crest,
  language,
  loading = false,
}: {
  rhythm: LanguageRhythm | null;
  crest: string;
  language: string;
  loading?: boolean;
}) {
  const styles = useStyles();
  const showNotice = useNotice();
  const setTarget = useSetRhythmTarget();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WeeklyTarget>(null);
  const name = languageName(language);

  if (!rhythm) {
    return (
      <View style={styles.card} accessibilityState={{ busy: loading }}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>THE RECORD</Text>
          <Text style={styles.languageLabel}>{name}</Text>
        </View>
        <WeekBand weeks={[]} crest={crest} />
        <Text style={styles.summary}>
          {loading ? 'Reading your weeks…' : 'Twelve weeks, filling in as you learn. You can set a target once there is something to measure.'}
        </Text>
      </View>
    );
  }

  const empty = isEmptyRecord(rhythm);
  const pace = paceFraction(rhythm);

  async function save() {
    if (!rhythm) return;
    try {
      await setTarget.mutateAsync({ language: rhythm.language, target: draft });
      setEditing(false);
    } catch (error) {
      showNotice({ title: 'Could not move the bar', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>THE RECORD</Text>
        <Text style={styles.languageLabel}>
          {name}
          {!rhythm.editable && ' · set aside'}
        </Text>
      </View>
      <WeekBand weeks={bandWeeks(rhythm)} crest={crest} dimmed={editing} />

      {editing ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>How often is a good week?</Text>
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {targetOptions.map((option) => {
              const selected = draft === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setDraft(option.value)}
                  style={[styles.choice, selected && styles.choiceSelected]}>
                  <View style={[styles.dot, selected && styles.dotSelected]} />
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceLabel}>{option.label}</Text>
                    {!!option.note && <Text style={styles.choiceNote}>{option.note}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.panelNote}>Changing this re-reads the twelve weeks you already have. Nothing is lost either way.</Text>
          <View style={styles.panelActions}>
            <View style={styles.panelAction}>
              <Button loading={setTarget.isPending} onPress={() => void save()}>Save</Button>
            </View>
            <Pressable disabled={setTarget.isPending} onPress={() => setEditing(false)} style={styles.cancel}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.summary}>{rhythmSummary(rhythm, name)}</Text>
          {!rhythm.editable ? (
            <View style={styles.foot}>
              <Text style={styles.cadenceQuiet}>No target while set aside</Text>
              <Pressable onPress={() => router.push({ pathname: '/language/[code]', params: { code: rhythm.language } })} hitSlop={8}>
                <Text style={styles.link}>View record</Text>
              </Pressable>
            </View>
          ) : (
            !empty && (
              <View style={styles.foot}>
                <Text style={styles.cadence}>
                  {cadenceLabel(rhythm.target)}
                  {hasTarget(rhythm.target) && pace.counted > 0 ? ` · ${pace.met}/${pace.counted} weeks` : ''}
                </Text>
                <Pressable
                  onPress={() => {
                    setDraft(rhythm.target);
                    setEditing(true);
                  }}
                  hitSlop={8}>
                  <Text style={styles.link}>{rhythm.target === null ? 'Set a target' : 'Change'}</Text>
                </Pressable>
              </View>
            )
          )}
        </>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  card: { gap: 12, paddingVertical: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  languageLabel: { color: colors.muted, fontSize: 12 },
  band: { flexDirection: 'row', gap: 5 },
  bandDimmed: { opacity: 0.4 },
  week: { flex: 1, aspectRatio: 1, borderRadius: 5 },
  weekFrozen: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  summary: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cadence: { color: colors.muted, fontSize: 13 },
  cadenceQuiet: { color: colors.metadata, fontSize: 13 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  panel: { gap: 12 },
  panelTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 19, lineHeight: 25 },
  choices: { gap: 4 },
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  choiceSelected: { backgroundColor: colors.accentSoft },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  dotSelected: { borderWidth: 6, borderColor: colors.primary },
  choiceCopy: { flex: 1, gap: 2 },
  choiceLabel: { color: colors.ink, fontSize: 15 },
  choiceNote: { color: colors.metadata, fontSize: 12 },
  panelNote: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  panelAction: { flex: 1 },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
}));
