/**
 * Product analytics, behind one small interface so screens never touch PostHog directly.
 * Without a project key every call is a silent no-op (local dev, tests, unconfigured builds).
 * Identity is the internal user id only: no email, name or typed text ever leaves the device.
 */
export type AnalyticsPlatform = 'web' | 'ios' | 'android';

export type AnalyticsEvent =
  | 'signup'
  | 'first_lookup'
  | 'first_save'
  | 'review_session_completed'
  | 'book_opened'
  | 'book_progress'
  | 'share_link_created'
  | 'share_link_opened'
  | 'subscribe_started';

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

/** The slice of the PostHog client this app uses. */
export interface AnalyticsClient {
  register(properties: AnalyticsProperties): unknown;
  identify(distinctId: string): unknown;
  reset(): unknown;
  capture(event: string, properties?: AnalyticsProperties): unknown;
  screen(name: string, properties?: AnalyticsProperties): unknown;
}

export interface AnalyticsOptions {
  apiKey: string | undefined;
  platform: AnalyticsPlatform;
  createClient: (apiKey: string) => AnalyticsClient;
}

export const BOOK_PROGRESS_MILESTONES = [25, 50, 75, 100] as const;

/** Milestones newly crossed when progress moves from `previous` to `next` percent. */
export function crossedMilestones(previous: number, next: number): number[] {
  return BOOK_PROGRESS_MILESTONES.filter((milestone) => previous < milestone && next >= milestone);
}

export function createAnalytics({ apiKey, platform, createClient }: AnalyticsOptions) {
  let client: AnalyticsClient | null = null;
  if (apiKey?.trim()) {
    try {
      client = createClient(apiKey.trim());
      client.register({ platform });
    } catch {
      client = null;
    }
  }
  // Analytics must never break the app.
  const safely = (action: (c: AnalyticsClient) => unknown) => {
    if (!client) return;
    try {
      action(client);
    } catch {
      // ignore
    }
  };

  return {
    get enabled() {
      return client !== null;
    },
    identify(userId: string) {
      safely((c) => c.identify(userId));
    },
    reset() {
      safely((c) => {
        c.reset();
        c.register({ platform });
      });
    },
    track(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
      safely((c) => c.capture(event, { ...properties, platform }));
    },
    screen(name: string) {
      safely((c) => c.screen(name, { platform }));
    },
  };
}

export type Analytics = ReturnType<typeof createAnalytics>;
