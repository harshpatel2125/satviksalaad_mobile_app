import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { useAlert } from '@/context/alert';
import { deliveriesApi } from "@/lib/api";
import { optimizedImageSource } from '@/lib/image-url';
import { queryClient } from "@/lib/query-client";
import { slotLabel, slotLabelPlain, useSlots } from '@/lib/slots';
import { useTheme } from '@/hooks/use-theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISTStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function tomorrowISTStr() {
  return new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function istHourNow(): number {
  const s = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(s, 10);
}

function canEditDelivery(dateStr: string): boolean {
  const today = todayISTStr();
  if (dateStr <= today) return false;
  const tomorrow = tomorrowISTStr();
  if (dateStr === tomorrow && istHourNow() >= 23) return false;
  return true;
}

function isTomorrowLocked(dateStr: string): boolean {
  const tomorrow = tomorrowISTStr();
  return dateStr === tomorrow && istHourNow() >= 23;
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
    passPurchaseId?: string;
    quantity?: string;
    mealName?: string;
    mealImageUrl?: string;
    addressLine?: string;
  }>();

  const [skipLoading, setSkipLoading]         = useState(false);

  const id = params.id ?? "";
  const date = params.date ?? "";
  const slot = params.slot ?? "noon";
  const status = params.status ?? "scheduled";
  const passPurchaseId = params.passPurchaseId ?? "";
  const quantity = Math.max(1, parseInt(params.quantity ?? "1", 10));
  const mealName =
    params.mealName && params.mealName.length > 0
      ? params.mealName
      : "Salad Bowl";
  const mealImageUrl =
    params.mealImageUrl && params.mealImageUrl.length > 0
      ? params.mealImageUrl
      : null;
  const addressLine = params.addressLine ?? "";

  const editable = canEditDelivery(date);
  const locked = isTomorrowLocked(date);

  const isScheduled = status === "scheduled";
  const isDelivered = status === "delivered";
  const isLive = status === "out_for_delivery";
  const isMissed = status === "missed";
  const isSkipped = status === "skipped";

  // Skip and restore need the plan, which not every way into this screen passes.
  const canSkip = isScheduled && editable && !!passPurchaseId;
  const canUnskip = isSkipped && editable && !!passPurchaseId;
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

  async function handleSkip() {
    if (!passPurchaseId || !date || skipLoading) return;
    showAlert(
      "Skip this delivery?",
      "The meal will go back to your wallet. The next available day will be scheduled.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, skip",
          style: "destructive",
          onPress: async () => {
            setSkipLoading(true);
            try {
              const result = await deliveriesApi.action({ action: "skip", passId: passPurchaseId, date, deliverySlot: params.slot });
              queryClient.setQueryData(["deliveries"], result);
              queryClient.setQueryData(["home"], { success: true, data: result.homeData });
              router.back();
            } catch {
              showAlert("Error", "Could not skip delivery. Please try again.");
            } finally {
              setSkipLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleUnskip() {
    if (!passPurchaseId || !date || skipLoading) return;
    setSkipLoading(true);
    try {
      const result = await deliveriesApi.action({ action: "unskip", passId: passPurchaseId, date, deliverySlot: params.slot });
      queryClient.setQueryData(["deliveries"], result);
      queryClient.setQueryData(["home"], { success: true, data: result.homeData });
      router.back();
    } catch {
      showAlert("Error", "Could not restore delivery. Please try again.");
    } finally {
      setSkipLoading(false);
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
              <View
                style={[
                  styles.mealImagePlaceholder,
                  { backgroundColor: colors.primaryTint },
                ]}
              >
                <Text style={{ fontSize: 28 }}>🥗</Text>
              </View>
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
                {quantity} {quantity === 1 ? "bowl" : "bowls"}
              </Text>
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
                ? "This delivery is skipped. You can restore it until 11 PM the night before."
                : "This delivery was skipped. The meal stays in your wallet."}
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

        {/* Locked banner (11 PM cutoff) */}
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
              Changes for tomorrow are locked after 11 PM. Contact support if
              you need help.
            </Text>
          </View>
        )}

        {/* 5. Actions */}
        <View style={styles.actions}>
          {canSkip && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.dangerBtn, { borderColor: colors.error + "80" }]}
              onPress={handleSkip}
              disabled={skipLoading}
            >
              {skipLoading ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={17}
                    color={colors.error}
                  />
                  <Text
                    style={[
                      styles.dangerBtnText,
                      { color: colors.error, fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    Skip this delivery
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {canUnskip && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleUnskip}
              disabled={skipLoading}
            >
              {skipLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={17} color="#fff" />
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: "#fff", fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    Restore delivery
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
  mealImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
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
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: 52,
    borderRadius: Radius.full,
  },
  primaryBtnText: { fontSize: FontSize.base },
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
