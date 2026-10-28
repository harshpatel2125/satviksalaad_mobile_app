import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/daily-goals';

interface GoalRowProps {
  goal: Goal;
  done: boolean;
  /** Glasses so far, for the water goal. */
  water?: number;
  onToggle: () => void;
  onAddWater?: () => void;
  /** Runs before following the goal's link, e.g. to close a sheet. */
  onNavigate?: () => void;
  first?: boolean;
}

export function GoalRow({ goal, done, water = 0, onToggle, onAddWater, onNavigate, first }: GoalRowProps) {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const isWater = goal.target !== undefined;
  const detail = isWater ? `${Math.min(water, goal.target!)} of ${goal.target} glasses` : goal.when;

  return (
    <View style={[s.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <TouchableOpacity
        onPress={isWater ? onAddWater : onToggle}
        hitSlop={8}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={goal.title}
        style={[s.check, done ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }]}
      >
        {done ? <Ionicons name="checkmark" size={15} color={colors.textOnPrimary} /> : null}
      </TouchableOpacity>

      <View style={s.text}>
        <Text
          style={[
            s.title,
            { color: done ? colors.textMuted : colors.text, fontFamily: fonts.bodySemibold },
            done && s.struck,
          ]}
          numberOfLines={1}
        >
          {goal.title}
        </Text>
        <Text style={[s.detail, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>

      {isWater && !done && onAddWater ? (
        <TouchableOpacity onPress={onAddWater} activeOpacity={0.7} style={[s.pill, { backgroundColor: colors.blueBg }]}>
          <Text style={[s.pillText, { color: colors.blue, fontFamily: fonts.bodySemibold }]}>+ Glass</Text>
        </TouchableOpacity>
      ) : goal.link && !done ? (
        <TouchableOpacity
          onPress={() => {
            onNavigate?.();
            router.push(goal.link!.href);
          }}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Text style={[s.link, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>{goal.link.label} ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3] },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  title: { fontSize: FontSize.base },
  struck: { textDecorationLine: 'line-through' },
  detail: { fontSize: FontSize.xs },
  link: { fontSize: FontSize.sm },
  pill: { paddingHorizontal: Spacing[3], paddingVertical: 6, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs },
});
