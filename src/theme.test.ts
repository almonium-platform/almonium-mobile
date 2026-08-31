import { describe, expect, it, vi } from 'vitest';

import { colors, darkColors, gradients, radii } from './theme';

vi.mock('react-native', () => ({
  Platform: {
    select: <T>(options: { default?: T; web?: T }) => options.web ?? options.default,
  },
}));

describe('Almonium visual system', () => {
  it('keeps the core web brand palette aligned', () => {
    expect(colors.canvas).toBe('#F9F6F5');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.ink).toBe('#2C2530');
    expect(colors.primary).toBe('#5A1A74');
    expect(colors).not.toHaveProperty('reading');
    expect(gradients.premium).toEqual(['#8F2356', '#5A1A74']);
    expect(gradients).not.toHaveProperty('primary');
  });

  it('carries the chat emblem plums centrally rather than per screen', () => {
    expect(colors.chatMine).toBe('#872657');
    expect(colors.chatChannel).toBe('#6E2A5E');
    expect(darkColors.chatMine).not.toBe(colors.chatMine);
  });

  it('reserves green for success rather than the brand accent', () => {
    expect(colors.success).toBe('#16BA7F');
    expect(colors.primary).not.toBe(colors.success);
  });

  it('defines the app-wide dark palette as semantic tokens', () => {
    expect(darkColors.canvas).toBe('#14111A');
    expect(darkColors.surface).toBe('#1E1A26');
    expect(darkColors.nested).toBe('#272130');
    expect(darkColors.ink).toBe('#F1EAEF');
    expect(darkColors.primary).toBe('#B07BD0');
    expect(darkColors.onPrimary).toBe('#14111A');
    expect(darkColors.danger).toBe('#FF8FA3');
    expect(darkColors.success).toBe('#3DD69B');
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
    expect(gradients.authDark).toEqual(['#272130', '#14111A', '#1E1A26']);
  });

  it('uses mobile-safe rounded controls', () => {
    expect(radii.control).toBe(999);
    expect(radii.panel).toBeGreaterThanOrEqual(20);
  });
});
