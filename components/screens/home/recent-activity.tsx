import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { slotTime, useSlots } from '@/lib/slots';
import { deliveryDetailParams } from '@/components/screens/subscriptions/subscription-info';
import { toDayItem } from '@/lib/subscription-view';
import type { Categories, HomeCriticalLog } from '@/types/api';

function formatDeliveryDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (iso === today)     return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  out_for_delivery: 'On route',
  delivered: 'Delivered',
  missed: 'Missed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

interface RecentActivityProps {
  logs: HomeCriticalLog[];
  categories: Categories;
  colors: ReturnType<typeof useTheme>["colors"];
  fonts: ReturnType<typeof useTheme>["fonts"];
  onSeeAll: () => void;
  loading?: boolean;
}

function SkeletonRow({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={[recentStyles.row, { borderTopColor: colors.borderLight }]}>
      <Skeleton width={36} height={36} radius={18} />
      <View style={recentStyles.info}>
        <Skeleton width={100} height={13} radius={6} />
        <Skeleton width={70} height={11} radius={5} style={{ marginTop: 4 }} />
      </View>
      <Skeleton width={68} height={22} radius={11} />
    </View>
  );
}

export function RecentActivity({
  logs,
  categories,
  colors,
  fonts,
  onSeeAll,
  loading = false,
}: RecentActivityProps) {
  const router = useRouter();
  const slots = useSlots();
  return (
    <View
      style={[
        recentStyles.card,
        { backgroundColor: colors.surface },
        CardEdge,
      ]}
    >
      <SectionHeader
        label="Recent activity"
        action="See all"
        onAction={onSeeAll}
      />
      {loading ? (
        <>
          <SkeletonRow colors={colors} />
          <SkeletonRow colors={colors} />
        </>
      ) : (
        logs.map((d, i) => {
          const isDelivered = d.status === "delivered";
          const isMissed = d.status === "missed";
          const isSkipped = d.status === "skipped";
          const iconBg = isDelivered
            ? colors.successBg
            : isMissed
              ? colors.errorBg
              : isSkipped
                ? colors.warningBg
                : colors.surface2;
          const iconColor = isDelivered
            ? colors.success
            : isMissed
              ? colors.error
              : isSkipped
                ? colors.warning
                : colors.textMuted;
          const pillBg = iconBg;
          const pillColor = iconColor;
          const iconName = isDelivered
            ? "checkmark-circle"
            : isMissed
              ? "close-circle"
              : isSkipped
                ? "remove-circle-outline"
                : "time-outline";
          const statusLabel = STATUS_LABELS[d.status] ?? d.status.replace(/_/g, ' ');
          const item = toDayItem(d, categories);

          return (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/delivery-detail', params: deliveryDetailParams(item) })}
              style={[
                recentStyles.row,
                { borderTopColor: colors.borderLight },
                i === 0 && { borderTopWidth: 0 },
              ]}
            >
              <View style={[recentStyles.icon, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={18} color={iconColor} />
              </View>
              <View style={recentStyles.info}>
                <Text
                  style={[
                    recentStyles.meal,
                    {
                      color: isSkipped ? colors.warning : colors.text,
                      fontFamily: fonts.bodyMedium,
                    },
                  ]}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    recentStyles.slot,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  {formatDeliveryDate(d.delivery_date)} ·{" "}
                  {slotTime(d.delivery_slot, slots)}
                </Text>
              </View>
              <View style={[pillStyles.pill, { backgroundColor: pillBg }]}>
                <Text
                  style={[
                    pillStyles.text,
                    { color: pillColor, fontFamily: fonts.bodySemibold },
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}


const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  text: {
    fontSize: FontSize.xs,
    letterSpacing: 0.1,
  },
});

const recentStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing[3],
    gap: Spacing[3],
    borderTopWidth: 1,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    flexDirection: "column",
    gap: Spacing[1],
  },
  meal: {
    fontSize: FontSize.sm,
  },
  slot: {
    fontSize: FontSize.xs,
  },
});
