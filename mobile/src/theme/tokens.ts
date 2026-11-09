/**
 * Zpot design tokens. Values are taken from the HTML prototype (Main.dc.html) and the official logo:
 * logo green gradient #7ED321→#2F9F00, navy #0B2C44/#00233D.
 */
export const palette = {
  green500: '#63BB02', // primary action (prototype .btn)
  green600: '#58A902', // pressed
  green700: '#2A9612', // active indicators / switches
  green800: '#1D6E0C', // links hover / saved
  green900: '#1D5E08', // text on green tint
  green50: '#E5F5D0',
  green25: '#F6FCEF',
  navy900: '#00233D', // brand navy (text, dark buttons)
  navy700: '#22384A',
  navy600: '#3D5163',
  slate500: '#4A6478',
  slate400: '#6B7A86',
  slate300: '#8A99A5',
  slate200: '#C5D0D8',
  slate150: '#DCE3E8',
  slate100: '#E6ECEF',
  slate75: '#EDF1F3',
  slate50: '#F4F7F8',
  white: '#FFFFFF',
  amber50: '#FFF1D6',
  amber100: '#FFE3A6',
  amber500: '#E6A23C',
  amber700: '#B26B00',
  amber900: '#7A4600',
  blue50: '#E1EBFA',
  blue100: '#E8F0F6',
  blue400: '#5B8DE0',
  blue600: '#1F5FBF',
  blue800: '#17489A',
  red50: '#FDE7E5',
  red500: '#C0392B',
  red600: '#B42318',
  red700: '#A1251B',
  purple50: '#ECE7FD',
  purple500: '#5B3FD0',
  purple700: '#4B2FB8',
} as const;

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = { [K in keyof typeof lightBase]: string };

const lightBase = {
  background: palette.white,
  surface: palette.white,
  surfaceMuted: palette.slate50,
  border: palette.slate150,
  borderStrong: palette.slate200,
  divider: palette.slate75,
  text: palette.navy900,
  textBody: palette.navy700,
  textMuted: palette.slate500,
  textSubtle: palette.slate400,
  primary: palette.green500,
  primaryPressed: palette.green600,
  onPrimary: palette.navy900,
  accent: palette.green700,
  link: palette.navy900,
  danger: palette.red600,
  focus: '#9AD94A',
  scrim: 'rgba(0,20,36,0.45)',
  disabledBg: '#E3E8EB',
  disabledText: palette.slate400,
  mapBackdrop: '#EEF2F4',
};
const light: ThemeColors = lightBase;

const dark: ThemeColors = {
  background: '#0B1620',
  surface: '#12212D',
  surfaceMuted: '#182B39',
  border: '#24394A',
  borderStrong: '#335067',
  divider: '#1C3141',
  text: '#F2F6F8',
  textBody: '#D5E0E7',
  textMuted: '#A3B4C1',
  textSubtle: '#8597A5',
  primary: palette.green500,
  primaryPressed: palette.green600,
  onPrimary: palette.navy900,
  accent: '#7ED321',
  link: '#CFE9B0',
  danger: '#F2867B',
  focus: '#9AD94A',
  scrim: 'rgba(0,0,0,0.6)',
  disabledBg: '#24394A',
  disabledText: '#8597A5',
  mapBackdrop: '#182B39',
};

export const colorSchemes: Record<ColorScheme, ThemeColors> = { light, dark };

/** Parking classification colours (identical in both schemes for legibility on maps). */
export const parkingColors = {
  free: { bg: palette.green50, fg: palette.green900, marker: palette.green500, markerText: palette.navy900, line: palette.green500 },
  free_time_limited: { bg: palette.amber50, fg: palette.amber900, marker: palette.amber100, markerText: '#5C3600', line: palette.amber500, border: palette.amber700 },
  paid: { bg: palette.blue50, fg: palette.blue800, marker: palette.blue600, markerText: palette.white, line: palette.blue400 },
  restricted: { bg: palette.red50, fg: palette.red700, marker: palette.white, markerText: palette.red700, line: palette.red500, border: palette.red500 },
  unknown: { bg: '#EEF1F3', fg: '#3D4C57', marker: palette.slate50, markerText: '#3D4C57', line: palette.slate300, border: palette.slate400 },
  vacancy: { bg: palette.purple50, fg: palette.purple700, marker: palette.purple500, markerText: palette.white, line: palette.purple500 },
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 12, lg: 14, xl: 16, xxl: 24, pill: 999 } as const;

export const typography = {
  fontFamily: undefined as string | undefined, // system font (SF Pro / Roboto); prototype uses Inter
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.4, lineHeight: 34 },
  h1: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3, lineHeight: 30 },
  header: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 26 },
  h2: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  button: { fontSize: 16, fontWeight: '700' as const },
  meta: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  badge: { fontSize: 13, fontWeight: '700' as const },
  small: { fontSize: 12, fontWeight: '600' as const },
} as const;

export const shadows = {
  card: { shadowColor: palette.navy900, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sheet: { shadowColor: palette.navy900, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  marker: { shadowColor: palette.navy900, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
} as const;

export const sizes = { touch: 44, button: 52, input: 50, chip: 40, tabBar: 64 } as const;
