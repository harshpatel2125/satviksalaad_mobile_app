import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { CardEdge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DeliveryCardProps {
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
  style?: ViewStyle;
}

export function DeliveryCard({ children, colors, style }: DeliveryCardProps) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.surface, borderWidth: 0 },
        CardEdge,
        style,
      ]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
});
