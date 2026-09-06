import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { PaywallModal } from '@/components/paywall-modal';
import { ActionPill, LimitLine, Row, Section } from '@/components/settings/shared';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageColours } from '@/src/crest';
import { useCrest } from '@/src/crest-context';
import { languageName, sortLanguages } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import type { CefrLevel, Learner } from '@/src/types';

export const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** The sentence someone chose at onboarding, so they are never handed a code they never picked. */
export const levelSentences: Record<CefrLevel, string> = {
  A1: 'I know some words and set phrases.',
  A2: 'I can follow short, direct sentences about familiar things.',
  B1: 'I can get through a simple story if I look words up often.',
  B2: 'I can follow a novel with a dictionary nearby.',
  C1: 'I read fluently and stop only at unusual or literary words.',
  C2: 'I read anything, including older and specialised prose.',
};

/** Only EN and DE carry extras today; every other card reads Core features. */
export const languageFeatures: Record<string, string> = {
  DE: 'Lexemes · Frequency · Prepared decks',
  EN: 'Lexemes · Frequency · Decks · POS',
};

/**
 * One row per language, and the row is the whole record: colour, name, level, active. Known
 * languages stay neutral grey; only languages you are learning get a hue. On Free the switch
 * becomes a single choice made through Make active, so the account can never sit at zero.
 */
