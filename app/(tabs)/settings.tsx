import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { AvatarMark } from '@/components/avatar-mark';
import { PaywallModal } from '@/components/paywall-modal';
import { Button, Card, Field, Title } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useChat } from '@/src/chat-client';
import { config } from '@/src/config';
import { languageName, sortLanguages } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { configureDailyReminder, getReminderSettings, reminderTimeLabel } from '@/src/reminders';
import { createThemedStyles, useTheme, type AppearancePreference } from '@/src/theme';
import type { CefrLevel, Learner } from '@/src/types';

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const reminderHours = [18, 20, 21];

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
  const { colors } = useTheme();
  const styles = useStyles();
  const showNotice = useNotice();
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
      showNotice({ title: 'Could not update language', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
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
  const { appearance, colors, setAppearance } = useTheme();
  const styles = useStyles();
  const {
    firebaseUser,
    profile,
    refreshProfile,
    logOut,
    reauthenticateWithPassword,
    reauthenticateWithGoogle,
    reauthenticateWithApple,
  } = useAuth();
  const showNotice = useNotice();
  const queryClient = useQueryClient();
  const { unreadCount: unreadChats } = useChat();
  const [username, setUsername] = useState(profile?.username || '');
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyHidden, setPrivacyHidden] = useState(profile?.hidden ?? false);
  const [selectedInterests, setSelectedInterests] = useState<number[]>(
    profile?.interests.map((interest) => interest.id) || [],
  );
  const [editingInterests, setEditingInterests] = useState(false);
  const selectedInterestsRef = useRef(selectedInterests);
  const savedInterestsRef = useRef(selectedInterests);
  const pendingInterestsRef = useRef<number[] | null>(null);
  const savingInterestsRef = useRef(false);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [newLevel, setNewLevel] = useState<CefrLevel>('A1');
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showDeletionAuth, setShowDeletionAuth] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState('');
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
  useEffect(() => {
    void getReminderSettings().then((settings) => {
      setReminderEnabled(settings.enabled);
      setReminderHour(settings.hour);
    });
  }, []);
  useEffect(() => {
    if (savingInterestsRef.current) return;
    const interests = profile?.interests.map((interest) => interest.id) || [];
    selectedInterestsRef.current = interests;
    savedInterestsRef.current = interests;
    setSelectedInterests(interests);
  }, [profile?.interests]);

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
      showNotice({ title: 'Could not save username', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
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
      showNotice({ title: 'Could not update privacy', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function signOut() {
    await logOut();
    router.replace('/(auth)/sign-in');
  }

  async function saveReminder(enabled: boolean, hour = reminderHour) {
    const previousEnabled = reminderEnabled;
    const previousHour = reminderHour;
    setReminderEnabled(enabled);
    setReminderHour(hour);
    setSavingReminder(true);
    setReminderError('');
    try {
      const settings = await configureDailyReminder(enabled, hour);
      setReminderEnabled(settings.enabled);
      setReminderHour(settings.hour);
    } catch (error) {
      setReminderEnabled(previousEnabled);
      setReminderHour(previousHour);
      setReminderError(error instanceof Error ? error.message : 'The reminder could not be changed.');
    } finally {
      setSavingReminder(false);
    }
  }

  async function persistInterests() {
    if (savingInterestsRef.current) return;

    savingInterestsRef.current = true;
    try {
      while (pendingInterestsRef.current) {
        const interests = pendingInterestsRef.current;
        pendingInterestsRef.current = null;

        try {
          await api.updateInterests(interests);
          savedInterestsRef.current = interests;
        } catch (error) {
          if (!pendingInterestsRef.current) {
            selectedInterestsRef.current = savedInterestsRef.current;
            setSelectedInterests(savedInterestsRef.current);
            showNotice({ title: 'Could not update interests', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
          }
        }
      }

      await changed();
    } finally {
      savingInterestsRef.current = false;
      if (pendingInterestsRef.current) void persistInterests();
    }
  }

  function toggleInterest(id: number) {
    const current = selectedInterestsRef.current;
    const interests = current.includes(id)
      ? current.filter((interestId) => interestId !== id)
      : [...current, id];

    selectedInterestsRef.current = interests;
    pendingInterestsRef.current = interests;
    setSelectedInterests(interests);
    void persistInterests();
  }

  const availableInterests = interestsQuery.data || [];
  const selectedInterestItems = availableInterests.filter((interest) =>
    selectedInterests.includes(interest.id),
  );
  const orderedInterests = [...availableInterests].sort(
    (first, second) =>
      Number(selectedInterests.includes(second.id)) - Number(selectedInterests.includes(first.id)),
  );

  async function addLanguage() {
    if (!newLanguage) return;
    setAddingLanguage(true);
    try {
      await api.addLearner(newLanguage, newLevel);
      setNewLanguage('');
      setShowAddLanguage(false);
      await changed();
    } catch (error) {
      showNotice({ title: 'Could not add language', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setAddingLanguage(false);
    }
  }

  function deleteLanguage(learner: Learner) {
    Alert.alert(
      `Remove ${languageName(learner.language)}?`,
      'Its saved items and learning progress will also be removed.',
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
              showNotice({ title: 'Could not remove language', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
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
                        showNotice({ title: 'Password required', message: 'Enter your current password, then try again.', tone: 'error' });
                        return;
                      }
                      await reauthenticateWithPassword(currentPassword);
                    } else if (usesGoogle) {
                      await reauthenticateWithGoogle();
                    } else if (usesApple) {
                      await reauthenticateWithApple();
                    }
                    await api.deleteAccount();
                    setCurrentPassword('');
                    await logOut();
                    router.replace('/(auth)/sign-in');
                  } catch (error) {
                    showNotice({
                      title: 'Could not delete account',
                      message: error instanceof Error
                        ? `${error.message} ${usesPassword ? 'Check your current password and try again.' : usesGoogle ? 'Complete the Google confirmation and try again.' : usesApple ? 'Complete the Apple confirmation and try again.' : 'Sign out and back in with your provider, then try again.'}`
                        : 'Please sign out, sign back in, and try again.',
                      tone: 'error',
                    });
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
        <AvatarMark premium={profile?.premium} size={58} />
        <View style={styles.headingCopy}>
          <Title>{profile?.username || 'Your profile'}</Title>
          <Text style={styles.caption}>{profile?.email}</Text>
        </View>
      </View>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="grid-outline" color={colors.primary} size={20} />
          <Text style={styles.sectionTitleText}>More</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/inbox')} style={styles.destinationRow}>
          <Ionicons name="notifications-outline" color={colors.primary} size={21} />
          <View style={styles.settingCopy}><Text style={styles.settingLabel}>Inbox</Text><Text style={styles.caption}>Requests and book updates</Text></View>
          <Ionicons name="chevron-forward" color={colors.muted} size={19} />
        </Pressable>
        <Pressable onPress={() => router.push('/chat')} style={styles.destinationRow}>
          <Ionicons name="chatbubbles-outline" color={colors.primary} size={21} />
          <View style={styles.settingCopy}><Text style={styles.settingLabel}>Chats</Text><Text style={styles.caption}>{unreadChats ? `${unreadChats} unread` : 'Friends, rooms, and Saved Messages'}</Text></View>
          <Ionicons name="chevron-forward" color={colors.muted} size={19} />
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/people')} style={styles.destinationRow}>
          <Ionicons name="people-outline" color={colors.primary} size={21} />
          <View style={styles.settingCopy}><Text style={styles.settingLabel}>People</Text><Text style={styles.caption}>Friends, requests, and blocked readers</Text></View>
          <Ionicons name="chevron-forward" color={colors.muted} size={19} />
        </Pressable>
        <Pressable onPress={() => router.push('/membership')} style={styles.destinationRow}>
          <Ionicons name="star-outline" color={colors.primary} size={21} />
          <View style={styles.settingCopy}><Text style={styles.settingLabel}>Membership</Text><Text style={styles.caption}>{profile?.subscription.name ?? 'Free'} · usage and billing</Text></View>
          <Ionicons name="chevron-forward" color={colors.muted} size={19} />
        </Pressable>
      </Card>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="contrast-outline" color={colors.primary} size={20} />
          <Text style={styles.sectionTitleText}>Appearance</Text>
        </View>
        <Text style={styles.caption}>Choose a theme, or follow this device.</Text>
        <View accessibilityRole="radiogroup" style={styles.appearanceOptions}>
          {(['light', 'dark', 'system'] as AppearancePreference[]).map((option) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: appearance === option }}
              key={option}
              onPress={() => void setAppearance(option)}
              style={[styles.appearanceOption, appearance === option && styles.appearanceOptionActive]}>
              <Ionicons
                name={option === 'light' ? 'sunny-outline' : option === 'dark' ? 'moon-outline' : 'phone-portrait-outline'}
                color={appearance === option ? colors.primaryDark : colors.muted}
                size={17}
              />
              <Text style={[styles.appearanceText, appearance === option && styles.appearanceTextActive]}>
                {option[0].toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionTitle}>
          <Ionicons name="notifications-outline" color={colors.primary} size={20} />
          <Text style={styles.sectionTitleText}>Review reminder</Text>
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>One daily window</Text>
            <Text style={styles.caption}>Off by default. No streak warnings and nothing to lose.</Text>
          </View>
          <Switch
            disabled={savingReminder || Platform.OS === 'web'}
            value={reminderEnabled}
            onValueChange={(enabled) => void saveReminder(enabled)}
            trackColor={{ false: colors.line, true: colors.accentBorder }}
            thumbColor={reminderEnabled ? colors.primary : colors.muted}
            ios_backgroundColor={colors.line}
          />
        </View>
        {reminderEnabled && (
          <View style={styles.reminderTimes}>
            {reminderHours.map((hour) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: reminderHour === hour }}
                disabled={savingReminder}
                key={hour}
                onPress={() => void saveReminder(true, hour)}
                style={[styles.reminderTime, reminderHour === hour && styles.reminderTimeActive]}>
                <Text style={[styles.reminderTimeText, reminderHour === hour && styles.reminderTimeTextActive]}>
                  {reminderTimeLabel(hour)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {Platform.OS === 'web' && <Text style={styles.caption}>Available in the iOS and Android app.</Text>}
        {!!reminderError && <Text accessibilityRole="alert" style={styles.inlineError}>{reminderError}</Text>}
      </Card>

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
        <View style={styles.interestsHeader}>
          <View style={styles.sectionTitle}>
            <Ionicons name="heart-outline" color={colors.primary} size={20} />
            <Text style={styles.sectionTitleText}>Interests</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editingInterests ? 'Close interests editor' : 'Edit interests'}
            hitSlop={8}
            onPress={() => setEditingInterests((editing) => !editing)}
            style={styles.interestEditButton}>
            <Ionicons
              name={editingInterests ? 'close' : 'pencil-outline'}
              size={20}
              color={colors.primary}
            />
          </Pressable>
        </View>
        <View style={styles.chips}>
          {(editingInterests ? orderedInterests : selectedInterestItems).map((interest) => {
            const selected = selectedInterests.includes(interest.id);
            return (
              <Pressable
                key={interest.id}
                accessibilityRole={editingInterests ? 'checkbox' : undefined}
                accessibilityState={editingInterests ? { checked: selected } : undefined}
                accessibilityLabel={`${interest.name} interest`}
                disabled={!editingInterests}
                onPress={() => toggleInterest(interest.id)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {interest.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!editingInterests && !selectedInterestItems.length && (
          <Text style={styles.caption}>No interests selected yet.</Text>
        )}
        {editingInterests && (
          <Text style={styles.caption}>Tap interests to update your recommendations.</Text>
        )}
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
              Free covers {profile?.subscription.limits.MAX_TARGET_LANGS ?? 1} target language.
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
          <Ionicons name="sparkles-outline" color={colors.ink} size={20} />
          <Text style={styles.sectionTitleText}>Account</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.settingLabel}>Plan</Text>
          <Text style={profile?.premium ? styles.premiumStat : styles.stat}>
            {profile?.premium ? 'Premium +' : 'Free'}
          </Text>
        </View>
        {!profile?.premium && (
          <Button variant="premium" onPress={() => setShowPaywall(true)}>
            See what Premium adds
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
      <PaywallModal context="second-language" visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  headingCopy: { flex: 1, gap: 3 },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  interestsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  interestEditButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionTitleText: { color: colors.ink, fontWeight: '600', fontSize: 18 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  destinationRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 8 },
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
  levelTextActive: { color: colors.onPrimary },
  saving: { opacity: 0.6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  stat: { color: colors.primary, fontWeight: '600' },
  premiumStat: { color: colors.primary, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.onPrimary },
  deleteLink: { alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  addLanguage: { gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  pickerFrame: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.nested },
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
  reminderTimes: { flexDirection: 'row', gap: 7 },
  reminderTime: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 21 },
  reminderTimeActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  reminderTimeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  reminderTimeTextActive: { color: colors.primary },
  inlineError: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  appearanceOptions: { flexDirection: 'row', gap: 7 },
  appearanceOption: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 23, backgroundColor: colors.nested },
  appearanceOptionActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  appearanceText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  appearanceTextActive: { color: colors.primaryDark },
}));
