import type { SetupStep } from '@/src/types';

export function authenticatedDestination(
  hasFirebaseUser: boolean,
  hasProfile: boolean,
  setupStep?: SetupStep,
) {
  if (!hasFirebaseUser) return '/read' as const;
  if (!hasProfile) return '/(auth)/sign-in' as const;
  if (setupStep !== 'COMPLETED') return '/onboarding' as const;
  return '/(tabs)/home' as const;
}
