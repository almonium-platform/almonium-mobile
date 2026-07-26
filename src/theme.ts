export const colors = {
  ink: '#17221d',
  muted: '#68736d',
  canvas: '#f6f4ed',
  surface: '#fffdf8',
  primary: '#26735b',
  primaryDark: '#17533f',
  mint: '#dceee5',
  gold: '#d9a441',
  line: '#e4e2d8',
  danger: '#b54747',
  white: '#ffffff',
} as const;

export const shadows = {
  card: {
    shadowColor: '#10251d',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;
