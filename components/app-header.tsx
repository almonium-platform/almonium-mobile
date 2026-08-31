import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { AvatarMark } from '@/components/avatar-mark';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useChat } from '@/src/chat-client';
import { languageName } from '@/src/languages';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

export function AppHeader({
  language,
  onLanguageChange,
}: {
  language: string;
  onLanguageChange?: (language: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const { unreadCount: unreadChats } = useChat();
  const notifications = useQuery({
    queryKey: ['notifications', firebaseUser?.uid],
    queryFn: api.notifications,
    enabled: Boolean(firebaseUser),
  });
  // The bell is the whole discovery path on mobile: chat is not a tab, so a first incoming
  // message has nowhere else to announce itself. One count for everything waiting.
  const waiting = (notifications.data?.filter((item) => !item.readAt).length ?? 0) + unreadChats;
  const [languagesVisible, setLanguagesVisible] = useState(false);
  const languages = profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <BrandMark size={30} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Current language ${language}`}
          disabled={!onLanguageChange}
          onPress={() => setLanguagesVisible(true)}
          style={({ pressed }) => [styles.language, pressed && styles.pressed]}>
          <Text style={styles.languageText}>{language.toUpperCase()}</Text>
          {onLanguageChange && <Ionicons name="chevron-down" size={12} color={colors.languageRail} />}
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={waiting > 0 ? `Notifications, ${waiting} waiting` : 'Notifications'}
          onPress={() => router.push('/(tabs)/inbox')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons
            name={waiting > 0 ? 'notifications' : 'notifications-outline'}
            size={23}
            color={waiting > 0 ? colors.chatMine : colors.muted}
          />
          {waiting > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{waiting > 99 ? '99+' : waiting}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/(tabs)/settings')}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
          <AvatarMark premium={profile?.premium} size={36} />
        </Pressable>
      </View>
      <View style={styles.rail} />
      <Modal transparent animationType="slide" visible={languagesVisible} onRequestClose={() => setLanguagesVisible(false)}>
        <Pressable style={styles.scrim} onPress={() => setLanguagesVisible(false)} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetEyebrow}>READING LANGUAGE</Text>
          <Text style={styles.sheetTitle}>Choose a shelf</Text>
          <View style={styles.languageList}>
            {languages.map((code) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: code === language }}
                key={code}
                onPress={() => { onLanguageChange?.(code); setLanguagesVisible(false); }}
                style={[styles.languageRow, code === language && styles.languageRowActive]}>
                <View style={styles.languageCode}><Text style={styles.languageCodeText}>{code}</Text></View>
                <Text style={styles.languageName}>{languageName(code)}</Text>
                {code === language && <Ionicons name="checkmark-circle" size={21} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => { setLanguagesVisible(false); router.push('/(tabs)/settings'); }} style={styles.manageLanguages}>
            <Text style={styles.manageLanguagesText}>Manage languages</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  safe: { backgroundColor: colors.surface },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  language: {
    minWidth: 48,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: colors.languageRailSoft,
    borderRadius: 9,
  },
  languageText: {
    color: colors.languageRail,
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  spacer: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 5, minWidth: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.surface, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: colors.chatMine },
  badgeText: { color: colors.white, fontFamily: fonts.sansMedium, fontSize: 10 },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  rail: { height: 3, backgroundColor: colors.languageRail },
  pressed: { opacity: 0.72 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: { position: 'absolute', right: 0, bottom: 0, left: 0, gap: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, backgroundColor: colors.canvas },
  grabber: { width: 38, height: 4, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.border },
  sheetEyebrow: { marginTop: 5, color: colors.raspberry, fontFamily: fonts.sansSemibold, fontSize: 10, letterSpacing: 1.5 },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 26 },
  languageList: { gap: 7, paddingTop: 5 },
  languageRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 13, backgroundColor: colors.surface },
  languageRowActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  languageCode: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface },
  languageCodeText: { color: colors.languageRail, fontFamily: fonts.sansSemibold, fontSize: 10 },
  languageName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' },
  manageLanguages: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  manageLanguagesText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
}));
