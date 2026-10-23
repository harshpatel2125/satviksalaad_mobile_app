import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { CardEdge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function SkeletonCard() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge, pulse]}>
      <View style={styles.headerRow}>
        <View style={[styles.block, styles.name, { backgroundColor: colors.surface2 }]} />
        <View style={[styles.block, styles.pill, { backgroundColor: colors.surface2 }]} />
      </View>
      <View style={[styles.block, styles.line, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.block, styles.lineShort, { backgroundColor: colors.surface2 }]} />
      <View style={styles.metaRow}>
        <View style={[styles.block, styles.metaChip, { backgroundColor: colors.surface2 }]} />
        <View style={[styles.block, styles.metaChip, { backgroundColor: colors.surface2 }]} />
      </View>
      <View style={[styles.block, styles.button, { backgroundColor: colors.surface2 }]} />
    </Animated.View>
  );
}

// Shown only while the first load for a date or filter has no data yet, so it
// is never mistaken for an empty result.
export default function DeliveryListSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing[3.5],
    marginBottom: Spacing[2.5],
    gap: Spacing[2.5],
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  block: { borderRadius: Radius.sm },
  name: { width: '45%', height: 16 },
  pill: { width: 70, height: 20, borderRadius: Radius.full },
  line: { width: '90%', height: 12 },
  lineShort: { width: '60%', height: 12 },
  metaRow: { flexDirection: 'row', gap: Spacing[2] },
  metaChip: { width: 80, height: 22, borderRadius: Radius.full },
  button: { width: '100%', height: 38, borderRadius: Radius.md, marginTop: Spacing[1] },
});
