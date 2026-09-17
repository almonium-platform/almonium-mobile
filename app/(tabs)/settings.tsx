import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarMark } from '@/components/avatar-mark';
import { AccountTab } from '@/components/settings/account-tab';
import { AppTab } from '@/components/settings/app-tab';
import { LearningTab } from '@/components/settings/learning-tab';
import { ProfileTab } from '@/components/settings/profile-tab';
import { useAuth } from '@/src/auth-context';
import { msg } from '@/src/i18n';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';

type Tab = 'profile' | 'account' | 'learning' | 'app';
const tabs: { key: Tab; label: string }[] = [
  { key: 'profile', label: msg('Profile') },
  { key: 'account', label: msg('Account') },
  { key: 'learning', label: msg('Learning') },
  { key: 'app', label: msg('App') },
];

/**
 * Settings sit behind the avatar, not in a tab. Four sections in the web's order. The header
 * is one line of metadata under the handle — when you joined and how many languages — because
 * the languages have a tab of their own and the first setting should start well above the fold.
 * The tab row pins under the status bar once the header scrolls off, so switching tabs never
 * means scrolling back up. A `tab` param lets language affordances elsewhere land on Learning.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { profile } = useAuth();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(tabs.some((item) => item.key === requestedTab) ? (requestedTab as Tab) : 'profile');
  const languages = profile?.learners.length ?? 0;
  const month = formatMonth(profile?.subscription.startDate);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[1]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.topRow}>
            <Pressable accessibilityLabel={t('Back')} onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.heading}>
            <AvatarMark avatarUrl={profile?.avatarUrl} username={profile?.username} premium={profile?.premium} size={48} />
            <View style={styles.headingCopy}>
              <Text numberOfLines={1} style={styles.title}>@{profile?.username}</Text>
              <Text numberOfLines={1} style={styles.caption}>
                {languages > 0
                  ? t('Since {month} · {count, plural, one {# language} other {# languages}}', { month, count: languages })
                  : t('Since {month}', { month })}
              </Text>
            </View>
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
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{t(item.label)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.body}>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'account' && <AccountTab />}
          {tab === 'learning' && <LearningTab />}
          {tab === 'app' && <AppTab />}
        </View>
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
  content: { paddingBottom: 40 },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  topRow: { flexDirection: 'row' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  headingCopy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: serifLineHeight(24) },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  // The pinned row paints its own ground so the content scrolling under it never shows through.
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.canvas, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 15 },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  body: { padding: 16, paddingTop: 20, gap: 16 },
}));
