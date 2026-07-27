import { describe, expect, it, vi } from 'vitest';

import { colors, gradients, radii } from './theme';

vi.mock('react-native', () => ({
  Platform: {
    select: <T>(options: { default?: T; web?: T }) => options.web ?? options.default,
  },
}));

describe('Almonium visual system', () => {
  it('keeps the core web brand palette aligned', () => {
    expect(colors.canvas).toBe('#f9f6f5');
    expect(colors.surface).toBe('#ffffff');
    expect(colors.ink).toBe('#3d3d3d');
    expect(colors.primary).toBe('#83397f');
    expect(gradients.primary).toEqual(['#5a1a74', '#8f2356']);
  });

  it('reserves green for success rather than the brand accent', () => {
    expect(colors.success).toBe('#16ba7f');
    expect(colors.primary).not.toBe(colors.success);
  });

  it('uses mobile-safe rounded controls', () => {
    expect(radii.control).toBe(999);
    expect(radii.panel).toBeGreaterThanOrEqual(20);
  });
});
