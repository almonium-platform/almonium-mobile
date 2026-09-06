import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are rationed like celebration: a light impact when a grade commits and when a word is
 * kept, the success notification on the earned events only. Nothing on navigation.
 */
export function lightImpact() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successHaptic() {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
