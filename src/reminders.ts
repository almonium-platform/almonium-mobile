import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { normalizeReminderHour } from '@/src/reminder-utils';

export { reminderTimeLabel } from '@/src/reminder-utils';

const settingsKey = 'almonium:review-reminder';
const channelId = 'review-reminders';

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  notificationId?: string;
}

const defaultSettings: ReminderSettings = { enabled: false, hour: 20 };

export async function getReminderSettings(): Promise<ReminderSettings> {
  const stored = await AsyncStorage.getItem(settingsKey);
  if (!stored) return defaultSettings;
  try {
    const value = JSON.parse(stored) as Partial<ReminderSettings>;
    return {
      enabled: Boolean(value.enabled),
      hour: normalizeReminderHour(value.hour),
      notificationId: typeof value.notificationId === 'string' ? value.notificationId : undefined,
    };
  } catch {
    return defaultSettings;
  }
}

export async function configureDailyReminder(enabled: boolean, hour: number) {
  const current = await getReminderSettings();
  if (current.notificationId && Platform.OS !== 'web') {
    await Notifications.cancelScheduledNotificationAsync(current.notificationId).catch(() => undefined);
  }

  const normalizedHour = normalizeReminderHour(hour);
  if (!enabled) {
    const settings = { enabled: false, hour: normalizedHour };
    await AsyncStorage.setItem(settingsKey, JSON.stringify(settings));
    return settings;
  }
  if (Platform.OS === 'web') throw new Error('Review reminders are available in the iOS and Android app.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Review reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  if (!permission.granted) throw new Error('Notifications are off. You can enable them in system settings.');

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'A few words may be ready',
      body: 'Open a short review when it suits you.',
      data: { url: '/review' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: normalizedHour,
      minute: 0,
      channelId,
    },
  });
  const settings = { enabled: true, hour: normalizedHour, notificationId };
  await AsyncStorage.setItem(settingsKey, JSON.stringify(settings));
  return settings;
}
