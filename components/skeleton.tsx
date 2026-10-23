import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  /** Overrides the base (background) color. */
  baseColor?: string;
  /** Override the shimmer highlight color — should be lighter than baseColor */
  shimmerColor?: string;
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
  baseColor,
  shimmerColor,
}: SkeletonProps) {
  const { colors } = useTheme();
  const shimmerX = useSharedValue(-200);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(400, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
  }, [shimmerX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  const resolvedBase    = baseColor    ?? colors.skeleton;
  const resolvedShimmer = shimmerColor ?? colors.skeletonShimmer;

  const containerStyle = useMemo(() => {
    const base: ViewStyle = {
      height,
      borderRadius: radius,
      backgroundColor: resolvedBase,
    };
    if (typeof width === 'number') {
      base.width = width;
    } else {
      (base as Record<string, unknown>).width = width;
    }
    return base;
  }, [width, height, radius, resolvedBase]);

  return (
    <View style={[styles.base, containerStyle, style]}>
      <Animated.View
        style={[styles.shimmer, { backgroundColor: resolvedShimmer }, shimmerStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
});
