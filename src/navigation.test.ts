import { describe, expect, it } from 'vitest';

import { authenticatedDestination } from './navigation';

describe('authenticatedDestination', () => {
  it('sends signed-out sessions to auth', () => {
    expect(authenticatedDestination(false, false)).toBe('/(auth)/sign-in');
  });

  it('resumes onboarding at any incomplete step', () => {
    expect(authenticatedDestination(true, true, 'LANGUAGES')).toBe('/onboarding');
  });

  it('opens the learning home only after onboarding', () => {
    expect(authenticatedDestination(true, true, 'COMPLETED')).toBe('/(tabs)/home');
  });
});
