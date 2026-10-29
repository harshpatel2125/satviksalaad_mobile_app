import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

/**
 * The top safe-area inset, never below a small margin. An opened iPhone Duo
 * keeps its status bar at the side, which leaves no top inset at all.
 */
export function useTopInset(): number {
  return Math.max(useSafeAreaInsets().top, Spacing[3]);
}
