import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AvatarPicker } from '@/components/avatar-picker';
import { BrandMark } from '@/components/brand-mark';
import { Screen } from '@/components/screen';
import { languageFeatures, levelSentences, levels } from '@/components/settings/learning-tab';
import { Sheet } from '@/components/sheet';
import { Button, Card, Field, Title } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName, sortLanguages } from '@/src/languages';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import type { CefrLevel, SetupStep } from '@/src/types';

const steps: SetupStep[] = ['WELCOME', 'LANGUAGES', 'LEVEL', 'INTERESTS', 'PROFILE', 'GREETING'];
/** Target first and large, in cards. The rest is one search away. */
const featuredLanguages = ['DE', 'EN', 'FR', 'ES', 'PL'];

const copy: Record<SetupStep, { eyebrow: string; title: string; description: string }> = {
  WELCOME: {
    eyebrow: 'WELCOME',
    title: 'Your next language lives in stories.',
    description: 'A short setup shapes your shelf around what you know and what you are learning. No plan to pick, nothing to pay.',
  },
  LANGUAGES: {
    eyebrow: 'LANGUAGES',
    title: 'What are you learning?',
    description: 'Pick one to begin. You can add more later.',
  },
  LEVEL: {
    eyebrow: 'LEVEL',
    title: 'How much can you read?',
    description: 'Pick whichever sounds most like you. You can change it whenever you like.',
  },
  INTERESTS: {
    eyebrow: 'INTERESTS',
    title: 'Tune your recommendations.',
    description: 'Pick anything you enjoy — or skip this for now.',
  },
  PROFILE: {
    eyebrow: 'PROFILE',
    title: 'Make it yours.',
    description: 'Both are already set — continue to keep them.',
  },
  GREETING: {
    eyebrow: 'READY',
    title: 'That’s everything. Let’s open a book.',
    description: 'Almo will be around when a shelf is empty or something needs another try.',
  },
  COMPLETED: {
    eyebrow: 'READY',
    title: 'Your shelf is ready.',
    description: 'Time to find your first book.',
  },
};

