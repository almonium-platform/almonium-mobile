import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AvatarMark } from '@/components/avatar-mark';
import { BrandMark } from '@/components/brand-mark';
import { Screen } from '@/components/screen';
import { Button, Card, Field, Title } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName, sortLanguages } from '@/src/languages';
import { createThemedStyles, useTheme } from '@/src/theme';
import type { CefrLevel, SetupStep } from '@/src/types';

const steps: SetupStep[] = ['WELCOME', 'LANGUAGES', 'LEVEL', 'INTERESTS', 'PROFILE', 'GREETING'];
const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const levelCopy: Record<CefrLevel, string> = {
  A1: 'I know some words and set phrases.',
  A2: 'I follow short sentences about familiar things.',
  B1: 'I can get through a simple story with regular lookups.',
  B2: 'I can follow a novel with a dictionary nearby.',
  C1: 'I read fluently and stop at unusual or literary words.',
  C2: 'I read almost anything, including specialised prose.',
};

const copy: Record<SetupStep, { eyebrow: string; title: string; description: string }> = {
  WELCOME: {
    eyebrow: 'WELCOME',
    title: 'Your next language lives in stories.',
    description: 'A quick setup will shape your library around what you know and what you want to learn.',
  },
  LANGUAGES: {
    eyebrow: 'LANGUAGES',
    title: 'Build your first shelf.',
    description: 'Tell us one language you know and one you are learning. You can add more later.',
  },
  LEVEL: {
    eyebrow: 'LEVEL',
    title: 'How much can you read?',
    description: 'Choose the closest description. This only tunes your first shelf and can change later.',
  },
  PROFILE: {
    eyebrow: 'PROFILE',
    title: 'What should readers call you?',
    description: 'Keep the generated name or choose something memorable. You can change it later.',
  },
  INTERESTS: {
    eyebrow: 'INTERESTS',
    title: 'Tune your recommendations.',
    description: 'Pick anything you enjoy—or skip this for now.',
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

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { profile, refreshProfile, logOut } = useAuth();
  const step = profile?.setupStep || 'WELCOME';
  const [busy, setBusy] = useState(false);
  const [fluentLanguage, setFluentLanguage] = useState(profile?.fluentLangs[0] || '');
  const [targetLanguage, setTargetLanguage] = useState(profile?.learners[0]?.language || '');
  const [level, setLevel] = useState<CefrLevel>(profile?.learners[0]?.selfReportedLevel || 'A1');
  const [username, setUsername] = useState(profile?.username || '');
  const [selectedInterests, setSelectedInterests] = useState<number[]>(
    profile?.interests.map((interest) => interest.id) || [],
  );
  const [errorMessage, setErrorMessage] = useState('');

  const languagesQuery = useQuery({
    queryKey: ['supported-languages'],
    queryFn: api.supportedLanguages,
    staleTime: Infinity,
  });
  const interestsQuery = useQuery({
    queryKey: ['interests'],
    queryFn: api.interests,
    staleTime: Infinity,
  });
  const languageCodes = useMemo(
    () => sortLanguages(languagesQuery.data || []),
    [languagesQuery.data],
  );

  useEffect(() => {
    if (step === 'COMPLETED') router.replace('/(tabs)/home');
  }, [step]);

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

  async function saveLevel() {
    const language = profile?.learners[0]?.language || targetLanguage;
    if (!language) return;
    await run(() => api.setupLevels([{ language, cefrLevel: level }]));
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

  return (
    <Screen>
      <View style={styles.topbar}>
        <View style={styles.wordmark}>
          <BrandMark size={36} />
          <Text style={styles.logo}>ALMONIUM</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progress, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
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
              <Text style={styles.featureTitle}>Real books, matched to your level</Text>
              <Text style={styles.featureText}>Read with progress tracking and parallel translations.</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <Ionicons name="trending-up-outline" size={25} color={colors.primary} />
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>A library that grows with you</Text>
              <Text style={styles.featureText}>Adjust your CEFR level whenever your confidence changes.</Text>
            </View>
          </View>
          <Button loading={busy} onPress={() => completeSimple('WELCOME')}>
            Set up my library
          </Button>
        </Card>
      )}

      {step === 'LANGUAGES' && (
        <Card>
          <Text style={styles.label}>I already know</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={fluentLanguage} onValueChange={setFluentLanguage}>
              <Picker.Item label="Choose a fluent language…" value="" />
              {languageCodes.map((code) => (
                <Picker.Item key={code} label={languageName(code)} value={code} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>I want to read in</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={targetLanguage} onValueChange={setTargetLanguage}>
              <Picker.Item label="Choose a target language…" value="" />
              {languageCodes
                .filter((code) => code !== fluentLanguage)
                .map((code) => (
                  <Picker.Item key={code} label={languageName(code)} value={code} />
                ))}
            </Picker>
          </View>
          <Button
            loading={busy}
            disabled={!fluentLanguage || !targetLanguage || languagesQuery.isLoading}
            onPress={saveLanguages}>
            Continue
          </Button>
        </Card>
      )}

      {step === 'LEVEL' && (
        <Card>
          <View style={styles.levelOptions}>
            {levels.map((candidate) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: level === candidate }}
                key={candidate}
                onPress={() => setLevel(candidate)}
                style={[styles.levelOption, level === candidate && styles.levelOptionActive]}>
                <Text style={[styles.levelCode, level === candidate && styles.levelCodeActive]}>
                  {candidate}
                </Text>
                <Text style={styles.levelDescription}>{levelCopy[candidate]}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setLevel('B1')} style={styles.unsureAction}>
            <Text style={styles.unsureText}>I’m not sure — start me at B1</Text>
          </Pressable>
          <Button loading={busy} onPress={saveLevel}>Use {level}</Button>
        </Card>
      )}

      {step === 'PROFILE' && (
        <Card>
          <View style={styles.profileMark}><AvatarMark premium={profile?.premium} size={72} /></View>
          <Field
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            maxLength={20}
            autoCapitalize="none"
          />
          <Text style={styles.finePrint}>3–20 letters, numbers, or underscores.</Text>
          <Button
            loading={busy}
            disabled={!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())}
            onPress={() => completeSimple('PROFILE')}>
            Continue
          </Button>
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
                  onPress={() =>
                    setSelectedInterests((current) =>
                      selected
                        ? current.filter((id) => id !== interest.id)
                        : [...current, interest.id],
                    )
                  }
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {interest.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button loading={busy} onPress={saveInterests}>
            {selectedInterests.length ? 'Continue' : 'Skip for now'}
          </Button>
        </Card>
      )}

      {step === 'GREETING' && (
        <Card>
          <View style={styles.greetingMark}>
            <BrandMark size={116} />
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
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { color: colors.primary, fontSize: 13, fontWeight: '600', letterSpacing: 2 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { alignSelf: 'flex-end', color: colors.metadata, fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  intro: { gap: 10, paddingVertical: 10 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  feature: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  featureCopy: { flex: 1, gap: 3 },
  featureTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  featureText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finePrint: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pickerFrame: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.nested },
  levels: { flexDirection: 'row', gap: 6 },
  level: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  levelActive: { backgroundColor: colors.primary },
  levelText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  levelTextActive: { color: colors.onPrimary },
  levelOptions: { gap: 7 },
  levelOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 10 },
  levelOptionActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  levelCode: { width: 30, color: colors.muted, fontWeight: '600' },
  levelCodeActive: { color: colors.primary },
  levelDescription: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18 },
  unsureAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  unsureText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  profileMark: { alignSelf: 'center' },
  greetingMark: { alignItems: 'center', paddingVertical: 8 },
  greetingCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorSurface: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.onPrimary },
}));
