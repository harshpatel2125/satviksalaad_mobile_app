import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTimeRange } from '@/lib/slots';
import type { TimeSlot } from '@/types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

export const WEEK_DAYS = [
  { key: 'Monday',    short: 'Mon' },
  { key: 'Tuesday',   short: 'Tue' },
  { key: 'Wednesday', short: 'Wed' },
  { key: 'Thursday',  short: 'Thu' },
  { key: 'Friday',    short: 'Fri' },
  { key: 'Saturday',  short: 'Sat' },
] as const;

// ─── Section Label ────────────────────────────────────────────────────────────

export function SectionLabel({
  label,
  sub,
  enterDelay,
}: {
  label: string;
  sub?: string;
  enterDelay: number;
}) {
  const { colors, fonts } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).springify().damping(16)} style={slStyles.row}>
      <Text style={[slStyles.label, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>
        {label}
      </Text>
      {sub && <Text style={[slStyles.sub, { color: colors.textMuted, fontFamily: fonts.body }]}>{sub}</Text>}
    </Animated.View>
  );
}

const slStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, letterSpacing: 0.8 },
  sub:   { fontSize: FontSize.xs },
});

// ─── Delivery Schedule ────────────────────────────────────────────────────────

export function DeliverySchedule({
  selectedDays,
  onToggleDay,
  slots,
  selectedSlotId,
  onSelectSlot,
  enterDelay,
}: {
  selectedDays: string[];
  onToggleDay: (d: string) => void;
  slots: TimeSlot[];
  selectedSlotId: string;
  onSelectSlot: (id: string) => void;
  enterDelay: number;
}) {
  const { colors, fonts } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).springify().damping(14)}
      style={[
        schedStyles.card,
        { backgroundColor: colors.surface, borderWidth: 0 },
        CardEdge,
      ]}
    >
      <View style={schedStyles.header}>
        <View style={[schedStyles.headerIcon, { backgroundColor: colors.primaryBg }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
        </View>
        <Text style={[schedStyles.headerTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          Delivery Schedule
        </Text>
      </View>

      {/* Days */}
      <View style={schedStyles.block}>
        <Text style={[schedStyles.blockLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
          DELIVERY DAYS
        </Text>
        <View style={schedStyles.daysRow}>
          {WEEK_DAYS.map((d) => {
            const active = selectedDays.includes(d.key);
            return (
              <TouchableOpacity
                key={d.key}
                style={[
                  schedStyles.dayChip,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface2, borderColor: 'transparent' },
                ]}
                onPress={() => onToggleDay(d.key)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    schedStyles.dayText,
                    {
                      color: active ? '#fff' : colors.textMuted,
                      fontFamily: active ? fonts.bodySemibold : fonts.body,
                    },
                  ]}
                >
                  {d.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[schedStyles.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {"Select the days you'd like your bowl delivered"}
        </Text>
      </View>

      <View style={[schedStyles.divider, { backgroundColor: colors.border }]} />

      {/* Time slot */}
      <View style={schedStyles.block}>
        <Text style={[schedStyles.blockLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
          DELIVERY SLOT
        </Text>
        <View style={schedStyles.slotsRow}>
          {slots.map((slot) => {
            const active = selectedSlotId === slot.id;
            return (
              <TouchableOpacity
                key={slot.id}
                style={[
                  schedStyles.slotChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface2,
                    borderColor: 'transparent',
                  },
                ]}
                onPress={() => onSelectSlot(slot.id)}
                activeOpacity={0.8}
              >
                <Text style={schedStyles.slotEmoji}>{slot.icon ?? '⏰'}</Text>
                <View style={schedStyles.slotTextGroup}>
                  <Text
                    style={[
                      schedStyles.slotLabel,
                      { color: active ? colors.textOnPrimary : colors.text, fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    {slot.label}
                  </Text>
                  <Text style={[schedStyles.slotTime, { color: active ? colors.textOnPrimary : colors.textMuted, fontFamily: fonts.body }]}>
                    {formatTimeRange(slot.time_range)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[schedStyles.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
          We aim to deliver around this window
        </Text>
      </View>
    </Animated.View>
  );
}

const schedStyles = StyleSheet.create({
  card:        { borderRadius: Radius.xl, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4], paddingBottom: Spacing[3] },
  headerIcon:  { width: 34, height: 34, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.base },
  block:       { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[2] },
  blockLabel:  { fontSize: 11, letterSpacing: 0.5 },
  divider:     { height: 1, marginHorizontal: Spacing[4], marginBottom: Spacing[3] },
  hint:        { fontSize: FontSize.xs, marginTop: 2 },
  daysRow:     { flexDirection: 'row', gap: Spacing[2] },
  dayChip:     { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1 },
  dayText:     { fontSize: 12 },
  slotsRow:      { flexDirection: 'row', gap: Spacing[2] },
  slotChip:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 6, borderRadius: Radius.full, borderWidth: 1 },
  slotEmoji:     { fontSize: 16 },
  slotTextGroup: { alignItems: 'flex-start', gap: 1 },
  slotLabel:     { fontSize: FontSize.xs },
  slotTime:      { fontSize: 10, opacity: 0.7 },
});
