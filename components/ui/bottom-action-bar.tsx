import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

export function BottomActionBar({
  children,
  absolute,
  flexible,
  style,
}: BottomActionBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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
    paddingHorizontal: Spacing[5],
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
