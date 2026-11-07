// Owner: Account 1. Brand values come from frontend/src/tokens.css ("Summit").
// Status colours (success, danger) are NOT in the website tokens: Account 1 added them; contrast is checked in tokens.test.ts.
export interface ThemeColors {
  bg: string; surface: string; surface2: string; tint: string; line: string; lineStrong: string;
  ink: string; text: string; muted: string;
  primary: string; primaryPressed: string; onPrimary: string; link: string;
  gold: string; onGold: string; goldSoft: string; goldText: string;
  info: string; infoSoft: string; success: string; successSoft: string; danger: string; dangerSoft: string;
  overlay: string;
}

export const lightColors: ThemeColors = {
  bg: '#F7F9FD', surface: '#FFFFFF', surface2: '#EDF2FB', tint: '#E8F0FF', line: '#D5DDEC', lineStrong: '#7D8BAF',
  ink: '#0B1F4B', text: '#1B2640', muted: '#465273',
  primary: '#1F5FE0', primaryPressed: '#1748B8', onPrimary: '#FFFFFF', link: '#1F5FE0',
  gold: '#F2B33D', onGold: '#0B1F4B', goldSoft: '#FDF1D6', goldText: '#7A4F00',
  info: '#1748B8', infoSoft: '#E8F0FF', success: '#14663A', successSoft: '#E3F4EA', danger: '#B3261E', dangerSoft: '#FDECEA',
  overlay: 'rgba(11, 31, 75, 0.45)',
};

export const darkColors: ThemeColors = {
  bg: '#0A1224', surface: '#131E3A', surface2: '#0E1830', tint: '#16264D', line: '#263459', lineStrong: '#5C6E9C',
  ink: '#E8EEFF', text: '#E6ECFB', muted: '#A9B6D3',
  primary: '#1F5FE0', primaryPressed: '#1748B8', onPrimary: '#FFFFFF', link: '#8DB4FF',
  gold: '#F2B33D', onGold: '#0B1F4B', goldSoft: '#2B2616', goldText: '#F2B33D',
  info: '#A9C7FF', infoSoft: '#16264D', success: '#6FD196', successSoft: '#10291C', danger: '#FF9C94', dangerSoft: '#3A1613',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { control: 12, card: 20, pill: 999 } as const;
/** Smallest touch target in dp. */
export const MIN_TARGET = 48;

export const fonts = {
  body: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  display: 'Fraunces_600SemiBold',
} as const;

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
/** Base sizes (dp) before the user's text-size setting. Display (Fraunces) is for big headlines only. */
export const typeScale: Record<TextVariant, { size: number; font: string }> = {
  display: { size: 32, font: fonts.display },
  title: { size: 24, font: fonts.bold },
  heading: { size: 18, font: fonts.semibold },
  body: { size: 16, font: fonts.body },
  label: { size: 14, font: fonts.semibold },
  caption: { size: 12, font: fonts.body },
};

export type TextSize = 'small' | 'default' | 'large' | 'xlarge';
export const textScales: Record<TextSize, number> = { small: 0.9, default: 1, large: 1.15, xlarge: 1.3 };
export const textSizeLabels: Record<TextSize, string> = { small: 'Small', default: 'Default', large: 'Large', xlarge: 'Extra large' };

/** Motion rules: short and few. When the phone asks for reduced motion, durations are 0 and nothing loops. */
export const motion = { fast: 120, base: 200, slow: 320 } as const;

export const elevation = {
  0: {},
  1: { elevation: 2, shadowColor: '#0B1F4B', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  2: { elevation: 6, shadowColor: '#0B1F4B', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
} as const;
