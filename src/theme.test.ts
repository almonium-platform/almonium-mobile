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

  it('reserves green for success rather than the brand accent', () => {
    expect(colors.success).toBe('#16BA7F');
    expect(colors.primary).not.toBe(colors.success);
  });

  it('defines the night-reader palette as semantic tokens', () => {
    expect(darkColors.canvas).toBe('#14111A');
    expect(darkColors.ink).toBe('#F1EAEF');
    expect(darkColors.primary).toBe('#B07BD0');
  });

  it('uses mobile-safe rounded controls', () => {
    expect(radii.control).toBe(999);
    expect(radii.panel).toBeGreaterThanOrEqual(20);
  });
});