export function LearningTab() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const { crestFor, setCrest } = useCrest();
  const showNotice = useNotice();
  const queryClient = useQueryClient();
  const [busyLanguage, setBusyLanguage] = useState<string | null>(null);
  const [levelFor, setLevelFor] = useState<Learner | null>(null);
  const [colourFor, setColourFor] = useState<string | null>(null);
  const [fluentVisible, setFluentVisible] = useState(false);
  const [fluentDraft, setFluentDraft] = useState<string[]>([]);
  const [savingFluent, setSavingFluent] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [addStep, setAddStep] = useState<'pick' | 'place'>('pick');
  const [addSearch, setAddSearch] = useState('');
  const [addLanguage, setAddLanguage] = useState('');
  const [addLevel, setAddLevel] = useState<CefrLevel>('A1');
  const [adding, setAdding] = useState(false);
  const [wallVisible, setWallVisible] = useState(false);

  const languagesQuery = useQuery({ queryKey: ['supported-languages'], queryFn: api.supportedLanguages, staleTime: Infinity });
  const policy = useQuery({
    queryKey: ['active-language-policy', firebaseUser?.uid],
    queryFn: api.activeLanguagePolicy,
    enabled: Boolean(firebaseUser),
  });
  const learners = useMemo(() => profile?.learners ?? [], [profile?.learners]);
  const activeCount = learners.filter((learner) => learner.active).length;
  const allowance = policy.data?.allowance ?? profile?.subscription.limits.MAX_ACTIVE_LANGS ?? 1;
  const unlimited = allowance === -1;
  const targetLimit = profile?.subscription.limits.MAX_TARGET_LANGS ?? 3;
  const fluentLimit = profile?.subscription.limits.MAX_FLUENT_LANGS ?? 1;
  const cooldownUntil = policy.data?.nextSwitchAllowedAt ? new Date(policy.data.nextSwitchAllowedAt) : null;
  const inCooldown = Boolean(cooldownUntil && cooldownUntil.getTime() > Date.now());
  const wordsFor = (language: string) => policy.data?.languages.find((choice) => choice.language === language)?.wordsKept;
  const addable = useMemo(
    () =>
      sortLanguages(languagesQuery.data ?? []).filter(
        (code) =>
          !learners.some((learner) => learner.language === code) &&
          !profile?.fluentLangs.includes(code) &&
          (!addSearch.trim() || languageName(code).toLowerCase().includes(addSearch.trim().toLowerCase()) || code.toLowerCase().includes(addSearch.trim().toLowerCase())),
      ),
    [addSearch, languagesQuery.data, learners, profile?.fluentLangs],
  );

  async function changed() {
    await refreshProfile();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['active-language-policy'] }),
      queryClient.invalidateQueries({ queryKey: ['rhythm'] }),
      queryClient.invalidateQueries({ queryKey: ['bookshelf'] }),
    ]);
  }

  async function update(learner: Learner, updates: { active?: boolean; level?: CefrLevel }) {
    setBusyLanguage(learner.language);
    try {
      await api.updateLearner(learner.language, updates);
      await changed();
    } catch (error) {
      showNotice({ title: 'Could not update language', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setBusyLanguage(null);
    }
  }

  async function remove(learner: Learner) {
    setBusyLanguage(learner.language);
    try {
      await api.deleteLearner(learner.language);
      setLevelFor(null);
      await changed();
    } catch (error) {
      showNotice({ title: 'Could not remove language', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setBusyLanguage(null);
    }
  }

  async function saveFluent() {
    setSavingFluent(true);
    try {
      await api.updateFluentLanguages(fluentDraft);
      await changed();
      setFluentVisible(false);
    } catch (error) {
      showNotice({ title: 'Could not update languages', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setSavingFluent(false);
    }
  }

  function openAdd() {
    if (!profile?.premium && learners.length >= (unlimited ? targetLimit : Math.max(allowance, 1))) {
      setWallVisible(true);
      return;
    }
    setAddStep('pick');
    setAddSearch('');
    setAddLanguage('');
    setAddLevel('A1');
    setAddVisible(true);
  }

  async function submitAdd() {
    if (!addLanguage) return;
    setAdding(true);
    try {
      await api.addLearner(addLanguage, addLevel);
      await changed();
      setAddVisible(false);
    } catch (error) {
      showNotice({ title: 'Could not add language', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.tab}>
      <Section
        eyebrow="I KNOW"
        action={<ActionPill label="Edit" onPress={() => { setFluentDraft(profile?.fluentLangs ?? []); setFluentVisible(true); }} />}>
        <View style={styles.chips}>
          {(profile?.fluentLangs ?? []).map((code) => (
            <View key={code} style={styles.neutralChip}>
              <Text style={styles.neutralChipText}>{languageName(code)}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section eyebrow="I’M LEARNING" title={unlimited ? undefined : `${activeCount} of ${allowance} active`}>
        {learners.map((learner) => {
          const crest = crestFor(learner.language);
          const busy = busyLanguage === learner.language;
          const words = wordsFor(learner.language);
          return (
            <Row
              key={learner.id}
              icon={
                <Pressable accessibilityLabel={`Colour for ${languageName(learner.language)}`} onPress={() => setColourFor(learner.language)} hitSlop={10}>
                  <View style={[styles.swatch, { backgroundColor: crest }]} />
                </Pressable>
              }
              label={languageName(learner.language)}
              detail={
                learner.active
                  ? words !== undefined ? `${words.toLocaleString()} words kept` : undefined
                  : `Read-only${words !== undefined ? ` · ${words.toLocaleString()} words kept` : ''}`
              }
              onPress={() => router.push({ pathname: '/language/[code]', params: { code: learner.language } })}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Level ${learner.selfReportedLevel}`}
                disabled={busy}
                onPress={() => setLevelFor(learner)}
                style={styles.levelPill}>
                <Text style={styles.levelPillText}>{learner.selfReportedLevel}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.muted} />
              </Pressable>
              {unlimited || allowance > 1 ? (
                <Switch
                  disabled={busy || (!learner.active && !unlimited && activeCount >= allowance) || (learner.active && activeCount <= 1)}
                  value={learner.active}
                  onValueChange={(active) => void update(learner, { active })}
                  trackColor={{ false: colors.line, true: colors.accentBorder }}
                  thumbColor={learner.active ? colors.primary : colors.muted}
                  ios_backgroundColor={colors.line}
                />
              ) : (
                !learner.active && (
                  <ActionPill label="Make active" busy={busy} disabled={inCooldown} onPress={() => void update(learner, { active: true })} />
                )
              )}
            </Row>
          );
        })}
        <Row label="Another language" onPress={openAdd}>
          <View style={styles.addIcon}><Ionicons name="add" size={18} color={colors.primary} /></View>
        </Row>
        {!unlimited && inCooldown && cooldownUntil && (
          <Text style={styles.note}>
            You can change your active language once a month. Next change available {cooldownUntil.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.
          </Text>
        )}
        {!profile?.premium && (
          <LimitLine linkLabel={learners.length > 1 ? 'Upgrade' : 'Add more'} onPress={() => setWallVisible(true)}>
            {learners.length > 1
              ? 'Premium runs three at once. Yours come back exactly as you left them.'
              : 'Free covers one language at a time.'}
          </LimitLine>
        )}
      </Section>

      {/* D9: the closed control is a code; the open list carries the sentence beside each code. */}
      <Sheet visible={levelFor !== null} onClose={() => setLevelFor(null)}>
        <Text style={styles.sheetTitle}>{levelFor ? `How much ${languageName(levelFor.language)} can you read?` : ''}</Text>
        <View accessibilityRole="radiogroup" style={styles.levelList}>
          {levels.map((level) => {
            const selected = levelFor?.selfReportedLevel === level;
            return (
              <Pressable
                key={level}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (levelFor && !selected) void update(levelFor, { level });
                  setLevelFor(null);
                }}
                style={[styles.levelRow, selected && styles.levelRowSelected]}>
                <Text style={[styles.levelCode, selected && styles.levelCodeSelected]}>{level}</Text>
                <Text style={styles.levelSentence}>{levelSentences[level]}</Text>
              </Pressable>
            );
          })}
        </View>
        {levelFor?.active && learners.length > 1 && (
          <Pressable
            accessibilityRole="button"
            disabled={busyLanguage === levelFor.language}
            onPress={() => void remove(levelFor)}
            style={styles.removeAction}>
            <Text style={styles.removeText}>Remove {languageName(levelFor.language)} and everything kept in it</Text>
          </Pressable>
        )}
      </Sheet>

      {/* D4: eight hues, no free choice. */}
      <Sheet visible={colourFor !== null} onClose={() => setColourFor(null)}>
        <Text style={styles.sheetTitle}>{colourFor ? languageName(colourFor) : ''}</Text>
        <Text style={styles.note}>The colour of its rail and its record. Eight, all at one weight, so no language shouts louder than another.</Text>
        <View style={styles.swatches}>
          {languageColours.map((colour) => {
            const selected = colourFor ? crestFor(colourFor) === colour.hex : false;
            return (
              <Pressable
                key={colour.hex}
                accessibilityRole="radio"
                accessibilityLabel={colour.name}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (colourFor) void setCrest(colourFor, colour.hex);
                  setColourFor(null);
                }}
                style={[styles.swatchTile, selected && styles.swatchTileSelected]}>
                <View style={[styles.swatchLarge, { backgroundColor: colour.hex }]} />
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Sheet visible={fluentVisible} onClose={() => setFluentVisible(false)}>
        <Text style={styles.sheetTitle}>Languages you know</Text>
        <Text style={styles.note}>Translations and parallel texts come in these.</Text>
        <View style={styles.chips}>
          {sortLanguages(languagesQuery.data ?? [])
            .filter((code) => !learners.some((learner) => learner.language === code))
            .map((code) => {
              const selected = fluentDraft.includes(code);
              const full = !selected && fluentDraft.length >= fluentLimit;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: full }}
                  disabled={full}
                  onPress={() => setFluentDraft((current) => selected ? current.filter((entry) => entry !== code) : [...current, code])}
                  style={[styles.neutralChip, selected && styles.chipSelected, full && styles.chipDisabled]}>
                  <Text style={[styles.neutralChipText, selected && styles.chipTextSelected]}>{languageName(code)}</Text>
                </Pressable>
              );
            })}
        </View>
        {!profile?.premium && <LimitLine linkLabel="Add more" onPress={() => { setFluentVisible(false); setWallVisible(true); }}>Free covers {fluentLimit === 1 ? 'one fluent language' : `${fluentLimit} fluent languages`}.</LimitLine>}
        <Button loading={savingFluent} disabled={!fluentDraft.length} onPress={() => void saveFluent()}>Save</Button>
      </Sheet>

      {/* D2: pick, then place. Level optional, A1 pre-chosen. */}
      <Sheet visible={addVisible} onClose={() => setAddVisible(false)}>
        {addStep === 'pick' ? (
          <>
            <Text style={styles.sheetTitle}>Add a language</Text>
            <Text style={styles.note}>Step 1 of 2 · {learners.length} of {targetLimit} slots used</Text>
            <TextInput
              value={addSearch}
              onChangeText={setAddSearch}
              placeholder="Type to search…"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={styles.search}
            />
            <View style={styles.pickList}>
              {addable.slice(0, 40).map((code) => {
                const selected = addLanguage === code;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setAddLanguage(code)}
                    style={[styles.pickRow, selected && styles.pickRowSelected]}>
                    <Text style={styles.pickCode}>{code}</Text>
                    <View style={styles.pickCopy}>
                      <Text style={styles.pickName}>{languageName(code)}</Text>
                      <Text style={styles.pickFeatures}>{languageFeatures[code] ?? 'Core features'}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
            <Button disabled={!addLanguage} onPress={() => setAddStep('place')}>Continue</Button>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Where are you now?</Text>
            <Text style={styles.note}>Step 2 of 2 · change it any time</Text>
            <View style={styles.levelList}>
              {levels.map((level) => {
                const selected = addLevel === level;
                return (
                  <Pressable key={level} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setAddLevel(level)} style={[styles.levelRow, selected && styles.levelRowSelected]}>
                    <Text style={[styles.levelCode, selected && styles.levelCodeSelected]}>{level}</Text>
                    <Text style={styles.levelSentence}>{levelSentences[level]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.note}>Not sure? Leave it at A1 — you can move it from this tab whenever you like.</Text>
            <Button loading={adding} onPress={() => void submitAdd()}>Start learning</Button>
          </>
        )}
      </Sheet>

      <PaywallModal context="second-language" visible={wallVisible} onClose={() => setWallVisible(false)} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  tab: { gap: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  neutralChip: { minHeight: 36, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  neutralChipText: { color: colors.ink, fontSize: 13, fontWeight: '500' },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  chipTextSelected: { color: colors.primary },
  chipDisabled: { opacity: 0.5 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  levelPill: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  levelPillText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  addIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  levelList: { gap: 4 },
  levelRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  levelRowSelected: { backgroundColor: colors.accentSoft },
  levelCode: { width: 28, color: colors.metadata, fontSize: 12, fontWeight: '600' },
  levelCodeSelected: { color: colors.primary },
  levelSentence: { flex: 1, color: colors.ink, fontFamily: fonts.serifRegular, fontSize: 15, lineHeight: 21 },
  removeAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchTile: { padding: 4, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  swatchTileSelected: { borderColor: colors.primary },
  swatchLarge: { width: 40, height: 40, borderRadius: 20 },
  search: { minHeight: 48, borderRadius: 999, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 15 },
  pickList: { gap: 4 },
  pickRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  pickRowSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  pickCode: { width: 34, color: colors.metadata, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  pickCopy: { flex: 1, gap: 2 },
  pickName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  pickFeatures: { color: colors.metadata, fontSize: 11.5 },
}));
