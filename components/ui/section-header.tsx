import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SectionHeaderProps {
  label: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ label, action, onAction }: SectionHeaderProps) {
  const { colors, fonts } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.label, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
        {label.toUpperCase()}
      </Text>
      {action && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}>
          <Text style={[s.action, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
            {action}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.1,
  },
  action: {
    fontSize: FontSize.sm,
  },
});
