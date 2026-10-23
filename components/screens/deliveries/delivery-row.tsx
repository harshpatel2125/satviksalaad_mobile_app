import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';

import { StatusPill } from '@/components/ui/status-pill';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { slotLabel } from '@/lib/slots';
import type { DeliveryLog, TimeSlot } from '@/types/api';

import { canEditMobile, todayISTStr, tomorrowISTStr } from './week-nav';

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = todayISTStr();
  const tomorrow = tomorrowISTStr();
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDayDate(iso: string): { day: string; date: number } {
  const d = new Date(iso + 'T00:00:00');
  return {
    day: d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(),
    date: d.getDate(),
  };
}

// ─── Meal info type ───────────────────────────────────────────────────────────

export interface MealInfo {
  name: string;
  image_url: string | null;
}

/** The bowl a delivery shows: the generic bowl for the customer's plan category. */
export function bowlFor(category: string | null | undefined): MealInfo {
  return { name: category === 'fruit' ? 'Fruit Bowl' : 'Salad Bowl', image_url: null };
}

// ─── Delivery row (schedule week) ─────────────────────────────────────────────

interface DeliveryRowProps {
  dateStr: string;
  log: DeliveryLog | undefined;
  index: number;
  today: string;
  passPurchaseId: string | undefined;
  hasPurchase?: boolean;
  bowl: MealInfo;
  slots: TimeSlot[];
  adjustingIds: Set<string>;
  skippingIds: Set<string>;
  isAnyPending: boolean;
  isNonPreferredDay?: boolean;
  lastScheduledDate?: string | null;
  schedulingExtraDates?: Set<string>;
  colors: ReturnType<typeof useTheme>["colors"];
  fonts: ReturnType<typeof useTheme>["fonts"];
  onPress: (log: DeliveryLog) => void;
  onQtyChange: (log: DeliveryLog, delta: number) => void;
  onSkip: (log: DeliveryLog) => void;
  onUnskip: (log: DeliveryLog) => void;
  onScheduleExtra?: (dateStr: string) => void;
}

