import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

interface GlassViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function GlassView({
  intensity = 60,
  tint = 'dark',
  style,
  children,
}: GlassViewProps) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tint} style={[styles.base, style]}>
        {children}
      </BlurView>
    );
  }

  // Android fallback — solid dark surface with elevation shadow
  return (
    <View style={[styles.base, styles.androidFallback, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  androidFallback: {
    backgroundColor: Colors.dark.tabBar,
    elevation: 24,
  },
});
