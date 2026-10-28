import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Brand, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { habitTipOfTheDay } from '@/lib/habit-tips';

export function HabitTipCard() {
  const { colors, fonts } = useTheme();

  return (
    <View style={[s.card, { backgroundColor: colors.primaryTint }]}>
      <View style={[s.badge, { backgroundColor: Brand.forest }]}>
        <Ionicons name="leaf" size={16} color="#fff" />
      </View>
      <View style={s.body}>
        <Text style={[s.text, { color: colors.text, fontFamily: fonts.body }]}>
          <Text style={{ fontFamily: fonts.bodyBold }}>Habit of the day: </Text>
          {habitTipOfTheDay()}
        </Text>
        <Text style={[s.byline, { color: colors.textMuted, fontFamily: fonts.body }]}>Satvik Salaad</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', gap: Spacing[3], padding: Spacing[3], borderRadius: Radius.lg },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  text: { fontSize: FontSize.sm, lineHeight: 19 },
  byline: { fontSize: FontSize.xs },
});
