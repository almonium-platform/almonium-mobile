import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { AvatarMark } from '@/components/avatar-mark';
import { useAuth } from '@/src/auth-context';
import { colors, fonts } from '@/src/theme';

export function AppHeader({
  language,
  onLanguagePress,
}: {
  language: string;
  onLanguagePress?: () => void;
}) {
  const { profile } = useAuth();
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <BrandMark size={30} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Current language ${language}`}
          disabled={!onLanguagePress}
          onPress={onLanguagePress}
          style={({ pressed }) => [styles.language, pressed && styles.pressed]}>
          <Text style={styles.languageText}>{language.toUpperCase()}</Text>
          {onLanguagePress && <Ionicons name="chevron-down" size={12} color={colors.languageRail} />}
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push('/(tabs)/inbox')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="notifications-outline" size={23} color={colors.muted} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  rail: { height: 3, backgroundColor: colors.languageRail },
  pressed: { opacity: 0.72 },
});
