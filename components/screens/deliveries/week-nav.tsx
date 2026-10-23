import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DISPLAY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DAY_SHORT: Record<string, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

// ─── IST helpers ─────────────────────────────────────────────────────────────

export function todayISTStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function tomorrowISTStr(): string {
  return new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function istHourNow(): number {
  const s = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  });
  return parseInt(s, 10);
}

export function canEditMobile(dateStr: string): boolean {
  const today = todayISTStr();
  if (dateStr <= today) return false;
  const tomorrow = tomorrowISTStr();
  if (dateStr === tomorrow && istHourNow() >= 23) return false;
  return true;
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns Mon–Sat date strings for the week at given offset (0 = active week; on Sunday, the coming one). */
export function getWeekDates(offset: number, todayStr: string): string[] {
  // IST noon is 06:30 UTC on the same date, so UTC day arithmetic on it gives
  // IST dates whatever the device's timezone.
  const today = new Date(todayStr + 'T12:00:00+05:30');
  const dow = today.getUTCDay();
  const daysToMonday = dow === 0 ? 1 : 1 - dow;
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + daysToMonday + offset * 7 + i);
    return d.toISOString().slice(0, 10);
  });
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + 'T00:00:00');
  const e = new Date(weekEnd + 'T00:00:00');
  const startFmt = s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const endFmt = e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${startFmt} – ${endFmt}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WeekNavProps {
  weekOffset: number;
  weekStart: string;
  weekEnd: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  isAnyPending: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJumpToActive: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
}

export function WeekNav({
  weekOffset,
  weekStart,
  weekEnd,
  canGoPrev,
  canGoNext,
  isAnyPending,
  onPrev,
  onNext,
  onJumpToActive,
  colors,
  fonts,
}: WeekNavProps) {
  return (
    <View style={s.row}>
      <TouchableOpacity
        style={s.navBtn}
        onPress={onPrev}
        disabled={!canGoPrev || isAnyPending}
        activeOpacity={0.7}>
        <Ionicons
          name="chevron-back"
          size={20}
          color={canGoPrev && !isAnyPending ? colors.text : colors.border}
        />
      </TouchableOpacity>

      <View style={s.center}>
        {weekOffset !== 0 && (
          <TouchableOpacity
            onPress={onJumpToActive}
            style={[s.todayChip, { borderColor: isAnyPending ? colors.border : colors.primary }]}
            disabled={isAnyPending}
            activeOpacity={0.7}>
            <Text
              style={[
                s.todayChipText,
                {
                  color: isAnyPending ? colors.textMuted : colors.primary,
                  fontFamily: fonts.bodyMedium,
                },
              ]}>
              {weekOffset < 0 ? 'Past week' : 'Upcoming'}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[s.weekRange, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          {formatWeekRange(weekStart, weekEnd)}
        </Text>
      </View>

      <TouchableOpacity
        style={s.navBtn}
        onPress={onNext}
        disabled={!canGoNext || isAnyPending}
        activeOpacity={0.7}>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={canGoNext && !isAnyPending ? colors.text : colors.border}
        />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  navBtn: {
    padding: Spacing[2],
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekRange: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  todayChip: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  todayChipText: {
    fontSize: 10,
  },
});
