import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { READING_WIDTH } from '@/constants/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Mirror the tab bar constants so every action bar matches the tab bar height.
const BAR_BASE_H = Platform.OS === "ios" ? 58 : 60;
const BAR_BOTTOM_PAD = Platform.OS === "ios" ? -4 : 12;

interface BottomActionBarProps {
  children: React.ReactNode;
  /** Use when the bar overlays content (position absolute). Default: flex flow. */
  absolute?: boolean;
  /** Skip fixed height — content determines bar height. Use for multi-row bars. */
  flexible?: boolean;
  style?: ViewStyle;
  /** Lines the buttons up with the screen's content column on wide screens. */
  maxWidth?: number;
}

export function BottomActionBar({
  children,
  absolute,
  flexible,
  style,
  maxWidth = READING_WIDTH,
}: BottomActionBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Android gesture navigation leaves an inset of ≤16dp (a button bar is ≥40dp)
  // and needs extra bottom padding.
  const extraBottomPad =
    Platform.OS === "android" && insets.bottom <= 16 ? 8 : 0;

  return (
    <View
      style={[
        styles.bar,
        absolute && styles.absolute,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(!flexible && { height: BAR_BASE_H + insets.bottom + BAR_BOTTOM_PAD + extraBottomPad }),
          paddingBottom: insets.bottom + BAR_BOTTOM_PAD + extraBottomPad,
          paddingHorizontal: Math.max(Spacing[5], (width - maxWidth) / 2 + Spacing[5]),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 4,
    borderTopWidth: 1,
    justifyContent: "center",
  },
  absolute: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
