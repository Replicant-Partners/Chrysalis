export type ThemeMode = 'light' | 'dark';

export const tokens = {
  color: {
    surface: {
      base: { light: '#F7F7F5', dark: '#121416' },
      primaryPane: { light: '#F3F3F0', dark: '#0F1113' },
      secondaryPane: { light: '#FAFAF8', dark: '#15181B' },
    },
    text: {
      primary: { light: '#111214', dark: '#E7E9EC' },
      secondary: { light: '#4B4F55', dark: '#A8ADB4' },
    },
    border: {
      subtle: { light: '#D9DBDF', dark: '#2B2F35' },
    },
    trust: {
      external: { light: 'rgba(159, 167, 178, 0.08)', dark: 'rgba(110, 118, 129, 0.08)' },
      internal: { light: 'rgba(140, 151, 166, 0.08)', dark: 'rgba(124, 135, 150, 0.08)' },
      ada: { light: 'rgba(127, 138, 153, 0.08)', dark: 'rgba(136, 149, 166, 0.08)' },
    },
  },
  radius: {
    sm: 6,
    md: 10,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  typography: {
    body: 14,
    label: 12,
    title: 16,
    weight: { normal: 450, bold: 600 },
  },
  motion: {
    fast: '120ms',
    snap: '180ms',
    intent: '220ms',
    easeSnap: 'cubic-bezier(0.2, 0.8, 0.2, 1.0)',
    easeLock: 'cubic-bezier(0.16, 1.0, 0.3, 1.0)',
  },
};