import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { popupEvents } from '@/lib/popup-events';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { DISPLAY_DAYS, getWeekDates, todayISTStr, tomorrowISTStr } from '@/components/screens/deliveries/week-nav';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { HomeCriticalLog } from '@/types/api';

interface ThisWeekProps {
  preferredDays: string[];
  logs: HomeCriticalLog[];
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
  onDayPress: (log: HomeCriticalLog | null) => void;
  loading?: boolean;
}

export function ThisWeek({
  preferredDays,
  logs,
  colors,
  fonts,
  onDayPress,
  loading = false,
}: ThisWeekProps) {
  // ── Skeleton state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={weekStyles.grid}>
        {DISPLAY_DAYS.map((day) => (
          <View
            key={day}
            style={[weekStyles.cell, { backgroundColor: colors.surface2, borderColor: 'transparent', borderWidth: 0 }]}
          >
            {/* day label slot */}
            <Skeleton width={20} height={9} radius={3} />
            {/* date number slot — height matches fontSize:16 lineHeight */}
            <Skeleton width={22} height={19} radius={4} style={{ marginTop: 2 }} />
          </View>
        ))}
      </View>
    );
  }

  // ── Real state ──────────────────────────────────────────────────────────────
  const today = todayISTStr();
  const tomorrow = tomorrowISTStr();
  const weekDates = getWeekDates(0, today);
  const logByDate = new Map(logs.map((l) => [l.delivery_date, l]));

  return (
    <View style={weekStyles.grid}>
      {DISPLAY_DAYS.map((day, i) => {
        const date = weekDates[i];
        const log = logByDate.get(date);
        const isPreferred = preferredDays.includes(day);
        const isToday = date === today;
        const isPast = date < today;
        const isDelivered = log?.status === 'delivered';
        const isSkipped = log?.status === 'skipped';
        const isNext = date === tomorrow && isPreferred;

        let bg = colors.surface2;
        let fg = colors.textMuted;
        let border: string | undefined;

        if (isToday) { bg = colors.primary; fg = '#fff'; }
        else if (isDelivered) { bg = colors.primaryBg; fg = colors.primaryDark; }
        else if (isSkipped) { bg = colors.warningBg; fg = colors.warning; border = colors.warning; }
        else if (isPreferred && !isPast) { bg = colors.primaryBg; fg = colors.primaryDark; }
        if (!isSkipped && isNext) border = colors.primary;

        return (
          <TouchableOpacity
            key={day}
            style={[
              weekStyles.cell,
              { backgroundColor: bg, borderColor: border ?? 'transparent', borderWidth: border ? 1.5 : 0 },
              isToday && weekStyles.todayCell,
            ]}
            onPress={() => { popupEvents.emit(); onDayPress(log ?? null); }}
            activeOpacity={0.8}>
            <Text style={[weekStyles.dayLabel, { color: fg, fontFamily: fonts.bodyMedium }]}>
              {day.slice(0, 3).toUpperCase()}
            </Text>
            <Text style={[weekStyles.dateNum, { color: fg, fontFamily: fonts.display }]}>
              {Number(date.slice(8, 10))}
            </Text>
            {isDelivered && (
              <View style={[weekStyles.dot, { backgroundColor: fg }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const weekStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 5,
  },
  cell: {
    flex: 1,
    paddingVertical: Spacing[2.5],
    borderRadius: Radius.full,
    alignItems: 'center',
    gap: 2,
  },
  todayCell: {
    shadowColor: Brand.forest,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 0,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  dateNum: {
    fontSize: 16,
    fontWeight: FontWeight.semibold,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
    marginTop: 1,
  },
});
