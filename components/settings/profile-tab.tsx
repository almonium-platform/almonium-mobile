import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { AvatarPicker } from '@/components/avatar-picker';
import { RecordStrip } from '@/components/record-strip';
import { ActionPill, Row, Section } from '@/components/settings/shared';
import { Sheet } from '@/components/sheet';
import { Button, Field } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useCrest } from '@/src/crest-context';
import { languageName } from '@/src/languages';
import { freeSavedItemLimit } from '@/src/limits';
import { useNotice } from '@/src/notice-context';
import { cadenceLabel, paceFraction } from '@/src/rhythm';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import { rhythmFor, useLearningStats, useRhythm } from '@/src/use-rhythm';

/**
 * The profile tab: how you appear, your name, the record for the active language, the other
 * languages collapsed to a name and a fraction, interests, visibility, and the plan as one line.
 * A fresh profile never grades someone who has not started: no zero counters, no empty strip.
 */
export function ProfileTab() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { profile, refreshProfile } = useAuth();
  const { crestFor } = useCrest();
  const showNotice = useNotice();
  const [editingName, setEditingName] = useState(false);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [savingName, setSavingName] = useState(false);
  const [hidden, setHidden] = useState(profile?.hidden ?? false);
  const [savingHidden, setSavingHidden] = useState(false);
  const [interestsVisible, setInterestsVisible] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<number[]>(profile?.interests.map((interest) => interest.id) ?? []);
  const [savingInterests, setSavingInterests] = useState(false);

  useEffect(() => setUsername(profile?.username ?? ''), [profile?.username]);
  useEffect(() => setHidden(profile?.hidden ?? false), [profile?.hidden]);
  useEffect(() => setSelectedInterests(profile?.interests.map((interest) => interest.id) ?? []), [profile?.interests]);

  const active = profile?.learners.find((learner) => learner.active) ?? profile?.learners[0];
  const others = useMemo(
    () => profile?.learners.filter((learner) => learner.language !== active?.language) ?? [],
    [active?.language, profile?.learners],
  );
  const rhythm = useRhythm();
  const stats = useLearningStats(active?.language);
  const activeRhythm = rhythmFor(rhythm.data, active?.language);
  const interestsQuery = useQuery({ queryKey: ['interests'], queryFn: api.interests, staleTime: Infinity });
  const validName = /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());

  async function saveUsername() {
    setSavingName(true);
    try {
      await api.updateUsername(username.trim());
      await refreshProfile();
      setEditingName(false);
    } catch (error) {
      showNotice({ title: 'Could not save your name', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setSavingName(false);
    }
  }

  async function toggleHidden(nextHidden: boolean) {
    setHidden(nextHidden);
    setSavingHidden(true);
    try {
      await api.updatePrivacy(nextHidden);
      await refreshProfile();
    } catch (error) {
      setHidden(!nextHidden);
      showNotice({ title: 'Could not update visibility', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setSavingHidden(false);
    }
  }

  async function saveInterests() {
    setSavingInterests(true);
    try {
      await api.updateInterests(selectedInterests);
      await refreshProfile();
      setInterestsVisible(false);
    } catch (error) {
      showNotice({ title: 'Could not update interests', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setSavingInterests(false);
    }
  }

  const premium = profile?.premium ?? false;
  const activeLimit = profile?.subscription.limits.MAX_ACTIVE_LANGS;
  const requestLimit = profile?.subscription.limits.MAX_TRANSLATION_REQUESTS_PER_MONTH;

  return (
    <View style={styles.tab}>
      <AvatarPicker />

      <Section eyebrow="USERNAME">
        {editingName ? (
          <View style={styles.nameEditor}>
            <Field value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" autoFocus maxLength={20} />
            <Text style={styles.note}>3–20 letters, numbers or underscores. Only used if you share a word pack.</Text>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button variant="secondary" disabled={savingName} onPress={() => { setEditingName(false); setUsername(profile?.username ?? ''); }}>Cancel</Button>
              </View>
              <View style={styles.action}>
                <Button loading={savingName} disabled={!validName || username.trim() === profile?.username} onPress={() => void saveUsername()}>Save</Button>
              </View>
            </View>
          </View>
        ) : (
          <Row label={profile?.username ?? ''} note="Only used if you share a word pack.">
            <ActionPill label="Change" onPress={() => setEditingName(true)} />
          </Row>
        )}
      </Section>

      <Section eyebrow="YOUR RECORD" title={active ? languageName(active.language) : undefined}>
        <View style={styles.block}>
          <RecordStrip stats={stats.data} rhythm={activeRhythm} />
          {activeRhythm && paceFraction(activeRhythm).counted > 0 ? (
            <View style={styles.recordFoot}>
              <Text style={styles.note}>{cadenceLabel(activeRhythm.target)}. Tint shows time learning, not a score.</Text>
              <Pressable onPress={() => router.push('/(tabs)/home')} hitSlop={8}>
                <Text style={styles.link}>Change on home</Text>
              </Pressable>
            </View>
          ) : (
            <Button variant="secondary" onPress={() => router.push('/(tabs)/books')}>Open the library</Button>
          )}
        </View>
      </Section>

      {others.length > 0 && (
        <Section eyebrow="ALSO LEARNING">
          {others.map((learner) => {
            const record = rhythmFor(rhythm.data, learner.language);
            const pace = record ? paceFraction(record) : null;
            const crest = crestFor(learner.language);
            return (
              <Row
                key={learner.id}
                icon={<View style={[styles.swatch, { backgroundColor: crest }]} />}
                label={languageName(learner.language)}
                detail={learner.active ? `${learner.selfReportedLevel}` : 'Set aside'}
                onPress={() => router.push({ pathname: '/language/[code]', params: { code: learner.language } })}>
                {!!pace?.counted && <Text style={styles.fraction}>{pace.met}/{pace.counted}</Text>}
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Row>
            );
          })}
        </Section>
      )}

      <Section eyebrow="INTERESTS">
        <View style={styles.chips}>
          {profile?.interests.map((interest) => (
            <View key={interest.id} style={styles.chip}>
              <Text style={styles.chipText}>{interest.name}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setInterestsVisible(true)} style={styles.addChip}>
            <Text style={styles.addChipText}>+ Add</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Used to pick which books get suggested.</Text>
      </Section>

      <Section eyebrow="VISIBILITY">
        <Row label="Profile is visible" detail="Others can find you and send connection requests.">
          <Switch
            disabled={savingHidden}
            value={!hidden}
            onValueChange={(visible) => void toggleHidden(!visible)}
            trackColor={{ false: colors.line, true: colors.accentBorder }}
            thumbColor={!hidden ? colors.primary : colors.muted}
            ios_backgroundColor={colors.line}
          />
        </Row>
      </Section>

      <Section eyebrow="PLAN">
        <Row
          label={premium ? (profile?.subscription.founder ? 'Founding member' : 'Premium') : 'Free'}
          detail={
            premium
              ? `${activeLimit && activeLimit > 0 ? `${activeLimit} languages` : 'Every language'}${requestLimit ? `, ${requestLimit} translation requests a month` : ''}.`
              : `One language, ${freeSavedItemLimit === 100 ? 'a hundred' : freeSavedItemLimit} saved words.`
          }>
          <ActionPill label={premium ? 'Manage' : 'What Premium adds'} onPress={() => router.push('/membership')} />
        </Row>
      </Section>

      <Sheet visible={interestsVisible} onClose={() => setInterestsVisible(false)}>
        <Text style={styles.sheetTitle}>Interests</Text>
        <Text style={styles.note}>Pick anything you enjoy. They only shape which books come first.</Text>
        <View style={styles.chips}>
          {(interestsQuery.data ?? []).map((interest) => {
            const selected = selectedInterests.includes(interest.id);
            return (
              <Pressable
                key={interest.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => setSelectedInterests((current) => selected ? current.filter((id) => id !== interest.id) : [...current, interest.id])}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{interest.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button loading={savingInterests} onPress={() => void saveInterests()}>Save</Button>
      </Sheet>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  tab: { gap: 18 },
  nameEditor: { gap: 10, paddingTop: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  block: { gap: 12, paddingTop: 4 },
  recordFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  fraction: { color: colors.muted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  chip: { minHeight: 36, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '500' },
  chipTextSelected: { color: colors.primary },
  addChip: { minHeight: 36, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  addChipText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
}));