export function DeliveryRow({
  dateStr,
  log,
  index,
  today,
  passPurchaseId,
  hasPurchase = true,
  bowl,
  slots,
  adjustingIds,
  skippingIds,
  isAnyPending,
  isNonPreferredDay = false,
  lastScheduledDate,
  schedulingExtraDates,
  colors,
  fonts,
  onPress,
  onQtyChange,
  onSkip,
  onUnskip,
  onScheduleExtra,
}: DeliveryRowProps) {
  const isToday = dateStr === today;
  const isPast = dateStr < today;
  const isScheduled = log?.status === "scheduled";
  const isSkipped = log?.status === "skipped";
  const isDelivered = log?.status === "delivered";
  const isMissed = log?.status === "missed";
  const isLive = log?.status === "out_for_delivery";
  const canEditQty = isScheduled && !!passPurchaseId && canEditMobile(dateStr);
  const canAddExtra =
    isNonPreferredDay &&
    !log &&
    !isPast &&
    !!passPurchaseId &&
    canEditMobile(dateStr) &&
    !!onScheduleExtra;
  const isSchedulingExtra = schedulingExtraDates?.has(dateStr) ?? false;
  const qty = log?.quantity ?? 0;
  const { day, date: dayNum } = formatDayDate(dateStr);

  const badgeBg = isDelivered
    ? colors.successBg
    : isMissed
      ? colors.errorBg
      : isSkipped
        ? colors.warningBg
        : isToday
          ? colors.primaryBg
          : colors.surface2;

  const badgeDateColor = isDelivered
    ? colors.success
    : isMissed
      ? colors.error
      : isSkipped
        ? colors.warning
        : isToday
          ? colors.primaryDark
          : isPast
            ? colors.textMuted
            : colors.text;

  return (
    <TouchableOpacity
      style={[
        s.row,
        { borderTopColor: colors.borderLight },
        index === 0 && { borderTopWidth: 0 },
        !log && isPast && { opacity: 0.4 },
      ]}
      onPress={() => log && onPress(log)}
      activeOpacity={log ? 0.7 : 1}
      disabled={!log}
    >
      {/* Date badge */}
      <View style={[s.dateBadge, { backgroundColor: badgeBg }]}>
        <Text
          style={[
            s.dateBadgeDay,
            {
              color: isDelivered
                ? colors.success
                : isMissed
                  ? colors.error
                  : isSkipped
                    ? colors.warning
                    : isToday
                      ? colors.primaryDark
                      : colors.textMuted,
              fontFamily: fonts.bodyMedium,
            },
          ]}
        >
          {day}
        </Text>
        <Text
          style={[
            s.dateBadgeDate,
            { color: badgeDateColor, fontFamily: fonts.display },
          ]}
        >
          {dayNum}
        </Text>
      </View>

      {/* Content */}
      <View style={s.info}>
        {log ? (
          <View style={s.infoLabels}>
            <Text
              style={[
                s.name,
                {
                  color: isSkipped ? colors.warning : colors.text,
                  fontFamily: fonts.bodySemibold,
                },
              ]}
              numberOfLines={1}
            >
              {bowl.name}
            </Text>
            <Text
              style={[
                s.slot,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              {isLive ? "On route 🚴" : slotLabel(log.delivery_slot, slots)}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              s.slot,
              {
                color: colors.textMuted,
                fontFamily: fonts.body,
                fontStyle: "italic",
              },
            ]}
          >
            {!hasPurchase
              ? "No active plan"
              : isNonPreferredDay
                ? "Not a delivery day"
                : !isPast && lastScheduledDate != null && dateStr > lastScheduledDate
                  ? "No meals left"
                  : "No delivery scheduled"}
          </Text>
        )}
      </View>

      {/* Action */}
      {canEditQty ? (
        <View style={s.qtyWrapper}>
          {skippingIds.has(log?.id ?? "") ? (
            <View
              style={[
                s.skipChip,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                },
              ]}
            >
              <Text
                style={[
                  s.skipChipText,
                  { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                ]}
              >
                Skipping…
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[s.qtyStepper, { backgroundColor: colors.surface2 }]}
              >
                <TouchableOpacity
                  style={[
                    s.qtyBtn,
                    qty <= 1 ? { display: "none" } : { paddingHorizontal: 6 },
                  ]}
                  onPress={() => log && onQtyChange(log, -1)}
                  disabled={qty <= 1 || isAnyPending}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={13} color={colors.text} />
                </TouchableOpacity>
                {adjustingIds.has(log?.id ?? "") ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={[s.qtySpinner, qty <= 1 && { paddingLeft: 10 }]}
                  />
                ) : (
                  <Text
                    style={[
                      s.qtyCount,
                      {
                        color: colors.text,
                        fontFamily: fonts.display,
                        ...(qty <= 1 && { minWidth: 0, paddingLeft: 10 }),
                      },
                    ]}
                  >
                    {qty}
                  </Text>
                )}
                <TouchableOpacity
                  style={[s.qtyBtn, { paddingHorizontal: 6 }]}
                  onPress={() => log && onQtyChange(log, 1)}
                  disabled={qty >= 4 || isAnyPending}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="add"
                    size={13}
                    color={qty >= 4 ? colors.border : colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => log && onSkip(log)}
                disabled={isAnyPending}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    s.qtySkipText,
                    { color: colors.primary, fontFamily: fonts.bodyMedium },
                  ]}
                >
                  Skip
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : isSkipped && canEditMobile(dateStr) ? (
        <TouchableOpacity
          onPress={() => log && onUnskip(log)}
          style={[
            s.skipChip,
            {
              borderColor: isAnyPending ? colors.border : colors.warning,
              backgroundColor: isAnyPending
                ? colors.surface2
                : colors.warningBg,
            },
          ]}
          activeOpacity={0.7}
          disabled={isAnyPending}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[
              s.skipChipText,
              {
                color: isAnyPending ? colors.textMuted : colors.warning,
                fontFamily: fonts.bodyMedium,
              },
            ]}
          >
            {skippingIds.has(log?.id ?? "") ? "Restoring…" : "Undo skip"}
          </Text>
        </TouchableOpacity>
      ) : isSkipped ? (
        <StatusPill status="skipped" />
      ) : isLive ? (
        <StatusPill status="out_for_delivery" />
      ) : isDelivered ? (
        <StatusPill status="delivered" />
      ) : isMissed ? (
        <StatusPill status="missed" />
      ) : isScheduled ? (
        <StatusPill status="scheduled" />
      ) : canAddExtra ? (
        <TouchableOpacity
          onPress={() => onScheduleExtra!(dateStr)}
          disabled={isAnyPending || isSchedulingExtra}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            s.skipChip,
            {
              borderColor: isSchedulingExtra ? colors.border : colors.primary,
              backgroundColor: isSchedulingExtra
                ? colors.surface2
                : colors.primaryBg,
            },
          ]}
        >
          {isSchedulingExtra ? (
            <Text style={[s.skipChipText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
              Adding…
            </Text>
          ) : (
            <Text
              style={[
                s.skipChipText,
                { color: colors.primary, fontFamily: fonts.bodyMedium },
              ]}
            >
              <Ionicons name="add" size={13} color={colors.primary} /> Add
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dateBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dateBadgeDay: {
    fontSize: 9,
  },
  dateBadgeDate: {
    fontSize: 16,
  },
  info: {
    flex: 1,
  },
  infoLabels: {
    flexDirection: 'column',
    gap: Spacing[1],
  },
  name: {
    fontSize: FontSize.sm,
  },
  slot: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  // Qty stepper
  qtyWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyCount: {
    fontSize: FontSize.sm,
    minWidth: 18,
    textAlign: 'center',
  },
  qtySpinner: {
    minWidth: 18,
    alignSelf: 'center',
  },
  qtySkipText: {
    fontSize: 10,
    textAlign: 'center',
  },
  // Skip chip
  skipChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  skipChipText: {
    fontSize: 11,
  },
});
