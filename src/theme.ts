/**
 * Almonium's mobile tokens, adapted from the current almonium-fe Constitution
 * and shipped CSS variables.
 *
 * Keep color names semantic at call sites. Colour is for hierarchy and state,
 * not decoration: cream ground, white surfaces, plum actions, and exceptional
 * colours only for status.
 */
export const colors = {
  ink: '#2C2530',
  muted: '#5F5560',
  metadata: '#A99AA8',
  canvas: '#F9F6F5',
  surface: '#FFFFFF',
  primary: '#5A1A74',
  primaryDark: '#48177D',
  primaryPressed: '#3A1462',
  raspberry: '#A1264C',
  premium: '#8F2356',
  accentSoft: '#F8EAF3',
  accentBorder: '#E9CADF',
  line: '#EDEBE8',
  border: '#D8CFD6',
  disabled: '#E8E2E6',
  disabledText: '#8B8290',
  danger: '#FA4666',
  dangerSoft: '#FFE3E9',
  success: '#16BA7F',
  successSoft: '#E7F8F2',
  reader: '#33292E',
  languageRail: '#6C7FA8',
  languageRailSoft: '#CDD4E2',
  white: '#FFFFFF',
} as const;

export const darkColors = {
  canvas: '#14111A',
  surface: '#1E1A26',
  nested: '#272130',
  overlay: '#2E2736',
  line: '#332C3C',
  border: '#453D51',
  ink: '#F1EAEF',
  muted: '#BEB2C2',
  metadata: '#8D8298',
  primary: '#B07BD0',
  primaryLight: '#E0C4EE',
  primaryMid: '#CBA3E0',
  primaryPressed: '#9059BC',
  raspberry: '#D98BA8',
} as const;

export const gradients = {
  auth: ['#F4E5EC', colors.canvas, '#EEE7F4'] as const,
  premium: [colors.premium, colors.primary] as const,
} as const;

export const fonts = {
  serif: 'Literata_600SemiBold',
  serifRegular: 'Literata_400Regular',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemibold: 'IBMPlexSans_600SemiBold',
} as const;

export const radii = {
  inline: 12,
  control: 999,
  panel: 20,
  card: 28,
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
