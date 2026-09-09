import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarMark } from '@/components/avatar-mark';
import { AccountTab } from '@/components/settings/account-tab';
import { AppTab } from '@/components/settings/app-tab';
import { LearningTab } from '@/components/settings/learning-tab';
import { ProfileTab } from '@/components/settings/profile-tab';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';

type Tab = 'profile' | 'account' | 'learning' | 'app';
const tabs: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'account', label: 'Account' },
  { key: 'learning', label: 'Learning' },
  { key: 'app', label: 'App' },
];

/**
 * Settings sit behind the avatar, not in a tab. Four sections in the web's order; the header
 * names the language, which is the one true fact a new account has. A `tab` param lets language
 * affordances elsewhere land on Learning instead of making people hunt for it.
 */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { profile } = useAuth();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(tabs.some((item) => item.key === requestedTab) ? (requestedTab as Tab) : 'profile');
  const activeLanguages = profile?.learners.filter((learner) => learner.active).map((learner) => languageName(learner.language)) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.heading}>
          <AvatarMark avatarUrl={profile?.avatarUrl} username={profile?.username} premium={profile?.premium} size={64} />
          <View style={styles.headingCopy}>
            <Text style={styles.title}>@{profile?.username}</Text>
            <Text style={styles.caption}>
              Here since {formatMonth(profile?.subscription.startDate)}
              {activeLanguages.length ? ` · learning ${activeLanguages.join(', ')}` : ''}
            </Text>
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => setTab(item.key)}
              style={[styles.tab, tab === item.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'profile' && <ProfileTab />}
        {tab === 'account' && <AccountTab />}
        {tab === 'learning' && <LearningTab />}
        {tab === 'app' && <AppTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatMonth(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  topRow: { flexDirection: 'row' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headingCopy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 26, lineHeight: serifLineHeight(26) },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
}));
