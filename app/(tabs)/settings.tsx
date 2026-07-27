import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { AvatarPicker } from '@/components/avatar-picker';
import { PaywallModal } from '@/components/paywall-modal';
import { Button, Card, Field, Title } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { config } from '@/src/config';
import { languageName, sortLanguages } from '@/src/languages';
import { colors } from '@/src/theme';
import type { CefrLevel, Learner } from '@/src/types';

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function LanguageRow({
  learner,
  onChanged,
  canDelete,
  onDelete,
}: {
  learner: Learner;
  onChanged(): Promise<void>;
  canDelete: boolean;
  onDelete(): void;
}) {
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(learner.active);

  useEffect(() => setActive(learner.active), [learner.active]);

  async function update(updates: { active?: boolean; level?: CefrLevel }) {
    const previousActive = active;
    if (typeof updates.active === 'boolean') setActive(updates.active);
    setSaving(true);
    try {
      await api.updateLearner(learner.language, updates);
      await onChanged();
    } catch (error) {
      if (typeof updates.active === 'boolean') setActive(previousActive);
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
        <View style={styles.languageActions}>
          {canDelete && (
            <Pressable disabled={saving} onPress={onDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </Pressable>
          )}
          <Switch
            disabled={saving}
            value={active}
            onValueChange={(active) => update({ active })}
            trackColor={{ false: colors.line, true: colors.accentBorder }}
            thumbColor={active ? colors.primary : colors.muted}
            ios_backgroundColor={colors.line}
          />
        </View>
      </View>
      <View style={styles.levels}>
        {levels.map((level) => (
          <Pressable
            key={level}
            disabled={saving}
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
  const {
    firebaseUser,
    profile,
    refreshProfile,
    logOut,
    reauthenticateWithPassword,
    reauthenticateWithGoogle,
    reauthenticateWithApple,
  } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(profile?.username || '');
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyHidden, setPrivacyHidden] = useState(profile?.hidden ?? false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<number[]>(
    profile?.interests.map((interest) => interest.id) || [],
  );
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [newLevel, setNewLevel] = useState<CefrLevel>('A1');
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showDeletionAuth, setShowDeletionAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const usesPassword = firebaseUser?.providerData.some((provider) => provider.providerId === 'password');
  const usesGoogle = firebaseUser?.providerData.some((provider) => provider.providerId === 'google.com');
  const usesApple = firebaseUser?.providerData.some((provider) => provider.providerId === 'apple.com');
  const interestsQuery = useQuery({
    queryKey: ['interests'],
    queryFn: api.interests,
    staleTime: Infinity,
  });
  const languagesQuery = useQuery({
    queryKey: ['supported-languages'],
    queryFn: api.supportedLanguages,
    staleTime: Infinity,
  });

  useEffect(() => {
    setUsername(profile?.username || '');
    setEditingUsername(false);
  }, [profile?.username]);
  useEffect(() => setPrivacyHidden(profile?.hidden ?? false), [profile?.hidden]);
  useEffect(
    () => setSelectedInterests(profile?.interests.map((interest) => interest.id) || []),
    [profile?.interests],
  );

  async function changed() {
    await refreshProfile();
    await queryClient.invalidateQueries({ queryKey: ['bookshelf'] });
  }

  async function saveUsername() {
    setSavingName(true);
    try {
      await api.updateUsername(username.trim());
      await changed();
      setEditingUsername(false);
    } catch (error) {
      Alert.alert('Could not save username', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingName(false);
    }
  }

  function cancelUsernameEdit() {
    setUsername(profile?.username || '');
    setEditingUsername(false);
  }

  async function togglePrivacy(hidden: boolean) {
    const previousHidden = privacyHidden;
    setPrivacyHidden(hidden);
    setSavingPrivacy(true);
    try {
      await api.updatePrivacy(hidden);
      await changed();
    } catch (error) {
      setPrivacyHidden(previousHidden);
      Alert.alert('Could not update privacy', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function signOut() {
    await logOut();
    router.replace('/(auth)/sign-in');
  }

  async function saveInterests() {
    setSavingInterests(true);
    try {
      await api.updateInterests(selectedInterests);
      await changed();
    } catch (error) {
      Alert.alert('Could not save interests', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingInterests(false);
    }
  }

  async function addLanguage() {
    if (!newLanguage) return;
    setAddingLanguage(true);
    try {
      await api.addLearner(newLanguage, newLevel);
      setNewLanguage('');
      setShowAddLanguage(false);
      await changed();
    } catch (error) {
      Alert.alert('Could not add language', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAddingLanguage(false);
    }
  }

  function deleteLanguage(learner: Learner) {
    Alert.alert(
      `Remove ${languageName(learner.language)}?`,
      'Its flashcards and learning progress will also be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteLearner(learner.language);
              await changed();
            } catch (error) {
              Alert.alert('Could not remove language', error instanceof Error ? error.message : 'Try again.');
            }
          },
        },
      ],
    );
  }

  function confirmAccountDeletion() {
    if (usesPassword && !showDeletionAuth) {
      setShowDeletionAuth(true);
      return;
    }
    Alert.alert(
      'Delete your Almonium account?',
      'This permanently removes your profile, learning data, and Firebase login. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Final confirmation', 'Delete everything associated with this account?', [
              { text: 'Keep account', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (usesPassword) {
                      if (!currentPassword) {
                        Alert.alert(
                          'Password required',
                          'Enter your current password, then try again.',
                        );
                        return;
                      }
                      await reauthenticateWithPassword(currentPassword);
                    } else if (usesGoogle) {
                      await reauthenticateWithGoogle();
                    } else if (usesApple) {
                      await reauthenticateWithApple();
                    }
                    await api.deleteAccount();
                    const uid = firebaseUser?.uid;
                    if (uid) {
                      const reviewKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
                        key.startsWith(`almonium:review:${uid}:`),
                      );
                      if (reviewKeys.length) await AsyncStorage.multiRemove(reviewKeys);
                    }
                    setCurrentPassword('');
                    await logOut();
                    router.replace('/(auth)/sign-in');
                  } catch (error) {
                    Alert.alert(
                      'Could not delete account',
                      error instanceof Error
                        ? `${error.message}\n\n${usesPassword ? 'Check your current password and try again.' : usesGoogle ? 'Complete the Google confirmation and try again.' : usesApple ? 'Complete the Apple confirmation and try again.' : 'Sign out and back in with your provider, then try again.'}`
                        : 'Please sign out, sign back in, and try again.',
                    );
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <View style={styles.avatar}>
          {profile?.avatarUrl ? (
            <Image source={profile.avatarUrl} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{(profile?.username || profile?.email || 'A')[0].toUpperCase()}</Text>
          )}
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
        {editingUsername ? (
          <View style={styles.usernameEditor}>
            <View style={styles.usernameInputRow}>
              <Field
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
                autoFocus
                maxLength={20}
                style={styles.usernameField}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel username edit"
                disabled={savingName}
                hitSlop={8}
                onPress={cancelUsernameEdit}
                style={styles.usernameIconButton}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            {username.trim().length >= 3 && username.trim() !== profile?.username && (
              <Button loading={savingName} onPress={saveUsername}>
                Save username
              </Button>
            )}
          </View>
        ) : (
          <View style={styles.usernameRow}>
            <View style={styles.usernameCopy}>
              <Text style={styles.settingLabel}>Username</Text>
              <Text style={styles.caption}>@{profile?.username}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit username"
              hitSlop={8}
              onPress={() => setEditingUsername(true)}
              style={styles.usernameIconButton}>
              <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
        )}
        <AvatarPicker currentAvatarUrl={profile?.avatarUrl ?? null} onChanged={changed} />
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>Private profile</Text>
            <Text style={styles.caption}>Hide your profile from other readers.</Text>
          </View>
          <Switch
            disabled={savingPrivacy}
            value={privacyHidden}
            onValueChange={togglePrivacy}
            trackColor={{ false: colors.line, true: colors.accentBorder }}
            thumbColor={privacyHidden ? colors.primary : colors.muted}
            ios_backgroundColor={colors.line}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="heart-outline" color={colors.primary} size={20} />
          <Text style={styles.sectionTitleText}>Interests</Text>
        </View>
        <Text style={styles.caption}>These help Almonium shape future recommendations.</Text>
        <View style={styles.chips}>
          {interestsQuery.data?.map((interest) => {
            const selected = selectedInterests.includes(interest.id);
            return (
              <Pressable
                key={interest.id}
                disabled={savingInterests}
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
        <Button
          variant="secondary"
          loading={savingInterests}
          disabled={
            JSON.stringify([...selectedInterests].sort()) ===
            JSON.stringify([...(profile?.interests.map((interest) => interest.id) || [])].sort())
          }
          onPress={saveInterests}>
          Save interests
        </Button>
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
          <LanguageRow
            key={learner.id}
            learner={learner}
            onChanged={changed}
            canDelete={(profile?.learners.length || 0) > 1}
            onDelete={() => deleteLanguage(learner)}
          />
        ))}
        {!profile?.learners.length && (
          <Text style={styles.caption}>No target languages are configured for this account.</Text>
        )}
        {showAddLanguage ? (
          <View style={styles.addLanguage}>
            <View style={styles.pickerFrame}>
              <Picker selectedValue={newLanguage} onValueChange={setNewLanguage}>
                <Picker.Item label="Choose a language…" value="" />
                {sortLanguages(languagesQuery.data || [])
                  .filter(
                    (code) =>
                      !profile?.learners.some((learner) => learner.language === code) &&
                      !profile?.fluentLangs.includes(code),
                  )
                  .map((code) => (
                    <Picker.Item key={code} label={languageName(code)} value={code} />
                  ))}
              </Picker>
            </View>
            <View style={styles.levels}>
              {levels.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setNewLevel(level)}
                  style={[styles.level, newLevel === level && styles.levelActive]}>
                  <Text style={[styles.levelText, newLevel === level && styles.levelTextActive]}>
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button loading={addingLanguage} disabled={!newLanguage} onPress={addLanguage}>
              Add language
            </Button>
            <Button variant="secondary" onPress={() => setShowAddLanguage(false)}>
              Cancel
            </Button>
          </View>
        ) : !profile?.premium &&
          (profile?.learners.length || 0) >=
            (profile?.subscription.limits.MAX_TARGET_LANGS ?? 1) ? (
          <View style={styles.paywalledAction}>
            <Text style={styles.limitCopy}>
              Free plan lets you pick only{' '}
              {profile?.subscription.limits.MAX_TARGET_LANGS ?? 1} target language.
            </Text>
            <Button variant="premium" onPress={() => setShowPaywall(true)}>
              + Add target language
            </Button>
          </View>
        ) : (
          <Button
            variant="secondary"
            disabled={
              (profile?.learners.length || 0) >=
              (profile?.subscription.limits.MAX_TARGET_LANGS ?? 1)
            }
            onPress={() => setShowAddLanguage(true)}>
            Add target language
          </Button>
        )}
      </Card>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="sparkles-outline" color={colors.reading} size={20} />
          <Text style={styles.sectionTitleText}>Account</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.settingLabel}>Reading streak</Text>
          <Text style={styles.stat}>{profile?.streak ?? 0} days</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.settingLabel}>Plan</Text>
          <Text style={profile?.premium ? styles.premiumStat : styles.stat}>
            {profile?.premium ? 'Premium +' : 'Free'}
          </Text>
        </View>
        {!profile?.premium && (
          <Button variant="premium" onPress={() => setShowPaywall(true)}>
            + Upgrade to Premium
          </Button>
        )}
        {usesPassword && showDeletionAuth && (
          <View style={styles.dangerZone}>
            <Text style={styles.settingLabel}>Confirm sensitive changes</Text>
            <Text style={styles.caption}>
              Enter your current password to continue with permanent account deletion.
            </Text>
            <Field
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCurrentPassword('');
                setShowDeletionAuth(false);
              }}
              style={styles.cancelDeletion}>
              <Text style={styles.cancelDeletionText}>Cancel deletion</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(`${config.webBaseUrl}/privacy-policy`)}>
            <Text style={styles.legalText}>Privacy policy</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`${config.webBaseUrl}/terms-of-use`)}>
            <Text style={styles.legalText}>Terms of use</Text>
          </Pressable>
        </View>
        <Button variant="danger" onPress={signOut}>
          Sign out
        </Button>
        <Pressable onPress={confirmAccountDeletion} style={styles.deleteLink}>
          <Text style={styles.deleteText}>Delete account permanently</Text>
        </Pressable>
      </Card>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  headingCopy: { flex: 1, gap: 3 },
  avatar: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontWeight: '600', fontSize: 24 },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleText: { color: colors.ink, fontWeight: '600', fontSize: 18 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  settingCopy: { flex: 1, gap: 2 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  usernameCopy: { flex: 1, gap: 2 },
  usernameEditor: { gap: 10 },
  usernameInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usernameField: { flex: 1 },
  usernameIconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  language: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, gap: 12 },
  languageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  languageActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  languageName: { color: colors.ink, fontWeight: '600', fontSize: 16, letterSpacing: 0.8 },
  levels: { flexDirection: 'row', gap: 6 },
  level: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  levelActive: { backgroundColor: colors.primary },
  levelText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  levelTextActive: { color: colors.white },
  saving: { opacity: 0.6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  stat: { color: colors.primary, fontWeight: '600' },
  premiumStat: { color: colors.primary, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.white },
  deleteLink: { alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  addLanguage: { gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  pickerFrame: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.white },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 4 },
  legalText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  paywalledAction: { gap: 10 },
  limitCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  dangerZone: {
    gap: 7,
    borderRadius: 20,
    padding: 14,
    backgroundColor: colors.dangerSoft,
  },
  cancelDeletion: {
    minHeight: 44,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelDeletionText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