/** The device locale is a guess at the reading-from language; it is admin, not choice. */
function detectedLanguage(supported: string[]) {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const code = locale.split(/[-_]/)[0]?.toUpperCase();
    return code && supported.includes(code) ? code : '';
  } catch {
    return '';
  }
}

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { profile, refreshProfile, logOut } = useAuth();
  const step = profile?.setupStep || 'WELCOME';
  const [busy, setBusy] = useState(false);
  const [fluentLanguage, setFluentLanguage] = useState(profile?.fluentLangs[0] || '');
  const [targetLanguage, setTargetLanguage] = useState(profile?.learners[0]?.language || '');
  const [level, setLevel] = useState<CefrLevel>(profile?.learners[0]?.selfReportedLevel || 'B1');
  const [username, setUsername] = useState(profile?.username || '');
  const [selectedInterests, setSelectedInterests] = useState<number[]>(profile?.interests.map((interest) => interest.id) || []);
  const [errorMessage, setErrorMessage] = useState('');
  const [picker, setPicker] = useState<'target' | 'fluent' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const languagesQuery = useQuery({ queryKey: ['supported-languages'], queryFn: api.supportedLanguages, staleTime: Infinity });
  const interestsQuery = useQuery({ queryKey: ['interests'], queryFn: api.interests, staleTime: Infinity });
  const languageCodes = useMemo(() => sortLanguages(languagesQuery.data || []), [languagesQuery.data]);

  useEffect(() => {
    if (step === 'COMPLETED') router.replace('/(tabs)/home');
  }, [step]);

  useEffect(() => {
    if (!fluentLanguage && languagesQuery.data) {
      const detected = detectedLanguage(languagesQuery.data);
      if (detected && detected !== targetLanguage) setFluentLanguage(detected);
    }
  }, [fluentLanguage, languagesQuery.data, targetLanguage]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setErrorMessage('');
    try {
      await action();
      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Setup could not continue. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function completeSimple(currentStep: 'WELCOME' | 'PROFILE' | 'GREETING') {
    await run(async () => {
      if (currentStep === 'PROFILE' && username.trim() !== profile?.username) {
        await api.updateUsername(username.trim());
      }
      await api.completeOnboardingStep(currentStep);
    });
  }

  async function saveLanguages() {
    await run(() => api.setupLanguages([fluentLanguage], targetLanguage, 'B1'));
  }

  async function saveLevel(chosen: CefrLevel = level) {
    const language = profile?.learners[0]?.language || targetLanguage;
    if (!language) return;
    await run(() => api.setupLevels([{ language, cefrLevel: chosen }]));
  }

  async function saveInterests() {
    await run(() => api.setupInterests(selectedInterests));
  }

  async function signOut() {
    await logOut();
    router.replace('/(auth)/sign-in');
  }

  const currentCopy = copy[step];
  const stepIndex = Math.max(0, steps.indexOf(step));
  const targetChoices = useMemo(() => {
    const featured = featuredLanguages.filter((code) => languageCodes.includes(code));
    const extra = targetLanguage && !featured.includes(targetLanguage) ? [targetLanguage] : [];
    return [...featured, ...extra];
  }, [languageCodes, targetLanguage]);
  const pickerList = useMemo(
    () =>
      languageCodes.filter(
        (code) =>
          (picker === 'target' ? code !== fluentLanguage : code !== targetLanguage) &&
          (!pickerSearch.trim() || languageName(code).toLowerCase().includes(pickerSearch.trim().toLowerCase()) || code.toLowerCase().includes(pickerSearch.trim().toLowerCase())),
      ),
    [fluentLanguage, languageCodes, picker, pickerSearch, targetLanguage],
  );

  return (
    <Screen>
      <View style={styles.topbar}>
        <View style={styles.wordmark}>
          <BrandMark size={36} />
          <Text style={styles.logo}>ALMONIUM</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={12} accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>
      {/* A labelled step plank, never blades and never a hue off the ramp. */}
      <View style={styles.planks}>
        {steps.map((item, index) => (
          <View key={item} style={[styles.plank, index <= stepIndex && styles.plankDone]} />
        ))}
      </View>
      <Text style={styles.progressLabel}>STEP {Math.min(stepIndex + 1, steps.length)} OF {steps.length}</Text>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{currentCopy.eyebrow}</Text>
        <Title>{currentCopy.title}</Title>
        <Text style={styles.description}>{currentCopy.description}</Text>
      </View>

      {step === 'WELCOME' && (
        <Card>
          <View style={styles.feature}>
            <Ionicons name="book-outline" size={25} color={colors.primary} />
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>Real books, with the translation beside them</Text>
              <Text style={styles.featureText}>Tap any word to understand it. Keep the ones worth remembering.</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <Ionicons name="repeat-outline" size={25} color={colors.primary} />
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>Short reviews, on a schedule that follows you</Text>
              <Text style={styles.featureText}>Ten cards make a session. Nothing is lost by stopping.</Text>
            </View>
          </View>
          <Button loading={busy} onPress={() => completeSimple('WELCOME')}>Set up my shelf</Button>
        </Card>
      )}

      {step === 'LANGUAGES' && (
        <Card>
          <View style={styles.languageCards}>
            {targetChoices.map((code) => {
              const selected = targetLanguage === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setTargetLanguage(code)}
                  style={[styles.languageCard, selected && styles.languageCardSelected]}>
                  <Text style={[styles.languageCode, selected && styles.languageCodeSelected]}>{code}</Text>
                  <View style={styles.languageCopy}>
                    <Text style={styles.languageName}>{languageName(code)}</Text>
                    <Text style={styles.languageFeatures}>{languageFeatures[code] ?? 'Core features'}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={() => { setPicker('target'); setPickerSearch(''); }}
              style={[styles.languageCard, styles.languageCardDashed]}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <View style={styles.languageCopy}>
                <Text style={styles.languageName}>Another language</Text>
                <Text style={styles.languageFeatures}>Search all</Text>
              </View>
            </Pressable>
          </View>
          <Text style={styles.readingFrom}>
            Reading from{' '}
            <Text style={styles.readingFromValue}>{fluentLanguage ? languageName(fluentLanguage) : 'a language you know'}</Text>
            {' — '}
            <Text onPress={() => { setPicker('fluent'); setPickerSearch(''); }} style={styles.link}>
              {fluentLanguage ? 'detected, change it' : 'choose it'}
            </Text>
          </Text>
          <Text style={styles.finePrint}>
            {targetLanguage && languageFeatures[targetLanguage]
              ? `${languageName(targetLanguage)} adds lexemes, frequency data and prepared decks. Every language has translation, lookups, review and statistics.`
              : 'Every language has translation, lookups, review and statistics.'}
          </Text>
          <Text style={styles.finePrint}>Free covers one language at a time.</Text>
          <Button loading={busy} disabled={!fluentLanguage || !targetLanguage || languagesQuery.isLoading} onPress={saveLanguages}>
            Continue
          </Button>
        </Card>
      )}

      {step === 'LEVEL' && (
        <Card>
          <View style={styles.levelOptions}>
            {levels.map((candidate) => {
              const selected = level === candidate;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={candidate}
                  onPress={() => setLevel(candidate)}
                  style={[styles.levelOption, selected && styles.levelOptionActive]}>
                  <Text style={[styles.levelCode, selected && styles.levelCodeActive]}>{candidate}</Text>
                  <Text style={styles.levelDescription}>{levelSentences[candidate]}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
            {/* A dashed sibling rather than a link, so it reads as a legitimate answer. */}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => { setLevel('B1'); void saveLevel('B1'); }}
              style={[styles.levelOption, styles.levelOptionDashed]}>
              <Text style={styles.levelCode}>?</Text>
              <View style={styles.languageCopy}>
                <Text style={styles.levelDescription}>I’m not sure — start me at B1.</Text>
                <Text style={styles.finePrintLeft}>Books at B1 are a fair first test. Change it any time in Settings.</Text>
              </View>
            </Pressable>
          </View>
          <Button loading={busy} onPress={() => void saveLevel()}>Continue</Button>
        </Card>
      )}

      {step === 'INTERESTS' && (
        <Card>
          <View style={styles.chips}>
            {interestsQuery.data?.map((interest) => {
              const selected = selectedInterests.includes(interest.id);
              return (
                <Pressable
                  key={interest.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    setSelectedInterests((current) =>
                      selected ? current.filter((id) => id !== interest.id) : [...current, interest.id],
                    )
                  }
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{interest.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button loading={busy} onPress={saveInterests}>
            {selectedInterests.length ? 'Continue' : 'Skip for now'}
          </Button>
        </Card>
      )}

      {step === 'PROFILE' && (
        <Card>
          <AvatarPicker tileSize={52} gap={6} />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <Field value={username} onChangeText={setUsername} placeholder="Username" maxLength={20} autoCapitalize="none" />
            <Text style={styles.finePrintLeft}>3–20 letters, numbers or underscores. Only used if you share a word pack.</Text>
          </View>
          <Button
            loading={busy}
            disabled={!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())}
            onPress={() => completeSimple('PROFILE')}>
            Continue
          </Button>
        </Card>
      )}

      {step === 'GREETING' && (
        <Card>
          <View style={styles.greetingMark}>
            <Image source={require('../assets/images/almo-offering.png')} contentFit="contain" style={styles.almo} />
          </View>
          <Text style={styles.greetingCopy}>
            {languageName(profile?.learners[0]?.language || targetLanguage)}, {profile?.learners[0]?.selfReportedLevel || level}, {profile?.interests.length || 0} {(profile?.interests.length || 0) === 1 ? 'interest' : 'interests'}. You can change any of it later.
          </Text>
          <Button loading={busy} onPress={() => completeSimple('GREETING')}>Open my shelf</Button>
        </Card>
      )}

      {!!errorMessage && (
        <View accessibilityRole="alert" style={styles.errorSurface}>
          <Ionicons name="alert-circle-outline" size={21} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Sheet visible={picker !== null} onClose={() => setPicker(null)}>
        <Text style={styles.sheetTitle}>{picker === 'target' ? 'What are you learning?' : 'What do you read from?'}</Text>
        <TextInput
          value={pickerSearch}
          onChangeText={setPickerSearch}
          placeholder="Type a language or code"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          style={styles.search}
        />
        <View style={styles.pickList}>
          {pickerList.slice(0, 60).map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              onPress={() => {
                if (picker === 'target') setTargetLanguage(code);
                else setFluentLanguage(code);
                setPicker(null);
              }}
              style={styles.pickRow}>
              <Text style={styles.pickCode}>{code}</Text>
              <Text style={styles.pickName}>{languageName(code)}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { color: colors.primary, fontSize: 13, fontWeight: '600', letterSpacing: 2 },
  planks: { flexDirection: 'row', gap: 4 },
  plank: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  plankDone: { backgroundColor: colors.primary },
  progressLabel: { alignSelf: 'flex-end', color: colors.metadata, fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  intro: { gap: 10, paddingVertical: 10 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  feature: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  featureCopy: { flex: 1, gap: 3 },
  featureTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  featureText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  finePrint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  finePrintLeft: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  fieldGroup: { gap: 7 },
  languageCards: { gap: 7 },
  languageCard: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface },
  languageCardSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  languageCardDashed: { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  languageCode: { width: 34, color: colors.metadata, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  languageCodeSelected: { color: colors.primary },
  languageCopy: { flex: 1, gap: 2 },
  languageName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  languageFeatures: { color: colors.metadata, fontSize: 11.5 },
  readingFrom: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  readingFromValue: { color: colors.ink, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '600' },
  levelOptions: { gap: 7 },
  levelOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12 },
  levelOptionActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  levelOptionDashed: { borderStyle: 'dashed', borderColor: colors.border },
  levelCode: { width: 28, color: colors.metadata, fontSize: 12, fontWeight: '600' },
  levelCodeActive: { color: colors.primary },
  levelDescription: { flex: 1, color: colors.ink, fontFamily: fonts.serifRegular, fontSize: 15, lineHeight: 21 },
  greetingMark: { alignItems: 'center', paddingVertical: 8 },
  almo: { width: 124, height: 130 },
  greetingCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorSurface: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.onPrimary },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  search: { minHeight: 48, borderRadius: 999, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 15 },
  pickList: { gap: 2 },
  pickRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10 },
  pickCode: { width: 34, color: colors.metadata, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  pickName: { color: colors.ink, fontSize: 15 },
}));
