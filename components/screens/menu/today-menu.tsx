import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { LayoutAnimation, StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { menuApi } from '@/lib/api';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import type { DayMenu } from '@/types/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-26" → "26 Oct". */
function dayMonth(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1] ?? ''}`;
}

function dishes(day: DayMenu) {
  return [
    { label: 'Salad', icon: 'leaf-outline' as const, name: day.salad },
    { label: 'Soup', icon: 'cafe-outline' as const, name: day.soup },
    { label: 'Juice', icon: 'water-outline' as const, name: day.juice },
  ].filter((dish): dish is typeof dish & { name: string } => Boolean(dish.name));
}

/**
 * The salad, soup and juice of the day side by side; nothing until the menu is set.
 * With `onSeeMenu` it links to the full menu, otherwise it can open the week ahead.
 */
export function TodayMenu({ style, onSeeMenu }: { style?: ViewStyle; onSeeMenu?: () => void }) {
  const { colors, fonts } = useTheme();
  const [showWeek, setShowWeek] = useState(false);
  const { data } = useQuery({
    queryKey: ['daily-menu'],
    queryFn: menuApi.daily,
    staleTime: CACHE_TTL.menu,
    persister: asyncPersister.persisterFn,
  });
  const day = data?.data.next;
  const week = (data?.data.week ?? []).filter((d) => d.date !== day?.date);
  if (!day) return null;

  function toggleWeek() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowWeek((v) => !v);
  }

  const action = onSeeMenu
    ? { label: 'Full menu', icon: 'chevron-forward' as const, onPress: onSeeMenu }
    : week.length > 0
      ? { label: 'This week', icon: showWeek ? ('chevron-up' as const) : ('chevron-down' as const), onPress: toggleWeek }
      : null;

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge, style]}>
      <View style={s.head}>
        <View style={s.headText}>
          <Text style={[s.eyebrow, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
            {day.isToday ? 'TODAY AT SATVIK' : 'TOMORROW AT SATVIK'}
          </Text>
          <Text style={[s.date, { color: colors.text, fontFamily: fonts.display }]}>
            {day.weekdayName} {dayMonth(day.date)}
          </Text>
        </View>
        {action ? (
          <TouchableOpacity
            onPress={action.onPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={onSeeMenu ? undefined : { expanded: showWeek }}
            style={s.action}
          >
            <Text style={[s.actionText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>{action.label}</Text>
            <Ionicons name={action.icon} size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.tiles}>
        {dishes(day).map((dish) => (
          <View key={dish.label} style={[s.tile, { backgroundColor: colors.surface2 }]}>
            <Ionicons name={dish.icon} size={16} color={colors.primary} />
            <Text style={[s.tileLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
              {dish.label.toUpperCase()}
            </Text>
            <Text style={[s.tileName, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={2}>
              {dish.name}
            </Text>
          </View>
        ))}
      </View>

      {showWeek && !onSeeMenu ? (
        <View style={s.week}>
          {week.map((d) => (
            <View key={d.date} style={[s.weekRow, { borderTopColor: colors.border }]}>
              <Text style={[s.weekDay, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                {d.weekdayName.slice(0, 3)} {dayMonth(d.date)}
              </Text>
              <Text style={[s.weekDishes, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {dishes(d).map((dish) => dish.name).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing[4] },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing[2] },
  headText: { flex: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.1 },
  date: { fontSize: FontSize.lg, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 },
  actionText: { fontSize: FontSize.sm },
  tiles: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[3] },
  tile: { flex: 1, borderRadius: Radius.md, padding: Spacing[2.5], gap: 3 },
  tileLabel: { fontSize: 10, letterSpacing: 0.8 },
  tileName: { fontSize: FontSize.xs, lineHeight: FontSize.xs * 1.35 },
  week: { marginTop: Spacing[3] },
  weekRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing[2], gap: 2 },
  weekDay: { fontSize: FontSize.sm },
  weekDishes: { fontSize: FontSize.xs },
});
