// Content widths for wide windows (iPad, Android tablets). Every phone is
// narrower than these, so applying them never changes a phone layout.
import type { ViewStyle } from 'react-native';

/** Short centered flows: sign-in, confirmations. */
export const NARROW_WIDTH = 480;

/** Bottom sheets and dialogs. */
export const SHEET_WIDTH = 560;

/** Forms, lists, detail screens: a comfortable reading width. */
export const READING_WIDTH = 680;

/** Grids (menu, videos), which gain columns instead of stretching. */
export const WIDE_WIDTH = 1040;

/** Centers content in a column no wider than `maxWidth`. */
export function column(maxWidth: number = READING_WIDTH): ViewStyle {
  return { width: '100%', maxWidth, alignSelf: 'center' };
}

/** How many grid columns fit `available` points when each needs at least `minItemWidth`. */
export function columnsFor(available: number, minItemWidth: number, gap: number, max = 4): number {
  return Math.max(1, Math.min(max, Math.floor((available + gap) / (minItemWidth + gap))));
}
