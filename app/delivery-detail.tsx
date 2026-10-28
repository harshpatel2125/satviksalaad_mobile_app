import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/screen-header';

import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useAlert } from '@/context/alert';
import { ItemThumb } from '@/components/screens/deliveries/delivery-day-card';
import { useSkip } from '@/components/screens/deliveries/use-skip';
import { errorText, refusalButtons, storeActionResult } from '@/components/screens/subscriptions/subscription-info';
import { deliveriesApi } from "@/lib/api";
import { optimizedImageSource } from '@/lib/image-url';
import { CACHE_TTL, queryClient } from "@/lib/query-client";
import { slotLabel, slotLabelPlain, useSlots } from '@/lib/slots';
import { canChangeDelivery, cutoffLabel } from '@/lib/delivery-rules';
import { DEFAULT_UNITS, changesClosedText, countOf } from '@/lib/subscription-view';
import { useTheme } from '@/hooks/use-theme';

/** The most one delivery may carry; the server holds the same limit. */
const MAX_QUANTITY = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISTStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function tomorrowISTStr() {
  return new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatShortDate(iso: string): string {
  if (!iso) return "";
  const today = todayISTStr();
  const tomorrow = tomorrowISTStr();
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatFullDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  colors,
  fonts,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
  fonts: ReturnType<typeof useTheme>["fonts"];
}) {
  return (
    <View style={infoRowStyles.row}>
      <View
        style={[infoRowStyles.iconWrap, { backgroundColor: colors.surface2 }]}
      >
        <Ionicons name={icon} size={15} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            infoRowStyles.label,
            { color: colors.textMuted, fontFamily: fonts.body },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            infoRowStyles.value,
            { color: colors.text, fontFamily: fonts.bodySemibold },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingVertical: Spacing[2],
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 10, letterSpacing: 0.4, marginBottom: 1 },
  value: { fontSize: FontSize.sm },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DeliveryDetailScreen() {
  const { colors, fonts } = useTheme();
  const slots = useSlots();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{
    id?: string;
    date?: string;
    slot?: string;
    status?: string;
    quantity?: string;
    mealName?: string;
    mealImageUrl?: string;
    categoryName?: string;
    unitSingular?: string;
    unitPlural?: string;
    addressLine?: string;
  }>();

  const { busy, run } = useSkip();
  const skipLoading = busy !== null;
  const [quantityLoading, setQuantityLoading] = useState(false);

  const id = params.id ?? "";
  const date = params.date ?? "";
  const slot = params.slot ?? "noon";
  // The latest copy of this delivery, so a skip, an undo or a new quantity shows at once.
  const { data: deliveries } = useQuery({ queryKey: ["deliveries"], queryFn: deliveriesApi.init, staleTime: CACHE_TTL.deliveries });
  const live = deliveries?.data.logs.find((l) => l.id === id);
  const status: string = live?.status ?? params.status ?? "scheduled";
  const quantity = live?.quantity ?? Math.max(1, parseInt(params.quantity ?? "1", 10));
  const unit = live?.unit ?? (params.unitSingular && params.unitPlural
    ? { singular: params.unitSingular, plural: params.unitPlural }
    : DEFAULT_UNITS);
  const categoryName = params.categoryName ?? "";
  const mealName =
    params.mealName && params.mealName.length > 0
      ? params.mealName
      : "Salad Bowl";
  const mealImageUrl =
    params.mealImageUrl && params.mealImageUrl.length > 0
      ? params.mealImageUrl
      : null;
  const addressLine = params.addressLine ?? "";

  const editable = !!date && canChangeDelivery(date, slot);
  // Closed before its day has come; on the day itself the scheduled note shows instead.
  const locked = !editable && date > todayISTStr();

  const isScheduled = status === "scheduled";
  const isDelivered = status === "delivered";
  const isLive = status === "out_for_delivery";
  const isMissed = status === "missed";
  const isSkipped = status === "skipped";

  const canSkip = isScheduled && editable;
  const canUnskip = isSkipped && editable;
  const showLock = (isScheduled || isSkipped) && !editable && locked;

  // Hero colors
  const heroBg = isLive
    ? colors.blueBg
    : isDelivered
      ? colors.successBg
      : isMissed
        ? colors.errorBg
        : isSkipped
          ? colors.surface2
          : colors.primaryTint;

  const heroAccent = isLive
    ? colors.blue
    : isDelivered
      ? colors.success
      : isMissed
        ? colors.error
        : isSkipped
          ? colors.text
          : colors.primaryDark;

  const statusLabel = isLive
    ? "On Route"
    : isDelivered
      ? "Delivered"
      : isMissed
        ? "Missed"
        : isSkipped
          ? "Skipped"
          : "Scheduled";

  const statusIcon: React.ComponentProps<typeof Ionicons>["name"] = isLive
    ? "bicycle"
    : isDelivered
      ? "checkmark-circle"
      : isMissed
        ? "alert-circle-outline"
        : isSkipped
          ? "close-circle-outline"
          : "calendar-outline";

  function handleSkip(action: "skip" | "unskip") {
    if (!id || skipLoading) return;
    void run(id, { action, logId: id });
  }

  async function changeQuantity(next: number) {
    if (!id || quantityLoading || next < 1 || next > MAX_QUANTITY) return;
    setQuantityLoading(true);
    try {
      const result = await deliveriesApi.action({ action: "update", logId: id, deliverySlot: slot, quantity: next });
      storeActionResult(queryClient, result);
      showAlert("Done", result.message ?? `This delivery now brings ${countOf(next, unit)}.`);
    } catch (err) {
      showAlert(
        "Not changed",
        errorText(err, "Could not change this delivery. Please try again."),
        refusalButtons(err, () => router.push("/support")),
      );
    } finally {
      setQuantityLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Delivery Detail"
        onBack={() => router.back()}
        right={
          <View style={[styles.datePill, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.datePillText, { color: colors.primaryDark, fontFamily: fonts.bodySemibold }]}>
              {formatShortDate(date)}
            </Text>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          column(),
          styles.content,
          { paddingTop: Spacing[4], paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Status hero banner */}
        <View style={[styles.heroBanner, { backgroundColor: heroBg }]}>
          <View style={styles.heroLeft}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: "rgba(255,255,255,0.45)" },
              ]}
            >
              <Ionicons name={statusIcon} size={13} color={heroAccent} />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: heroAccent, fontFamily: fonts.bodySemibold },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            <Text
              style={[
                styles.heroDateLarge,
                { color: heroAccent, fontFamily: fonts.display },
              ]}
            >
              {formatShortDate(date)}
            </Text>
            <Text
              style={[
                styles.heroDateFull,
                { color: heroAccent, fontFamily: fonts.body, opacity: 0.65 },
              ]}
            >
              {formatFullDate(date)}
            </Text>
          </View>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: "rgba(255,255,255,0.3)" },
            ]}
          >
            <Ionicons
              name={statusIcon}
              size={30}
              color={heroAccent}
              style={{ opacity: 0.85 }}
            />
          </View>
        </View>

        {/* 2. Meal card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
          <View style={styles.mealRow}>
            {mealImageUrl ? (
              <Image
                source={optimizedImageSource(mealImageUrl) ?? undefined}
                style={styles.mealImage}
                contentFit="cover"
              />
            ) : (
              <ItemThumb item={{ image_url: null, categoryImageUrl: null, unit }} size={72} />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.mealName,
                  { color: colors.text, fontFamily: fonts.bodySemibold },
                ]}
              >
                {mealName}
              </Text>
              <Text
                style={[
                  styles.mealMeta,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {countOf(quantity, unit)}
              </Text>
              {categoryName ? (
                <Text style={[styles.mealMeta, { color: colors.textMuted, fontFamily: fonts.body, marginTop: -Spacing[1] }]}>
                  {categoryName}
                </Text>
              ) : null}
              <View
                style={[styles.slotBadge, { backgroundColor: colors.surface2 }]}
              >
                <Text
                  style={[
                    styles.slotBadgeText,
                    { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                  ]}
                >
                  {slotLabel(slot, slots)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Delivery info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
          <InfoRow
            icon="calendar-outline"
            label="DATE"
            value={formatFullDate(date)}
            colors={colors}
            fonts={fonts}
          />
          <View
            style={[styles.divider, { backgroundColor: colors.borderLight }]}
          />
          <InfoRow
            icon="time-outline"
            label="TIME SLOT"
            value={slotLabelPlain(slot, slots)}
            colors={colors}
            fonts={fonts}
          />
          <View
            style={[styles.divider, { backgroundColor: colors.borderLight }]}
          />
          <InfoRow
            icon="receipt-outline"
            label="DELIVERY ID"
            value={`#${id.slice(-6).toUpperCase()}`}
            colors={colors}
            fonts={fonts}
          />
          {addressLine.length > 0 && (
            <>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderLight },
                ]}
              />
              <InfoRow
                icon="location-outline"
                label="DELIVER TO"
                value={addressLine}
                colors={colors}
                fonts={fonts}
              />
            </>
          )}
        </View>

        {/* 4. Status-specific info */}
        {isLive && (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.blueBg,
                borderColor: colors.blue + "30",
              },
            ]}
          >
            <Ionicons name="bicycle" size={18} color={colors.blue} />
            <Text
              style={[
                styles.infoCardText,
                { color: colors.blue, fontFamily: fonts.body },
              ]}
            >
              Your delivery is on the way. Our rider is heading to you now!
            </Text>
          </View>
        )}
        {isSkipped && (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surface2, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textMuted}
            />
            <Text
              style={[
                styles.infoCardText,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              {canUnskip
                ? `This delivery is skipped. You can restore it until ${cutoffLabel(slot)}.`
                : "This delivery was skipped. It moved to the end of your subscription."}
            </Text>
          </View>
        )}
        {isMissed && (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.errorBg,
                borderColor: colors.error + "30",
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.error}
            />
            <Text
              style={[
                styles.infoCardText,
                { color: colors.error, fontFamily: fonts.body },
              ]}
            >
              This delivery was marked missed. Contact support if this is
              incorrect.
            </Text>
          </View>
        )}
        {isScheduled && !editable && !locked && (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.primaryTint,
                borderColor: "transparent",
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primaryDark}
            />
            <Text
              style={[
                styles.infoCardText,
                { color: colors.primaryDark, fontFamily: fonts.body },
              ]}
            >
              Delivery is scheduled. We&apos;ll notify you when it&apos;s on the way.
            </Text>
          </View>
        )}

        {showLock && (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surface2, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.textMuted}
            />
            <Text
              style={[
                styles.infoCardText,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              {changesClosedText(slot)}. Message us if you need help.
            </Text>
          </View>
        )}

        {/* 5. Actions */}
        <View style={styles.actions}>
          {canSkip && (
            <View style={[styles.card, styles.qtyCard, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mealName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>How many</Text>
                <Text style={[styles.qtyHint, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  Extra ones come from the end of your subscription.
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, { borderColor: colors.border }, (quantityLoading || quantity <= 1) && { opacity: 0.4 }]}
                  onPress={() => void changeQuantity(quantity - 1)}
                  disabled={quantityLoading || quantity <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={`One ${unit.singular} fewer`}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.qtyValue}>
                  {quantityLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.qtyText, { color: colors.text, fontFamily: fonts.display }]}>{quantity}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.qtyBtn, { borderColor: colors.border }, (quantityLoading || quantity >= MAX_QUANTITY) && { opacity: 0.4 }]}
                  onPress={() => void changeQuantity(quantity + 1)}
                  disabled={quantityLoading || quantity >= MAX_QUANTITY}
                  accessibilityRole="button"
                  accessibilityLabel={`One ${unit.singular} more`}
                >
                  <Ionicons name="add" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {canSkip && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.dangerBtn, { borderColor: colors.primary }]}
              onPress={() => handleSkip("skip")}
              disabled={skipLoading}
            >
              {skipLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={colors.primary} />
                  <Text style={[styles.dangerBtnText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                    Skip this delivery
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {canUnskip && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.dangerBtn, { borderColor: colors.warning, backgroundColor: colors.warningBg }]}
              onPress={() => handleSkip("unskip")}
              disabled={skipLoading}
            >
              {skipLoading ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <>
                  <Ionicons name="arrow-undo-outline" size={18} color={colors.warning} />
                  <Text style={[styles.dangerBtnText, { color: colors.warning, fontFamily: fonts.bodySemibold }]}>
                    Undo skip
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.outlineBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            onPress={() => router.push("/support")}
          >
            <Ionicons
              name="chatbubble-outline"
              size={15}
              color={colors.textMuted}
            />
            <Text
              style={[
                styles.outlineBtnText,
                { color: colors.text, fontFamily: fonts.bodySemibold },
              ]}
            >
              Need help?
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing[4], gap: Spacing[3] },

  datePill: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  datePillText: { fontSize: FontSize.xs },

  heroBanner: {
    borderRadius: 20,
    padding: Spacing[5],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroLeft: { flex: 1, gap: Spacing[2] },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing[3],
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusBadgeText: { fontSize: FontSize.xs },
  heroDateLarge: { fontSize: 38, letterSpacing: -1.2 },
  heroDateFull: { fontSize: FontSize.xs },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing[3],
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  divider: { height: 1, marginVertical: Spacing[1] },

  mealRow: { flexDirection: "row", alignItems: "center", gap: Spacing[4] },
  mealImage: { width: 72, height: 72, borderRadius: 14 },
  mealName: { fontSize: FontSize.base, marginBottom: 2 },
  mealMeta: { fontSize: FontSize.sm, marginBottom: Spacing[2] },
  slotBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.md,
  },
  slotBadgeText: { fontSize: 10 },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[3],
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing[4],
  },
  infoCardText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.55,
  },

  actions: { gap: Spacing[3], marginTop: Spacing[1] },
  qtyCard: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  qtyHint: { fontSize: FontSize.sm },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  qtyBtn: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyValue: { minWidth: 32, alignItems: "center" },
  qtyText: { fontSize: FontSize.lg },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  dangerBtnText: { fontSize: FontSize.base },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  outlineBtnText: { fontSize: FontSize.sm },
});
