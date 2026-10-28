import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface WaterTrackerProps {
  glasses: number;
  target: number;
  onChange: (glasses: number) => void;
}

export function WaterTracker({ glasses, target, onChange }: WaterTrackerProps) {
  const { colors, fonts } = useTheme();

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
      <View style={s.head}>
        <Text style={[s.label, { color: colors.blue, fontFamily: fonts.bodyBold }]}>WATER</Text>
        <Text style={[s.count, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {Math.min(glasses, target)} of {target} glasses
        </Text>
      </View>
      <View style={s.glasses}>
        {Array.from({ length: target }, (_, index) => {
          const filled = index < glasses;
          return (
            <TouchableOpacity
              key={index}
              // Tapping the last filled glass empties it, so a mistap is one tap to undo.
              onPress={() => onChange(index + 1 === glasses ? index : index + 1)}
              hitSlop={4}
              activeOpacity={0.6}
              accessibilityLabel={`${index + 1} glasses`}
            >
              <Ionicons name={filled ? 'water' : 'water-outline'} size={28} color={filled ? colors.blue : colors.border} />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[s.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>More on hot days and after a workout.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing[4], gap: Spacing[2] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: FontSize.xs, letterSpacing: 0.9 },
  count: { fontSize: FontSize.sm },
  glasses: { flexDirection: 'row', justifyContent: 'space-between' },
  hint: { fontSize: FontSize.xs },
});
