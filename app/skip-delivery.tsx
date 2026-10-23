import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/skeleton';

import {
  FontSize,
  FontWeight,
  Fonts,
  Radius,
  Spacing,
  type ThemeColors,
} from "@/constants/theme";
import { useAlert } from '@/context/alert';
import { deliveriesApi, homeApi } from '@/lib/api';
import type { DeliveriesActionResponse, HomeCriticalLog, TimeSlot } from '@/types/api';
import { optimizedImageSource } from '@/lib/image-url';
import { CACHE_TTL } from '@/lib/query-client';
import { trackDeliverySkipped } from '@/lib/analytics';
import { slotLabel, slotLabelPlain, useSlots } from '@/lib/slots';
import { useTheme } from '@/hooks/use-theme';

function todayISTStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Anchored at IST noon so the result is the right IST date in any device timezone.
function tomorrowISTStr(): string {
  const d = new Date(todayISTStr() + 'T12:00:00+05:30');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function isAfter11PMIST(): boolean {
  const hour = parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
    10,
  );
  return hour >= 23;
}

function currentHourIST(): number {
  return parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
    10,
  );
}

function formatPickerDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today    = todayISTStr();
  const tomorrow = tomorrowISTStr();
  if (iso === today)    return 'Today';
  if (iso === tomorrow) return `Tomorrow · ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Picker item ───────────────────────────────────────────────────────────────

function PickerItem({
  log, passPurchaseId, slots, colors, fonts, onDone,
}: {
  log: HomeCriticalLog;
  passPurchaseId: string;
  slots: TimeSlot[];
  colors: ThemeColors;
  fonts: typeof Fonts;
  onDone: (action: 'skip' | 'unskip', result: DeliveriesActionResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const isLocked    = log.delivery_date === tomorrowISTStr() && currentHourIST() >= 23;
  const isSkipped   = log.status === 'skipped';
  const slotText    = slotLabel(log.delivery_slot, slots);

  async function handlePress() {
    if (isLocked || loading) return;
    setLoading(true);
    try {
      const action = isSkipped ? 'unskip' : 'skip';
      const result = await deliveriesApi.action({ action, passId: passPurchaseId, date: log.delivery_date, deliverySlot: log.delivery_slot });
      onDone(action, result);
    } catch (err) {
      showAlert('Not updated', err instanceof Error ? err.message : 'Could not update this delivery. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[
      pickerStyles.item,
      { backgroundColor: isSkipped ? colors.warningBg : colors.surface2, borderColor: isSkipped ? colors.warning + '40' : colors.border },
    ]}>
      <View style={pickerStyles.itemInfo}>
        <Text style={[pickerStyles.itemDate, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          {formatPickerDate(log.delivery_date)}
        </Text>
        <Text style={[pickerStyles.itemSlot, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {slotText}
        </Text>
      </View>

      {isLocked ? (
        <View style={[pickerStyles.actionChip, { backgroundColor: colors.surface }]}>
          <Ionicons name="lock-closed-outline" size={11} color={colors.textMuted} />
          <Text style={[pickerStyles.actionChipText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>Locked</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            pickerStyles.actionChip,
            { backgroundColor: isSkipped ? colors.warning + '20' : colors.primaryBg },
            loading && { opacity: 0.5 },
          ]}
          onPress={() => void handlePress()}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <Text style={[pickerStyles.actionChipText, { color: isSkipped ? colors.warning : colors.primaryDark, fontFamily: fonts.bodyMedium }]}>
              {isSkipped ? 'Undoing…' : 'Skipping…'}
            </Text>
          ) : (
            <>
              <Ionicons
                name={isSkipped ? 'arrow-undo-outline' : 'close-circle-outline'}
                size={12}
                color={isSkipped ? colors.warning : colors.primaryDark}
              />
              <Text style={[pickerStyles.actionChipText, { color: isSkipped ? colors.warning : colors.primaryDark, fontFamily: fonts.bodyMedium }]}>
                {isSkipped ? 'Undo skip' : 'Skip'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function formatDateSlot(date: string, slot: string, slots: TimeSlot[]) {
  const d = new Date(date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  return `${dateStr} · ${slotLabelPlain(slot, slots)}`;
}

function MealCard({
  imageUrl,
  name,
  dateSlot,
  badge,
  badgeColor,
  badgeBg,
  colors,
  fonts,
}: {
  imageUrl: string | null;
  name: string;
  dateSlot: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  colors: ThemeColors;
  fonts: typeof Fonts;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  return (
    <View
      style={[
        styles.mealCard,
        { backgroundColor: colors.surface2, borderColor: colors.border },
      ]}
    >
      <View style={[styles.mealImage, { overflow: 'hidden' }]}>
        <Image
          source={optimizedImageSource(imageUrl) ?? require('@/assets/images/hero-image.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          onLoad={() => setImgLoaded(true)}
        />
        {!imgLoaded && (
          <Skeleton width={48} height={48} radius={8} style={{ position: 'absolute', top: 0, left: 0 }} />
        )}
      </View>
      <View style={styles.mealInfo}>
        <Text
          style={[
            styles.mealName,
            { color: colors.text, fontFamily: fonts.bodySemibold },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.mealDate,
            { color: colors.textMuted, fontFamily: fonts.body },
          ]}
          numberOfLines={1}
        >
          {dateSlot}
        </Text>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text
            style={[
              styles.badgeText,
              { color: badgeColor, fontFamily: fonts.bodyMedium },
            ]}
          >
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function SkipDeliveryScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slots = useSlots();

  const params = useLocalSearchParams<{
    passPurchaseId?: string;
    date?: string;
    slot?: string;
    mealName?: string;
    mealImageUrl?: string;
    nextDate?: string;
    nextSlot?: string;
    nextMealName?: string;
    nextMealImageUrl?: string;
    explain?: string;
  }>();

  const explain = params.explain === "true";
  const passPurchaseId = params.passPurchaseId ?? '';
  const date = params.date ?? '';
  const slot = params.slot ?? 'noon';
  const mealName = params.mealName ?? null;
  const mealImageUrl = params.mealImageUrl || null;
  const nextDate = params.nextDate ?? null;
  const nextSlot = params.nextSlot ?? "noon";
  const nextMealName = params.nextMealName ?? null;
  const nextMealImageUrl = params.nextMealImageUrl || null;

  // Picker mode: passPurchaseId provided but no specific date — shows full list
  const isPicker = !!passPurchaseId && !date && !explain;

  const { data: homeData, isLoading: homeLoading } = useQuery({
    queryKey: ['home'],
    queryFn: homeApi.critical,
    staleTime: CACHE_TTL.home,
    enabled: isPicker,
  });

  const tomorrow = tomorrowISTStr();
  const pickerLogs: HomeCriticalLog[] = (() => {
    if (!isPicker) return [];
    const all = homeData?.data?.logs ?? [];
    return all
      .filter(l =>
        (l.status === 'scheduled' || l.status === 'skipped') &&
        l.delivery_date >= tomorrow
      )
      .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
  })();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blocked if: delivery is today/past (window closed last night at 11 PM),
  // OR delivery is tomorrow and it's already past 11 PM
  const isBlocked = date <= todayISTStr() || (isAfter11PMIST() && date === tomorrowISTStr());

  // `skipSlot` is only what the link named: with none, every delivery that day is skipped.
  async function handleSkip(skipDate: string, skipSlot: string | undefined) {
    if (!passPurchaseId || !skipDate) {
      setError("Missing delivery information.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await deliveriesApi.action({ action: "skip", passId: passPurchaseId, date: skipDate, deliverySlot: skipSlot });
      queryClient.setQueryData(['deliveries'], result);
      queryClient.setQueryData(['home'], { success: true, data: result.homeData });
      trackDeliverySkipped(passPurchaseId, "no_reason");
      router.back();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to skip delivery. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: "rgba(20,15,10,0.5)" }]}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => router.back()}
      />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom:
              8 + insets.bottom + (Platform.OS === "android" ? 12 : 0),
          },
        ]}
      >
        <View style={styles.dragIndicatorRow}>
          <View
            style={[styles.dragIndicator, { backgroundColor: colors.border }]}
          />
        </View>

        {isPicker ? (
          /* ── Picker mode — scrollable list of future deliveries ── */
          <>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>
              Skip a delivery
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.body }]}>
              Pick a day to skip or undo a skip.
            </Text>

            {homeLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={[pickerStyles.actionChipText, { color: colors.textMuted, fontFamily: fonts.body }]}>Loading…</Text>
              </View>
            ) : pickerLogs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
                <Text style={[pickerStyles.emptyText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  No upcoming deliveries to manage.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={pickerStyles.list}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {pickerLogs.map(log => (
                  <PickerItem
                    key={log.id}
                    log={log}
                    passPurchaseId={passPurchaseId}
                    slots={slots}
                    colors={colors}
                    fonts={fonts}
                    onDone={(action, result) => {
                      queryClient.setQueryData(['deliveries'], result);
                      queryClient.setQueryData(['home'], { success: true, data: result.homeData });
                      if (action === 'skip') trackDeliverySkipped(passPurchaseId, "no_reason");
                    }}
                  />
                ))}
                <View style={{ height: Spacing[2] }} />
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border, flex: 0, marginTop: Spacing[3] }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                Done
              </Text>
            </TouchableOpacity>
          </>
        ) : explain ? (
          /* ── Explain state — no pass or no deliveries yet ── */
          <>
            <View
              style={[
                styles.explainIconWrap,
                { backgroundColor: colors.primaryBg },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={28}
                color={colors.primaryDark}
              />
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontFamily: fonts.display,
                  marginTop: 12,
                },
              ]}
            >
              Skip a delivery
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              How it works
            </Text>

            <View style={styles.explainSteps}>
              {[
                {
                  icon: "bag-handle-outline",
                  text: "Buy a plan and get your meals scheduled for the week.",
                },
                {
                  icon: "moon-outline",
                  text: "Any day before 11 PM, you can skip tomorrow's delivery.",
                },
                {
                  icon: "refresh-outline",
                  text: "The meal goes back to your wallet — you never lose a meal credit.",
                },
              ].map(({ icon, text }, i) => (
                <View key={i} style={styles.explainStep}>
                  <View
                    style={[
                      styles.explainStepIcon,
                      { backgroundColor: colors.primaryBg },
                    ]}
                  >
                    <Ionicons
                      name={icon as "bag-handle-outline"}
                      size={16}
                      color={colors.primaryDark}
                    />
                  </View>
                  <Text
                    style={[
                      styles.explainStepText,
                      { color: colors.text, fontFamily: fonts.body },
                    ]}
                  >
                    {text}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cancelBtnText,
                    { color: colors.text, fontFamily: fonts.bodySemibold },
                  ]}
                >
                  Maybe later
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.skipBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => {
                  router.back();
                  router.push("/buy-passes");
                }}
              >
                <Text
                  style={[
                    styles.skipBtnText,
                    { fontFamily: fonts.bodySemibold },
                  ]}
                >
                  Buy a plan →
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : isBlocked ? (
          /* ── Blocked state ── */
          <>
            <Text
              style={[
                styles.title,
                { color: colors.text, fontFamily: fonts.display },
              ]}
            >
              Can&apos;t skip this one
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              Skipping closes at 11 PM the night before.
            </Text>

            {/* Locked delivery */}
            {mealName && (
              <MealCard
                imageUrl={mealImageUrl}
                name={mealName}
                dateSlot={formatDateSlot(date, slot, slots)}
                badge="Locked"
                badgeColor={colors.error}
                badgeBg={colors.errorBg}
                colors={colors}
                fonts={fonts}
              />
            )}

            {nextDate && nextMealName ? (
              /* Has a next skippable delivery */
              <>
                <View style={styles.nextHeader}>
                  <View
                    style={[
                      styles.nextDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <Text
                    style={[
                      styles.nextLabel,
                      { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                    ]}
                  >
                    You can skip instead
                  </Text>
                  <View
                    style={[
                      styles.nextDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>

                <MealCard
                  imageUrl={nextMealImageUrl}
                  name={nextMealName}
                  dateSlot={formatDateSlot(nextDate, nextSlot, slots)}
                  colors={colors}
                  fonts={fonts}
                />

                {error ? (
                  <Text
                    style={[
                      styles.errorText,
                      { color: colors.error, fontFamily: fonts.body },
                    ]}
                  >
                    {error}
                  </Text>
                ) : null}

                <View style={styles.buttonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cancelBtnText,
                        { color: colors.text, fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.skipBtn,
                      {
                        backgroundColor: loading
                          ? colors.primaryDark
                          : colors.primary,
                        opacity: loading ? 0.7 : 1,
                      },
                    ]}
                    activeOpacity={0.7}
                    disabled={loading}
                    onPress={() => void handleSkip(nextDate, params.nextSlot)}
                  >
                    {loading ? (
                      <Ionicons
                        name="hourglass-outline"
                        size={16}
                        color="#fff"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.skipBtnText,
                          { fontFamily: fonts.bodySemibold },
                        ]}
                      >
                        Skip this instead
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* No next skippable */
              <>
                <View
                  style={[
                    styles.infoBox,
                    {
                      backgroundColor: colors.errorBg,
                      borderRadius: Radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoText,
                      { color: colors.error, fontFamily: fonts.body },
                    ]}
                  >
                    You have no upcoming deliveries to skip after this one.
                  </Text>
                </View>
                <View style={styles.buttonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        flex: 1,
                      },
                    ]}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cancelBtnText,
                        { color: colors.text, fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      Got it
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        ) : (
          /* ── Normal state ── */
          <>
            <Text
              style={[
                styles.title,
                { color: colors.text, fontFamily: fonts.display },
              ]}
            >
              Skip delivery?
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              {date ? formatDateSlot(date, slot, slots) : "Loading..."}
            </Text>

            {mealName && (
              <MealCard
                imageUrl={mealImageUrl}
                name={mealName}
                dateSlot={formatDateSlot(date, slot, slots)}
                colors={colors}
                fonts={fonts}
              />
            )}

            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor: colors.primaryTint,
                  borderRadius: Radius.md,
                },
              ]}
            >
              <Text
                style={[
                  styles.infoText,
                  { color: colors.primaryDark, fontFamily: fonts.body },
                ]}
              >
                <Text style={{ fontFamily: fonts.bodySemibold }}>
                  You won&apos;t lose a meal.{" "}
                </Text>
                Your remaining balance is preserved. Skipped days are recorded
                and the meal goes back to your plan.
              </Text>
            </View>

            {error ? (
              <Text
                style={[
                  styles.errorText,
                  { color: colors.error, fontFamily: fonts.body },
                ]}
              >
                {error}
              </Text>
            ) : null}

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cancelBtnText,
                    { color: colors.text, fontFamily: fonts.bodySemibold },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.skipBtn,
                  {
                    backgroundColor: loading
                      ? colors.primaryDark
                      : colors.primary,
                    opacity: loading ? 0.7 : 1,
                  },
                ]}
                activeOpacity={0.7}
                disabled={loading}
                onPress={() => void handleSkip(date, params.slot)}
              >
                {loading ? (
                  <Ionicons name="hourglass-outline" size={16} color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.skipBtnText,
                      { fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    Skip delivery
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 18,
  },
  dragIndicatorRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  mealCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 10,
  },
  mealImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  mealInfo: {
    flex: 1,
    gap: 3,
  },
  mealName: {
    fontSize: FontSize.base,
  },
  mealDate: {
    fontSize: 11,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
  },
  explainIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  explainSteps: {
    gap: 12,
    marginTop: 16,
  },
  explainStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  explainStepIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  explainStepText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  nextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  nextDivider: {
    flex: 1,
    height: 1,
  },
  nextLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  infoBox: {
    padding: 14,
    marginTop: 16,
  },
  infoText: {
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.45,
  },
  errorText: {
    fontSize: FontSize.xs,
    marginTop: 12,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: FontSize.base,
  },
  skipBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    fontSize: FontSize.base,
    color: "#FFFFFF",
  },
});

const pickerStyles = StyleSheet.create({
  list: {
    maxHeight: 300,
    marginTop: Spacing[3],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemDate: {
    fontSize: FontSize.sm,
  },
  itemSlot: {
    fontSize: 11,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 100,
  },
  actionChipText: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
