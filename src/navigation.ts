import type { SetupStep } from '@/src/types';

export function authenticatedDestination(
  hasFirebaseUser: boolean,
  hasProfile: boolean,
  setupStep?: SetupStep,
) {
  if (!hasFirebaseUser || !hasProfile) return '/(auth)/sign-in' as const;
  if (setupStep !== 'COMPLETED') return '/onboarding' as const;
  return '/(tabs)/home' as const;
}
