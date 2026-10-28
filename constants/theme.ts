import { Platform, StyleSheet, type ViewStyle } from 'react-native';

// ─── Primitive palette (Satvik Salaad brand, the website's tokens) ───────────
const palette = {
  forest:      '#235C3B',   // PRIMARY
  forestDark:  '#143D27',
  forestSoft:  '#E6F0E9',   // soft green panels, selected chips
  forestTint:  '#F0F6F2',
  onForestSoft: '#19432A',

  sageSoft: '#E3EBE0',

  gold:     '#EC9C13',      // offers and badges only
  goldSoft: '#FDF3DD',
  onGold:   '#3A2603',

  background: '#FBFBF9',
  muted:      '#F4F4F0',

  ink:       '#12211A',
  inkMuted:  '#576B61',
  line:      '#DDE2DA',
  lineLight: '#E9ECE6',

  blue500:   '#1A8BF5',
  blue100:   '#D6ECFE',
  purple500: '#7B4EC5',
  purple100: '#EDE0FA',
  orange500: '#F07818',
  orange100: '#FEE9D6',

  red:      '#DC2828',
  redSoft:  '#FDE8E8',

  // Brighter than the brand green so success states stay distinct from it
  success500: '#1F9D55',
  success100: '#DCF5E5',

  white: '#FFFFFF',
};

/** Brand colours for static styles that cannot read the theme (shadows, third-party SDKs). */
export const Brand = {
  forest: palette.forest,
  forestDark: palette.forestDark,
  sageLight: palette.forestSoft,
} as const;

// ─── Light theme ──────────────────────────────────────────────────────────────
const light = {
  // Backgrounds
  background:      palette.background,
  surface:         palette.white,
  surface2:        palette.muted,

  // Text
  text:            palette.ink,
  textSecondary:   '#34463C',
  textMuted:       palette.inkMuted,
  textDisabled:    '#A9B3AC',
  textOnPrimary:   palette.white,

  // Brand
  primary:         palette.forest,
  primaryDark:     palette.forestDark,
  primaryBg:       palette.forestSoft,
  primaryTint:     palette.forestTint,
  onPrimaryBg:     palette.onForestSoft,
  sageSoft:        palette.sageSoft,

  // Accent (gold) — offers and badges
  accent:          palette.gold,
  accentBg:        palette.goldSoft,
  onAccent:        palette.onGold,

  // Border
  border:          palette.line,
  borderLight:     palette.lineLight,

  // Status
  success:         palette.success500,
  successBg:       palette.success100,
  error:           palette.red,
  errorBg:         palette.redSoft,
  warning:         palette.gold,
  warningBg:       palette.goldSoft,

  // Semantic extras
  blue:            palette.blue500,
  blueBg:          palette.blue100,
  purple:          palette.purple500,
  purpleBg:        palette.purple100,
  orange:          palette.orange500,
  orangeBg:        palette.orange100,

  // Navigation / Tab bar
  tabBar:          palette.white,
  tabBarBorder:    palette.line,
  tabBarActive:    palette.forest,
  tabBarInactive:  palette.inkMuted,

  // Skeleton
  skeleton:        '#EEF0EA',
  skeletonShimmer: palette.background,
};

// ─── Dark theme ───────────────────────────────────────────────────────────────
const dark = {
  background: "#0B0B0B",
  surface: "#161616",
  surface2: "#202020",

  text: "#F5F5F5",
  textSecondary: "#D4D4D4",
  textMuted: "#A3A3A3",
  textDisabled: "#5C5C5C",
  textOnPrimary: palette.white,

  // Neutral greys; green only marks brand and state.
  primary: "#3DBE73",
  primaryDark: palette.forest,
  primaryBg: "#1F2A23",
  primaryTint: "#18201B",
  onPrimaryBg: "#D4E9DB",
  sageSoft: "#1F2A23",

  accent: "#F4A825",
  accentBg: "#2E2410",
  onAccent: palette.onGold,

  border: "#262626",
  borderLight: "#1F1F1F",

  success: "#34C774",
  successBg: "#0A1F12",
  error: "#F05252",
  errorBg: "#2A1010",
  warning: "#F4A825",
  warningBg: "#2E2410",

  blue: "#60A5FA",
  blueBg: "#0A1520",
  purple: "#A78BFA",
  purpleBg: "#150D28",
  orange: "#FB923C",
  orangeBg: "#1A0C00",

  tabBar: "#111111",
  tabBarBorder: "#262626",
  tabBarActive: "#3DBE73",
  tabBarInactive: "#8E8E8E",

  skeleton: "#1A1A1A",
  skeletonShimmer: "#242424",
};

export const Colors = { light, dark } as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof light;

// ─── Typography ───────────────────────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "1.5xl": 22,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
  "5xl": 40,
  "6xl": 56,
} as const;

export const FontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
};

export const LineHeight = {
  tight:   1.15,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.65,
};

// ─── Spacing (4px base unit) ──────────────────────────────────────────────────
export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  "2.5": 10,
  3: 12,
  "3.25": 13,
  "3.5": 14,
  4: 16,
  "4.5": 18,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const Radius = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    16,   // cards, matching the website
  '2xl': 20,
  '3xl': 32,
  full:  9999,
} as const;

// ─── Elevation / shadows ──────────────────────────────────────────────────────
// Kept deliberately faint: surfaces are told apart by colour and hairlines,
// not by being lifted off the page.
export const Shadows = {
  xs: Platform.select({
    ios:     { shadowColor: '#12211A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2 },
    android: { elevation: 0 },
    default: {},
  }),
  sm: Platform.select({
    ios:     { shadowColor: '#12211A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios:     { shadowColor: '#12211A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
    android: { elevation: 1 },
    default: {},
  }),
  lg: Platform.select({
    ios:     { shadowColor: '#12211A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    android: { elevation: 2 },
    default: {},
  }),
  xl: Platform.select({
    ios:     { shadowColor: '#12211A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10 },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

/**
 * Card edge: a hairline plus, on iOS only, the faintest shadow. The line is a
 * translucent ink so it reads on both the light and the dark page.
 */
export const CardEdge = Platform.select<ViewStyle>({
  ios:     { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(18,33,26,0.12)', shadowColor: '#12211A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
  android: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(18,33,26,0.14)' },
  default: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(18,33,26,0.12)' },
});

// ─── Font families ─────────────────────────────────────────────────────────────
// Display: Young Serif, body: Figtree — the same pair as the website.
export const Fonts = {
  display: 'YoungSerif_400Regular',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemibold: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  mono: Platform.select({
    ios: 'Courier New',
    android: 'monospace',
    default: 'monospace',
  }) as string,
} as const;
