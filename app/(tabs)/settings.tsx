import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Field, Title } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { colors } from '@/src/theme';
import type { CefrLevel, Learner } from '@/src/types';

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function LanguageRow({
  learner,
  onChanged,
}: {
  learner: Learner;
  onChanged(): Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function update(updates: { active?: boolean; level?: CefrLevel }) {
    setSaving(true);
    try {
      await api.updateLearner(learner.language, updates);
      await onChanged();
    } catch (error) {
      Alert.alert('Could not update language', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.language, saving && styles.saving]}>
      <View style={styles.languageHeading}>
        <View>
          <Text style={styles.languageName}>{learner.language.toUpperCase()}</Text>
          <Text style={styles.caption}>{learner.active ? 'Shown in your library' : 'Paused'}</Text>
        </View>
        <Switch
          value={learner.active}
          onValueChange={(active) => update({ active })}
          trackColor={{ false: colors.line, true: colors.primary }}
        />
      </View>
      <View style={styles.levels}>
        {levels.map((level) => (
          <Pressable
            key={level}
            onPress={() => update({ level })}
            style={[styles.level, learner.selfReportedLevel === level && styles.levelActive]}>
            <Text
              style={[
                styles.levelText,
                learner.selfReportedLevel === level && styles.levelTextActive,
              ]}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { profile, refreshProfile, logOut } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(profile?.username || '');
  const [savingName, setSavingName] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => setUsername(profile?.username || ''), [profile?.username]);

  async function changed() {
    await refreshProfile();
    await queryClient.invalidateQueries({ queryKey: ['bookshelf'] });
  }

  async function saveUsername() {
    setSavingName(true);
    try {
      await api.updateUsername(username.trim());
      await changed();
    } catch (error) {
      Alert.alert('Could not save username', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingName(false);
    }
  }

  async function togglePrivacy(hidden: boolean) {
    setSavingPrivacy(true);
    try {
      await api.updatePrivacy(hidden);
      await changed();
    } catch (error) {
      Alert.alert('Could not update privacy', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function signOut() {
    await logOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.username || profile?.email || 'A')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headingCopy}>
          <Title>{profile?.username || 'Your profile'}</Title>
          <Text style={styles.caption}>{profile?.email}</Text>
        </View>
      </View>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="person-outline" color={colors.primary} size={20} />
          <Text style={styles.sectionTitleText}>Profile</Text>
        </View>
        <Field
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
          maxLength={20}
        />
        <Button
          variant="secondary"
          loading={savingName}
          disabled={username.trim().length < 3 || username.trim() === profile?.username}
          onPress={saveUsername}>
          Save username
        </Button>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Private profile</Text>
            <Text style={styles.caption}>Hide your profile from other readers.</Text>
          </View>
          <Switch
            disabled={savingPrivacy}
            value={profile?.hidden ?? false}
            onValueChange={togglePrivacy}
            trackColor={{ false: colors.line, true: colors.primary }}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="language-outline" color={colors.primary} size={20} />
          <Text style={styles.sectionTitleText}>Reading languages</Text>
        </View>
        <Text style={styles.caption}>
          Set your level and choose which shelves are active. Book recommendations update automatically.
        </Text>
        {profile?.learners.map((learner) => (
          <LanguageRow key={learner.id} learner={learner} onChanged={changed} />
        ))}
        {!profile?.learners.length && (
          <Text style={styles.caption}>Add your first target language in the web app.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="sparkles-outline" color={colors.gold} size={20} />
          <Text style={styles.sectionTitleText}>Account</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.settingLabel}>Reading streak</Text>
          <Text style={styles.stat}>{profile?.streak ?? 0} days</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.settingLabel}>Plan</Text>
          <Text style={styles.stat}>{profile?.premium ? 'Premium' : 'Free'}</Text>
        </View>
        <Button variant="danger" onPress={signOut}>
          Sign out
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  headingCopy: { flex: 1, gap: 3 },
  avatar: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarText: { color: colors.white, fontWeight: '900', fontSize: 24 },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleText: { color: colors.ink, fontWeight: '800', fontSize: 18 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  settingCopy: { flex: 1, gap: 2 },
  settingLabel: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  language: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, gap: 12 },
  languageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  languageName: { color: colors.ink, fontWeight: '900', fontSize: 16, letterSpacing: 0.8 },
  levels: { flexDirection: 'row', gap: 6 },
  level: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  levelActive: { backgroundColor: colors.primary },
  levelText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  levelTextActive: { color: colors.white },
  saving: { opacity: 0.6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  stat: { color: colors.primary, fontWeight: '800' },
});
