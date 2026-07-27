import { Platform } from 'react-native';

/**
 * Almonium's mobile tokens, adapted from docs/Almonium design system analysis.md
 * and the shipped almonium-fe CSS variables.
 *
 * Keep color names semantic at call sites. Colour is for hierarchy and state,
 * not decoration: cream ground, white surfaces, plum actions, orange reading
 * progress, and exceptional colours only for status.
 */
export const colors = {
  ink: '#3d3d3d',
  muted: '#746d73',
  canvas: '#f9f6f5',
  surface: '#ffffff',
  primary: '#83397f',
  primaryDark: '#5a1a74',
  raspberry: '#8f2356',
  accentSoft: '#ffeefb',
  accentBorder: '#f2d7e8',
  reading: '#ff7f00',
  line: '#edebe8',
  disabled: '#e6e5e5',
  disabledText: '#7e7e7e',
  danger: '#fa4666',
  dangerSoft: '#ffe3e9',
  success: '#16ba7f',
  successSoft: '#e7f8f2',
  white: '#ffffff',
} as const;

export const gradients = {
  primary: [colors.primaryDark, colors.raspberry] as const,
  auth: ['#f4e5ec', colors.canvas, '#eee7f4'] as const,
  premium: ['#00d1ff', '#8a2be2'] as const,
} as const;

export const fonts = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: 'Cambria, Georgia, serif',
    default: 'serif',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'system-ui, sans-serif',
    default: 'System',
  }),
} as const;

export const radii = {
  inline: 8,
  control: 999,
  panel: 20,
  card: 30,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  media: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  field: {
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;
