import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';

import { useTheme } from '@/hooks/use-theme';

interface DayPillProps {
  label: string;
  active: boolean;
  onPress?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
}

export function DayPill({ label, active, onPress, colors, fonts }: DayPillProps) {
  return (
    <TouchableOpacity
      style={[
        s.pill,
        {
          backgroundColor: active ? colors.primary : colors.surface2,
          borderColor: 'transparent',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}>
      <Text
        style={[
          s.text,
          { color: active ? '#fff' : colors.textMuted, fontFamily: fonts.bodySemibold },
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
  },
});
