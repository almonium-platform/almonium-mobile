import { t } from './i18n';
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
  return planDescribesMembership(subscription) ? planLabel(subscription!.name) : t('Premium');
}

/**
 * How many languages the plan lets you keep active, in the backend's own vocabulary: `-1` is
 * unlimited. The insider plan carries no row for this feature at all, and the backend reads that
 * absence as no ceiling, so an absent key means unlimited here too — never a fallback digit.
 */
export function activeLanguageAllowance(subscription: SubscriptionInfo | null | undefined) {
  const limit = subscription?.limits.MAX_ACTIVE_LANGS;
  return limit === undefined || !Number.isFinite(limit) || limit < 0 ? -1 : limit;
}
