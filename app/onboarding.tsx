import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarPicker } from '@/components/avatar-picker';
import { BrandMark } from '@/components/brand-mark';
import { Screen } from '@/components/screen';
import { Button, Card, Field, Title } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName, sortLanguages } from '@/src/languages';
import { colors } from '@/src/theme';
import type { CefrLevel, SetupStep } from '@/src/types';

const steps: SetupStep[] = ['WELCOME', 'PLAN', 'LANGUAGES', 'PROFILE', 'INTERESTS'];
const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const copy: Record<SetupStep, { eyebrow: string; title: string; description: string }> = {
  WELCOME: {
    eyebrow: 'WELCOME',
    title: 'Your next language lives in stories.',
    description: 'A quick setup will shape your library around what you know and what you want to learn.',
  },
  PLAN: {
    eyebrow: 'YOUR PLAN',
    title: 'Start with the essentials.',
    description: 'The free plan includes one target language, daily reading, flashcards, and basic games.',
  },
  LANGUAGES: {
    eyebrow: 'LANGUAGES',
    title: 'Build your first shelf.',
    description: 'Tell us one language you know and one you are learning. You can add more later.',
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
  COMPLETED: {
    eyebrow: 'READY',
    title: 'Your shelf is ready.',
    description: 'Time to find your first book.',
  },
};

export default function OnboardingScreen() {
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
    if (step === 'COMPLETED') router.replace('/(tabs)/books');
  }, [step]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refreshProfile();
    } catch (error) {
      Alert.alert('Setup could not continue', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function completeSimple(currentStep: 'WELCOME' | 'PLAN' | 'PROFILE') {
    await run(async () => {
      if (currentStep === 'PROFILE' && username.trim() !== profile?.username) {
        await api.updateUsername(username.trim());
      }
      await api.completeOnboardingStep(currentStep);
    });
  }

  async function saveLanguages() {
    await run(() => api.setupLanguages([fluentLanguage], targetLanguage, level));
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

      {step === 'PLAN' && (
        <Card>
          {['One target language', 'One story a day', '100 card reviews a day', 'Basic games'].map(
            (feature) => (
              <View key={feature} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={21} color={colors.primary} />
                <Text style={styles.featureTitle}>{feature}</Text>
              </View>
            ),
          )}
          <Button loading={busy} onPress={() => completeSimple('PLAN')}>
            Continue with free
          </Button>
          <Text style={styles.finePrint}>No card required. Premium can wait until you need it.</Text>
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
          <Text style={styles.label}>My current level</Text>
          <View style={styles.levels}>
            {levels.map((candidate) => (
              <Pressable
                key={candidate}
                onPress={() => setLevel(candidate)}
                style={[styles.level, level === candidate && styles.levelActive]}>
                <Text style={[styles.levelText, level === candidate && styles.levelTextActive]}>
                  {candidate}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            loading={busy}
            disabled={!fluentLanguage || !targetLanguage || languagesQuery.isLoading}
            onPress={saveLanguages}>
            Create my shelf
          </Button>
        </Card>
      )}

      {step === 'PROFILE' && (
        <Card>
          <View style={styles.profileMark}>
            {profile?.avatarUrl ? (
              <Image source={profile.avatarUrl} style={styles.profileImage} contentFit="cover" />
            ) : (
              <Text style={styles.profileMarkText}>{(username || 'A')[0].toUpperCase()}</Text>
            )}
          </View>
          <AvatarPicker currentAvatarUrl={profile?.avatarUrl ?? null} onChanged={refreshProfile} />
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
            {selectedInterests.length ? 'Finish setup' : 'Skip and finish'}
          </Button>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { color: colors.primary, fontSize: 13, fontWeight: '600', letterSpacing: 2 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.reading },
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
  pickerFrame: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.white },
  levels: { flexDirection: 'row', gap: 6 },
  level: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  levelActive: { backgroundColor: colors.primary },
  levelText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  levelTextActive: { color: colors.white },
  profileMark: { width: 72, height: 72, borderRadius: 24, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, overflow: 'hidden' },
  profileImage: { width: '100%', height: '100%' },
  profileMarkText: { color: colors.primaryDark, fontSize: 30, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.white },
});
