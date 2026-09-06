import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { AvatarMark } from '@/components/avatar-mark';
import { Sheet } from '@/components/sheet';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { useChat } from '@/src/chat-client';
import { crestTint } from '@/src/crest';
import { useCrest } from '@/src/crest-context';
import { languageName } from '@/src/languages';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

/**
 * Emblem, crest, bell, avatar; the 3px rail beneath carries the active language's own hue and is
 * the only chrome that carries language colour. The crest is a stack, not a caret: with two or
 * more active languages two hairline edges peek out below it in the next languages' hues.
 */
export function AppHeader({
  language,
  onLanguageChange,
}: {
  language: string;
  onLanguageChange?: (language: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const { crestFor } = useCrest();
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
  // Active only: the switcher answers what you are doing now. Set-aside languages live on the profile.
  const learners = profile?.learners.filter((learner) => learner.active) ?? [];
  const others = learners.filter((learner) => learner.language !== language).slice(0, 2);
  const crest = crestFor(language);
  const tint = crestTint(crest, isDark ? colors.surface : colors.canvas);
  const canSwitch = Boolean(onLanguageChange && learners.length > 1);
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <BrandMark size={30} />
        <View style={styles.crestSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Current language ${languageName(language)}${canSwitch ? ', switch' : ''}`}
            disabled={!canSwitch}
            onPress={() => setLanguagesVisible(true)}
            style={({ pressed }) => [styles.crest, { borderColor: crest, backgroundColor: tint }, pressed && styles.pressed]}>
            <Text style={[styles.crestText, { color: crest }]}>{language.toUpperCase()}</Text>
          </Pressable>
          {canSwitch &&
            others.map((learner, index) => (
              <View
                key={learner.language}
                pointerEvents="none"
                style={[styles.deckEdge, { top: 30 + index * 3, marginHorizontal: 4 + index * 4, borderColor: crestFor(learner.language) }]}
              />
            ))}
        </View>
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
          <AvatarMark avatarUrl={profile?.avatarUrl} username={profile?.username} premium={profile?.premium} size={36} />
        </Pressable>
      </View>
      <View style={[styles.rail, { backgroundColor: crest }]} />
      <Sheet visible={languagesVisible} onClose={() => setLanguagesVisible(false)}>
        <Text style={styles.sheetEyebrow}>NOW STUDYING</Text>
        <View style={styles.languageList}>
          {learners.map((learner) => {
            const code = learner.language;
            const hue = crestFor(code);
            const selected = code === language;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={code}
                onPress={() => {
                  onLanguageChange?.(code);
                  setLanguagesVisible(false);
                }}
                style={[styles.languageRow, selected && { borderColor: hue, backgroundColor: crestTint(hue, isDark ? colors.overlay : colors.canvas) }]}>
                <View style={[styles.languageCode, { borderColor: hue }]}>
                  <Text style={[styles.languageCodeText, { color: hue }]}>{code}</Text>
                </View>
                <Text style={styles.languageName}>{languageName(code)}</Text>
                <Text style={styles.languageLevel}>{learner.selfReportedLevel}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => {
            setLanguagesVisible(false);
            router.push('/(tabs)/settings');
          }}
          style={styles.manageLanguages}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.manageLanguagesText}>Add a language</Text>
        </Pressable>
      </Sheet>
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
  crestSlot: { minWidth: 48, paddingBottom: 6 },
  crest: {
    minWidth: 48,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 999,
  },
  crestText: { fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 0.8 },
  deckEdge: { position: 'absolute', left: 0, right: 0, height: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderBottomLeftRadius: 999, borderBottomRightRadius: 999 },
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
  rail: { height: 3 },
  pressed: { opacity: 0.72 },
  sheetEyebrow: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.5 },
  languageList: { gap: 7 },
  languageRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 13, backgroundColor: colors.surface },
  languageCode: { minWidth: 40, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderRadius: 999 },
  languageCodeText: { fontFamily: fonts.sansSemibold, fontSize: 10.5, letterSpacing: 0.8 },
  languageName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' },
  languageLevel: { color: colors.metadata, fontSize: 12 },
  manageLanguages: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  manageLanguagesText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
}));
