import { describe, expect, it } from 'vitest';

import { membershipName, planDescribesMembership, planLabel } from './membership';
import type { SubscriptionInfo } from './types';

function subscription(overrides: Partial<SubscriptionInfo> = {}): SubscriptionInfo {
  return { name: 'PREMIUM', limits: {}, type: 'YEARLY', autoRenewal: true, startDate: null, endDate: null, ...overrides };
}

describe('planDescribesMembership', () => {
  it('trusts a paid plan row', () => {
    expect(planDescribesMembership(subscription())).toBe(true);
    expect(planDescribesMembership(subscription({ name: 'INSIDER', type: 'LIFETIME' }))).toBe(true);
  });

  it('ignores the free row a granted member keeps, LIFETIME type and all', () => {
    expect(planDescribesMembership(subscription({ name: 'FREE', type: 'LIFETIME' }))).toBe(false);
    expect(planDescribesMembership(subscription({ name: 'free' }))).toBe(false);
    expect(planDescribesMembership(undefined)).toBe(false);
  });
});

describe('membershipName', () => {
  it('prints the plan key as a label', () => {
    expect(membershipName(subscription())).toBe('Premium');
    expect(membershipName(subscription({ name: 'INSIDER' }))).toBe('Insider');
  });

  it('never calls a member Free', () => {
    expect(membershipName(subscription({ name: 'FREE', type: 'LIFETIME' }))).toBe('Premium');
  });
});

describe('planLabel', () => {
  it('lowercases the shouting', () => {
    expect(planLabel('PREMIUM')).toBe('Premium');
  });
});
