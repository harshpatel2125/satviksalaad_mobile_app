import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeekDay } from '@/lib/daily-goals';

export function WeekStrip({ days }: { days: WeekDay[] }) {
  const { colors, fonts } = useTheme();

  return (
    <View style={s.row}>
      {days.map((day) => {
        const look = {
          full: { bg: colors.primary, fg: colors.textOnPrimary },
          partial: { bg: colors.primaryBg, fg: colors.primary },
          rest: { bg: colors.accentBg, fg: colors.accent },
          empty: { bg: colors.surface2, fg: colors.textMuted },
          upcoming: { bg: colors.surface2, fg: colors.textDisabled },
        }[day.status];
        return (
          <View key={day.key} style={s.day}>
            <Text style={[s.letter, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>{day.letter}</Text>
            <View
              style={[
                s.dot,
                { backgroundColor: look.bg },
                day.isToday && { borderWidth: 2, borderColor: colors.primary },
              ]}
            >
              {day.status === 'full' ? (
                <Ionicons name="checkmark" size={15} color={look.fg} />
              ) : (
                <Text style={[s.mark, { color: look.fg, fontFamily: fonts.bodyBold }]}>
                  {day.status === 'partial' ? day.doneCount || '' : day.status === 'rest' ? 'R' : ''}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: Spacing[1], flex: 1 },
  letter: { fontSize: FontSize.xs },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mark: { fontSize: FontSize.sm },
});
