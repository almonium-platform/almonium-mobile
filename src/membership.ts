import type { SubscriptionInfo } from '@/src/types';

/**
 * Two different facts wear the word "plan". `premium` is the entitlement, which is what the app
 * actually unlocks on; `subscription` is the billing row, and every account keeps one whether it
 * pays or not. The free row is stored as a LIFETIME plan named FREE, so a member whose access was
 * granted rather than bought reads as "Free" and "Lifetime" at the same time. Ask the row about
 * the membership only when the row is a paid plan; otherwise the entitlement is all we can say.
 */
export function planDescribesMembership(subscription: SubscriptionInfo | null | undefined) {
  const name = subscription?.name?.trim().toUpperCase();
  return Boolean(name) && name !== 'FREE';
}

/** `subscription.name` is the plan's database key ("PREMIUM"), never a label to print as it comes. */
export function planLabel(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** What to call the membership on a screen that has already established the person is a member. */
export function membershipName(subscription: SubscriptionInfo | null | undefined) {
  return planDescribesMembership(subscription) ? planLabel(subscription!.name) : 'Premium';
}
