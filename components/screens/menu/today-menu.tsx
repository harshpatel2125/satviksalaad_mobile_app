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
    { label: 'Salad of the day', icon: 'leaf-outline' as const, name: day.salad },
    { label: 'Soup', icon: 'cafe-outline' as const, name: day.soup },
    { label: 'Juice', icon: 'water-outline' as const, name: day.juice },
  ].filter((dish): dish is typeof dish & { name: string } => Boolean(dish.name));
}

/** The salad, soup and juice of the day, and the week ahead on request; nothing until the menu is set. */
export function TodayMenu({ style }: { style?: ViewStyle }) {
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

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge, style]}>
      <Text style={[s.eyebrow, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
        {day.isToday ? 'TODAY AT SATVIK' : 'TOMORROW AT SATVIK'}
      </Text>
      <Text style={[s.date, { color: colors.text, fontFamily: fonts.display }]}>
        {day.weekdayName} {dayMonth(day.date)}
      </Text>

      <View style={s.dishes}>
        {dishes(day).map((dish) => (
          <View key={dish.label} style={s.dish}>
            <View style={[s.dishIcon, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name={dish.icon} size={15} color={colors.primary} />
            </View>
            <View style={s.dishText}>
              <Text style={[s.dishLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                {dish.label.toUpperCase()}
              </Text>
              <Text style={[s.dishName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{dish.name}</Text>
            </View>
          </View>
        ))}
      </View>

      {week.length > 0 ? (
        <>
          <TouchableOpacity
            onPress={toggleWeek}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showWeek }}
            style={s.weekToggle}
          >
            <Text style={[s.weekToggleText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
              {showWeek ? 'Hide the week' : "This week's menu"}
            </Text>
            <Ionicons name={showWeek ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
          </TouchableOpacity>
          {showWeek
            ? week.map((d) => (
                <View key={d.date} style={[s.weekRow, { borderTopColor: colors.border }]}>
                  <Text style={[s.weekDay, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                    {d.weekdayName.slice(0, 3)} {dayMonth(d.date)}
                  </Text>
                  <Text style={[s.weekDishes, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    {dishes(d).map((dish) => dish.name).join(' · ')}
                  </Text>
                </View>
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing[4] },
  eyebrow: { fontSize: 11, letterSpacing: 1.1 },
  date: { fontSize: FontSize.xl, marginTop: 2 },
  dishes: { gap: Spacing[2.5], marginTop: Spacing[3] },
  dish: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  dishIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dishText: { flex: 1 },
  dishLabel: { fontSize: 10, letterSpacing: 0.8 },
  dishName: { fontSize: FontSize.sm },
  weekToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing[3], alignSelf: 'flex-start' },
  weekToggleText: { fontSize: FontSize.sm },
  weekRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing[2], gap: 2 },
  weekDay: { fontSize: FontSize.sm },
  weekDishes: { fontSize: FontSize.xs },
});
