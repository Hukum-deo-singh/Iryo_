/**
 * Design tokens. Neutral surfaces plus ONE accent keep the app calm and premium.
 * Everything here is local to the phone. Nothing is sent to the backend.
 */
export type ModePref = 'system' | 'light' | 'dark';
export type ToneId = 'mist' | 'sand' | 'slate';
export type AccentId = 'teal' | 'indigo' | 'rose' | 'graphite';

export interface Theme {
  isDark: boolean;
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceHi: string;
  inset: string;
  insetEdgeDark: string;
  insetEdgeLight: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentStrong: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
  doorFrame: string;
  doorLeaf: string;
  doorPanel: string;
  doorGlow: string;
}

interface Tone {
  label: string;
  swatch: string;
  light: Pick<Theme, 'bg' | 'bgAlt' | 'surface' | 'surfaceHi' | 'inset' | 'border'>;
  dark: Pick<Theme, 'bg' | 'bgAlt' | 'surface' | 'surfaceHi' | 'inset' | 'border'>;
}

export const TONES: Record<ToneId, Tone> = {
  mist: {
    label: 'Mist',
    swatch: '#DDE1DB',
    light: { bg: '#EDEFEB', bgAlt: '#E2E5E0', surface: '#F7F8F5', surfaceHi: '#FFFFFF', inset: '#DFE2DC', border: '#D3D7D0' },
    dark: { bg: '#0F1312', bgAlt: '#161B1A', surface: '#1A201F', surfaceHi: '#212827', inset: '#0B0E0D', border: '#2A3231' },
  },
  sand: {
    label: 'Sand',
    swatch: '#E7DFD2',
    light: { bg: '#F2EEE7', bgAlt: '#E8E2D8', surface: '#FAF7F2', surfaceHi: '#FFFFFF', inset: '#E6E0D5', border: '#DAD3C6' },
    dark: { bg: '#141210', bgAlt: '#1B1815', surface: '#201D19', surfaceHi: '#282420', inset: '#0F0D0B', border: '#312C26' },
  },
  slate: {
    label: 'Slate',
    swatch: '#D7DEE8',
    light: { bg: '#EAEDF2', bgAlt: '#DEE3EA', surface: '#F5F7FA', surfaceHi: '#FFFFFF', inset: '#DCE1E8', border: '#CFD6DF' },
    dark: { bg: '#0E1117', bgAlt: '#141922', surface: '#181D27', surfaceHi: '#1F2531', inset: '#0B0D12', border: '#262D3A' },
  },
};

interface Accent {
  label: string;
  swatch: string;
  light: { accent: string; accentStrong: string; onAccent: string };
  dark: { accent: string; accentStrong: string; onAccent: string };
}

export const ACCENTS: Record<AccentId, Accent> = {
  teal: {
    label: 'Teal',
    swatch: '#11796F',
    light: { accent: '#11796F', accentStrong: '#0B5F59', onAccent: '#FFFFFF' },
    dark: { accent: '#4FCDBB', accentStrong: '#7BE0D2', onAccent: '#06241F' },
  },
  indigo: {
    label: 'Indigo',
    swatch: '#4152C4',
    light: { accent: '#4152C4', accentStrong: '#2F3E9E', onAccent: '#FFFFFF' },
    dark: { accent: '#9AA6FF', accentStrong: '#BAC3FF', onAccent: '#10163F' },
  },
  rose: {
    label: 'Rose',
    swatch: '#AE3F57',
    light: { accent: '#AE3F57', accentStrong: '#8E2F45', onAccent: '#FFFFFF' },
    dark: { accent: '#F4909F', accentStrong: '#F9B3BE', onAccent: '#3A0F19' },
  },
  graphite: {
    label: 'Graphite',
    swatch: '#2E3431',
    light: { accent: '#2E3431', accentStrong: '#1A1F1D', onAccent: '#FFFFFF' },
    dark: { accent: '#E4E8E5', accentStrong: '#FFFFFF', onAccent: '#121614' },
  },
};

export function buildTheme(isDark: boolean, tone: ToneId, accent: AccentId): Theme {
  const t = TONES[tone][isDark ? 'dark' : 'light'];
  const a = ACCENTS[accent][isDark ? 'dark' : 'light'];
  return {
    isDark,
    ...t,
    ...a,
    insetEdgeDark: isDark ? '#000000' : '#B9BFB7',
    insetEdgeLight: isDark ? '#2C3433' : '#F6F7F4',
    text: isDark ? '#EEF1EF' : '#1D2420',
    textSecondary: isDark ? '#A5AFA9' : '#58625C',
    success: isDark ? '#5FD3A4' : '#17684B',
    warning: isDark ? '#F0C26B' : '#7A5200',
    danger: isDark ? '#FF9A9A' : '#A12C2C',
    shadow: isDark ? '#000000' : '#8D968F',
    doorFrame: isDark ? '#050707' : '#2B2F36',
    doorLeaf: isDark ? '#3A4240' : '#C9CDC6',
    doorPanel: isDark ? '#2F3634' : '#B9BEB6',
    doorGlow: isDark ? '#B8A57A' : '#F6E7C8',
  };
}

export const RADII = { sm: 10, md: 14, lg: 20, xl: 26, round: 999 } as const;
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const MIN_TOUCH = 48;
