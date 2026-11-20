import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { createAnalytics, crossedMilestones, type AnalyticsPlatform } from './analytics-core';
import { config } from './config';

export const analytics = createAnalytics({
  apiKey: config.posthog.apiKey,
  platform: (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web') as AnalyticsPlatform,
  createClient: (apiKey) => {
    // Loaded only when a key is set, so unconfigured builds never start the SDK.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
    return new PostHog(apiKey, {
      host: config.posthog.host,
      captureAppLifecycleEvents: true,
      // Replay stays off; if it is ever enabled, inputs and images are masked.
      enableSessionReplay: false,
      sessionReplayConfig: { maskAllTextInputs: true, maskAllImages: true },
    });
  },
});

/** Fires `event` once per user per install, e.g. first_lookup / first_save. */
export async function trackFirst(event: 'first_lookup' | 'first_save', userId: string | undefined) {
  if (!analytics.enabled || !userId) return;
  const key = `almonium:analytics:${event}:${userId}`;
  try {
    if (await AsyncStorage.getItem(key)) return;
    await AsyncStorage.setItem(key, '1');
  } catch {
    return;
  }
  analytics.track(event);
}

/** Emits book_progress for each 25/50/75/100 milestone crossed. */
export function trackBookProgress(bookId: string, previous: number, next: number) {
  for (const milestone of crossedMilestones(previous, next)) {
    analytics.track('book_progress', { book_id: bookId, percent: milestone });
  }
}
