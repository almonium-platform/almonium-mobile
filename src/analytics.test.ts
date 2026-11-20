import { describe, expect, it, vi } from 'vitest';

import { createAnalytics, crossedMilestones, type AnalyticsClient } from './analytics-core';

function fakeClient(): AnalyticsClient {
  return { register: vi.fn(), identify: vi.fn(), reset: vi.fn(), capture: vi.fn(), screen: vi.fn() };
}

describe('analytics', () => {
  it('is a silent no-op without a key', () => {
    const createClient = vi.fn(fakeClient);
    for (const apiKey of [undefined, '', '   ']) {
      const analytics = createAnalytics({ apiKey, platform: 'ios', createClient });
      expect(analytics.enabled).toBe(false);
      expect(() => {
        analytics.identify('42');
        analytics.track('signup');
        analytics.screen('/home');
        analytics.reset();
      }).not.toThrow();
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it('stays a no-op when the client fails to start', () => {
    const analytics = createAnalytics({ apiKey: 'phc_x', platform: 'web', createClient: () => { throw new Error('boom'); } });
    expect(analytics.enabled).toBe(false);
    expect(() => analytics.track('signup')).not.toThrow();
  });

  it('attaches the platform to every event and re-registers it after reset', () => {
    const client = fakeClient();
    const analytics = createAnalytics({ apiKey: 'phc_x', platform: 'android', createClient: () => client });
    analytics.track('book_opened', { book_id: '7' });
    analytics.screen('/home');
    analytics.identify('42');
    analytics.reset();
    expect(client.capture).toHaveBeenCalledWith('book_opened', { book_id: '7', platform: 'android' });
    expect(client.screen).toHaveBeenCalledWith('/home', { platform: 'android' });
    expect(client.identify).toHaveBeenCalledWith('42');
    expect(client.register).toHaveBeenCalledTimes(2);
  });

  it('reports each progress milestone once', () => {
    expect(crossedMilestones(0, 30)).toEqual([25]);
    expect(crossedMilestones(25, 80)).toEqual([50, 75]);
    expect(crossedMilestones(90, 100)).toEqual([100]);
    expect(crossedMilestones(50, 60)).toEqual([]);
  });
});
