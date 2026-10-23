import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { optimizedImageSource } from '@/lib/image-url';
import { slotLabel, useSlots } from '@/lib/slots';
import type { HomeCriticalLog } from '@/types/api';

export type DeliveryCardState =
  | "skip"
  | "undo_skip"
  | "locked" // past the skip cut-off
  | "preparing"
  | "on_the_way"
  | "delivered";

function ThumbImage({ imageUrl }: { imageUrl?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[cardStyles.mealThumb, { overflow: 'hidden' }]}>
      <Image
        source={optimizedImageSource(imageUrl) ?? require('@/assets/images/hero-image.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <Skeleton width={60} height={60} radius={12} style={{ position: 'absolute', top: 0, left: 0 }} />
      )}
    </View>
  );
}

export function formatDeliveryDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const tomorrow  = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (iso === today)     return 'Today';
  if (iso === tomorrow)  return `Tomorrow, ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface TodayDeliveryProps {
  log: HomeCriticalLog;
  deliveryState: DeliveryCardState;
  colors: ReturnType<typeof useTheme>["colors"];
  fonts: ReturnType<typeof useTheme>["fonts"];
  mealName?: string;
  imageUrl?: string | null;
  onSkip: () => void;
  onUndoSkip?: () => void;
  loading?: boolean;
}

export function TodayDelivery({
  log,
  deliveryState,
  colors,
  fonts,
  mealName,
  imageUrl,
  onSkip,
  onUndoSkip,
  loading = false,
}: TodayDeliveryProps) {
  const slots = useSlots();
  const slotText = slotLabel(log.delivery_slot, slots);
  const mealTitle = mealName ?? "Salad Bowl";

  // Derive status pill value from deliveryState so the pill stays in sync
  const pillStatus =
    deliveryState === "preparing"
      ? "preparing"
      : deliveryState === "on_the_way"
        ? "out_for_delivery"
        : deliveryState === "delivered"
          ? "delivered"
          : log.status;

  return (
    <View
      style={[
        cardStyles.card,
        { backgroundColor: colors.surface },
        CardEdge,
      ]}
    >
      <View style={cardStyles.row}>
        {/* Thumbnail */}
        {loading ? (
          <Skeleton width={60} height={60} radius={12} />
        ) : (
          <ThumbImage imageUrl={imageUrl} />
        )}

        <View style={cardStyles.info}>
          <View style={cardStyles.infoTop}>
            {loading ? (
              <Skeleton width={150} height={14} radius={6} />
            ) : (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  cardStyles.mealName,
                  { color: colors.text, fontFamily: fonts.bodySemibold },
                ]}
              >
                {mealTitle}
              </Text>
            )}
            {loading ? (
              <Skeleton width={64} height={20} radius={10} />
            ) : (
              <StatusPill status={pillStatus} />
            )}
          </View>

          {loading ? (
            <Skeleton
              width={120}
              height={11}
              radius={5}
              style={cardStyles.skeletonGap}
            />
          ) : (
            <Text
              style={[
                cardStyles.slotText,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              {slotText}
            </Text>
          )}

          <View style={cardStyles.locationRow}>
            {!loading && (
              <Ionicons
                name="calendar-outline"
                size={11}
                color={colors.textMuted}
              />
            )}
            {loading ? (
              <Skeleton width={80} height={11} radius={5} />
            ) : (
              <Text
                style={[
                  cardStyles.locationText,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {formatDeliveryDate(log.delivery_date)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Bottom action row — fixed height 38+12 = 50px to keep card height stable */}
      {loading ? (
        <Skeleton
          width="100%"
          height={38}
          radius={10}
          style={{ marginTop: Spacing[3] }}
        />
      ) : deliveryState === "skip" ? (
        <TouchableOpacity
          style={[cardStyles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={onSkip}
          activeOpacity={0.85}
        >
          <Text
            style={[
              cardStyles.actionBtnText,
              { fontFamily: fonts.bodySemibold },
            ]}
          >
            Skip delivery →
          </Text>
        </TouchableOpacity>
      ) : deliveryState === "undo_skip" ? (
        <TouchableOpacity
          style={[
            cardStyles.actionBtn,
            { backgroundColor: colors.warningBg, flexDirection: "row", gap: 6 },
          ]}
          onPress={onUndoSkip}
          activeOpacity={0.85}
        >
          <Ionicons
            name="arrow-undo-outline"
            size={14}
            color={colors.warning}
          />
          <Text
            style={[
              cardStyles.actionBtnText,
              { color: colors.warning, fontFamily: fonts.bodySemibold },
            ]}
          >
            Undo skip
          </Text>
        </TouchableOpacity>
      ) : deliveryState === "locked" ? (
        <View
          style={[
            cardStyles.actionBtn,
            { backgroundColor: colors.surface2, flexDirection: "row", gap: 6 },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={13}
            color={colors.textMuted}
          />
          <Text
            style={[
              cardStyles.actionBtnText,
              { color: colors.textMuted, fontFamily: fonts.bodyMedium },
            ]}
          >
            Skip closed - Window ends at 11 PM
          </Text>
        </View>
      ) : deliveryState === "preparing" ? (
        <View
          style={[
            cardStyles.actionBtn,
            { backgroundColor: colors.orangeBg, flexDirection: "row", gap: 6 },
          ]}
        >
          <Text
            style={[
              cardStyles.actionBtnText,
              { color: colors.orange, fontFamily: fonts.bodyMedium },
            ]}
          >
            👨‍🍳 Preparing your bowl
          </Text>
        </View>
      ) : deliveryState === "on_the_way" ? (
        <View
          style={[
            cardStyles.actionBtn,
            { backgroundColor: colors.blueBg, flexDirection: "row", gap: 6 },
          ]}
        >
          <Text
            style={[
              cardStyles.actionBtnText,
              { color: colors.blue, fontFamily: fonts.bodySemibold },
            ]}
          >
            🚚 Out for delivery
          </Text>
        </View>
      ) : deliveryState === "delivered" ? (
        <View
          style={[
            cardStyles.actionBtn,
            { backgroundColor: colors.successBg, flexDirection: "row", gap: 6 },
          ]}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={14}
            color={colors.success}
          />
          <Text
            style={[
              cardStyles.actionBtnText,
              { color: colors.success, fontFamily: fonts.bodySemibold },
            ]}
          >
            Delivered — enjoy your meal!
          </Text>
        </View>
      ) : (
        <View
          style={[cardStyles.actionBtn, { backgroundColor: colors.surface }]}
        />
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing[4],
    height: 142,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing[3],
    height: 60,
  },
  mealThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mealName: {
    fontSize: FontSize.base,
    flex: 1,
  },
  skeletonGap: {
    marginTop: 4,
  },
  slotText: {
    fontSize: 11,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
  },
  actionBtn: {
    width: '100%',
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[3],
  },
  actionBtnText: {
    fontSize: FontSize.sm,
    color: '#fff',
  },
});
