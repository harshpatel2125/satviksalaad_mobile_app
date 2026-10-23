import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { DeliveriesSkeleton } from '@/components/skeletons/deliveries-skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/alert';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth';
import { deliveriesApi, passesApi, schedulesApi } from '@/lib/api';
import { trackDeliverySlotUpdated, trackPreferredDaysUpdated } from '@/lib/analytics';
import { readDeliveriesCache, writeDeliveriesCache } from '@/lib/home-cache';
import { CACHE_TTL, queryClient } from '@/lib/query-client';
import type { DeliveryAddress, DeliveryLog, DeliverySchedule, PassPurchase, TimeSlot } from '@/types/api';

import { DeliveryCard } from '@/components/screens/deliveries/delivery-card';
import { DayPill } from '@/components/screens/deliveries/day-pill';
import {
  DeliveryRow,
  bowlFor,
  formatDate,
} from "@/components/screens/deliveries/delivery-row";
import { formatTimeRange, slotLabel } from "@/lib/slots";
import {
  WeekNav,
  DISPLAY_DAYS,
  DAY_SHORT,
  todayISTStr,
  istHourNow,
  canEditMobile,
  getWeekDates,
  formatWeekRange,
} from "@/components/screens/deliveries/week-nav";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_ORDER: Record<string, number> = { noon: 0, evening: 1 };

function weekdayOf(dateStr: string): string {
  return WEEKDAY_NAMES[new Date(dateStr + "T00:00:00").getDay()];
}

/**
 * One row per delivery, earlier in the day first, and an empty row for a day
 * with none — a customer taking noon and evening sees both.
 */
type DayRow = { dateStr: string; log: DeliveryLog | undefined };

function rowsForDays(dates: string[], dayLogs: DeliveryLog[]): DayRow[] {
  return dates.flatMap((dateStr): DayRow[] => {
    const onDay = dayLogs
      .filter((l) => l.delivery_date === dateStr)
      .sort((a, b) => (SLOT_ORDER[a.delivery_slot] ?? 9) - (SLOT_ORDER[b.delivery_slot] ?? 9));
    return onDay.length > 0 ? onDay.map((log) => ({ dateStr, log })) : [{ dateStr, log: undefined }];
  });
}

export default function DeliveriesScreen() {
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Synchronous MMKV read before first render (fast path: tab navigation with session already resolved)
  const [cachedDeliveries, setCachedDeliveries] = useState<ReturnType<typeof readDeliveriesCache>>(
    () => (userId ? readDeliveriesCache(userId) : null),
  );
  // Deeplink path: userId is null on mount because auth resolves asynchronously.
  const cacheInitRef = useRef(userId !== null);
  useEffect(() => {
    if (cacheInitRef.current || !userId) return;
    cacheInitRef.current = true;
    const cached = readDeliveriesCache(userId);
    if (cached) setCachedDeliveries(cached);
  }, [userId]);

  const [pendingDays, setPendingDays] = useState<string[] | null>(null);
  const [savingDays, setSavingDays] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const didInitOffset = useRef(false);
  const [adjustingIds, setAdjustingIds] = useState<Set<string>>(new Set());
  const [skippingIds, setSkippingIds] = useState<Set<string>>(new Set());
  const [schedulingExtraDates, setSchedulingExtraDates] = useState<Set<string>>(
    new Set(),
  );
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  async function handleManualRefresh() {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["deliveries"],
    queryFn: deliveriesApi.init,
    staleTime: CACHE_TTL.deliveries,
  });
  useQueryFocusRefetch(["deliveries"]);

  React.useEffect(() => {
    if (!data?.data || !userId) return;
    writeDeliveriesCache(userId, data.data);
  }, [data, userId]);

  useFocusEffect(
    useCallback(() => {
      const runHeal = async () => {
        try {
          const result = await passesApi.heal();
          if (result.generated > 0) {
            await refetch();
            void queryClient.invalidateQueries({ queryKey: ["home"] });
            void queryClient.invalidateQueries({ queryKey: ["wallet"] });
          }
        } catch {}
      };
      void runHeal();
    }, [refetch]),
  );

  // API data takes priority; cache fills in before first API response
  const initData = data?.data ?? cachedDeliveries ?? undefined;
  const passPurchase: PassPurchase | null = initData?.purchase ?? null;
  const passesBalance: { total_purchased: number; total_used: number } | null =
    initData?.balance ?? null;
  const schedules: DeliverySchedule[] = useMemo(
    () => initData?.schedules ?? [],
    [initData?.schedules],
  );
  const logs: DeliveryLog[] = useMemo(
    () => initData?.logs ?? [],
    [initData?.logs],
  );
  const defaultAddress: DeliveryAddress | null =
    (initData?.addresses ?? []).find((a) => a.is_default) ??
    (initData?.addresses ?? [])[0] ??
    null;
  const slots: TimeSlot[] = initData?.slots ?? [];
  const bowl = useMemo(
    () => bowlFor(initData?.purchase?.pass_plans?.category),
    [initData?.purchase?.pass_plans?.category],
  );

  useEffect(() => {
    if (isLoading || didInitOffset.current) return;
    didInitOffset.current = true;
    const dayStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    });
    if (dayStr === "Sat" && schedules.length > 0) {
      const prefDays = (schedules.find((s) => s.is_default)?.preferred_days ??
        []) as string[];
      if (!prefDays.includes("Saturday") || istHourNow() >= 23)
        setWeekOffset(1);
    }
  }, [isLoading, schedules]);

  async function handleSaveDays() {
    if (!passPurchase || !pendingDays) return;

    // Capture before-save state to detect if new days are unschedulable
    const oldDays = (schedules.find((s) => s.is_default)?.preferred_days ??
      []) as string[];
    const addedDays = pendingDays.filter((d) => !oldDays.includes(d));
    const freeBalance = remaining - walletScheduledQty;

    setSavingDays(true);
    try {
      const defaultSchedule = schedules.find((s) => s.is_default) ?? null;
      if (defaultSchedule) {
        await schedulesApi.update(defaultSchedule.id, {
          preferred_days: pendingDays,
        });
      } else {
        await passesApi.updatePreferredDays(passPurchase.id, pendingDays);
      }
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      trackPreferredDaysUpdated(pendingDays);
      setPendingDays(null);

      // The days were saved, but there are no meals left to book on them.
      if (addedDays.length > 0 && freeBalance <= 0) {
        showAlert(
          `${addedDays.join(" & ")} added`,
          "You've used all the meals on your plan. Buy a plan to schedule deliveries on these new days.",
          [
            { text: "Later", style: "cancel" },
            { text: "Buy a plan", onPress: () => router.push("/buy-passes") },
          ],
        );
      }
    } catch {
      showAlert("Error", "Could not update delivery days. Please try again.");
    } finally {
      setSavingDays(false);
    }
  }

  function handleInlineSkip(log: DeliveryLog) {
    if (!passPurchase || skippingIds.has(log.id)) return;
    showAlert(
      "Skip this delivery?",
      `${formatDate(log.delivery_date)} · ${slotLabel(log.delivery_slot, slots)}\n\nThe meal will be saved. The next available day will be auto-scheduled.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, skip",
          style: "destructive",
          onPress: async () => {
            setSkippingIds((ids) => {
              const n = new Set(ids);
              n.add(log.id);
              return n;
            });
            try {
              const result = await deliveriesApi.action({ action: "skip", passId: passPurchase.id, date: log.delivery_date, deliverySlot: log.delivery_slot });
              queryClient.setQueryData(["deliveries"], result);
              queryClient.setQueryData(["home"], { success: true, data: result.homeData });
              void queryClient.invalidateQueries({ queryKey: ["wallet"] });
            } catch {
              showAlert("Error", "Could not skip delivery. Please try again.");
            } finally {
              setSkippingIds((ids) => {
                const n = new Set(ids);
                n.delete(log.id);
                return n;
              });
            }
          },
        },
      ],
    );
  }

  async function handleInlineUnskip(log: DeliveryLog) {
    if (!passPurchase || skippingIds.has(log.id)) return;
    setSkippingIds((ids) => {
      const n = new Set(ids);
      n.add(log.id);
      return n;
    });
    try {
      const result = await deliveriesApi.action({ action: "unskip", passId: passPurchase.id, date: log.delivery_date, deliverySlot: log.delivery_slot });
      queryClient.setQueryData(["deliveries"], result);
      queryClient.setQueryData(["home"], { success: true, data: result.homeData });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch {
      showAlert("Error", "Could not undo skip. Please try again.");
    } finally {
      setSkippingIds((ids) => {
        const n = new Set(ids);
        n.delete(log.id);
        return n;
      });
    }
  }

  async function handleSaveSlot() {
    if (!passPurchase || !pendingSlot) return;
    setSavingSlot(true);
    try {
      const defaultSchedule = schedules.find((s) => s.is_default) ?? null;
      if (defaultSchedule) {
        await schedulesApi.update(defaultSchedule.id, {
          delivery_slot: pendingSlot,
        });
      } else {
        await passesApi.changeSlot(passPurchase.id, pendingSlot);
      }
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      trackDeliverySlotUpdated(pendingSlot);
      setPendingSlot(null);
    } catch {
      showAlert("Error", "Could not update delivery time. Please try again.");
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleQtyChange(log: DeliveryLog, delta: number) {
    if (!passPurchase || adjustingIds.has(log.id)) return;
    if (!canEditMobile(log.delivery_date)) return;

    const currentQty = log.quantity ?? 1;
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > 4) return;

    setAdjustingIds((ids) => {
      const n = new Set(ids);
      n.add(log.id);
      return n;
    });
    const walletBalance = passesBalance
      ? passesBalance.total_purchased - passesBalance.total_used
      : 0;
    const futureScheduledQty = logs
      .filter(
        (l) =>
          l.delivery_date > today &&
          (l.status === "scheduled" || l.status === "out_for_delivery"),
      )
      .reduce((sum, l) => sum + (l.quantity ?? 1), 0);
    const activeQty =
      log.status === "scheduled" || log.status === "out_for_delivery"
        ? currentQty
        : 0;
    const available = walletBalance - futureScheduledQty + activeQty;

    try {
      let actionStr: 'update' | 'increase_swap' | 'decrease_expand';
      if (delta > 0) {
        if (available >= newQty) {
          actionStr = 'update';
        } else {
          const hasFutureToSwap = logs.some(
            (l) => l.status === 'scheduled' && l.delivery_date > log.delivery_date,
          );
          if (hasFutureToSwap) {
            actionStr = 'increase_swap';
          } else {
            showAlert(
              'Not enough meals left',
              'Buy a plan to add extra meals to your deliveries.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Buy a plan', onPress: () => router.push('/buy-passes') },
              ],
            );
            return;
          }
        }
      } else {
        actionStr = 'decrease_expand';
      }
      const result = await deliveriesApi.action({ action: actionStr, deliveryDate: log.delivery_date, deliverySlot: log.delivery_slot, quantity: newQty });
      queryClient.setQueryData(['deliveries'], result);
      queryClient.setQueryData(['home'], { success: true, data: result.homeData });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    } catch (err) {
      showAlert(
        'Error',
        err instanceof Error ? err.message : 'Could not update quantity. Please try again.',
      );
    } finally {
      setAdjustingIds((ids) => {
        const n = new Set(ids);
        n.delete(log.id);
        return n;
      });
    }
  }

  async function handleScheduleExtra(dateStr: string) {
    if (schedulingExtraDates.has(dateStr)) return;
    // The server takes a meal not yet on the calendar, or else one from a later delivery.
    const hasUnscheduledMeal = remaining - walletScheduledQty > 0;
    const hasFutureToSwap = logs.some(
      (l) => l.status === 'scheduled' && l.delivery_date > dateStr,
    );
    if (!hasUnscheduledMeal && !hasFutureToSwap) {
      showAlert(
        'Not enough meals left',
        'All your meals are already scheduled. Buy a plan to add extra deliveries.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy a plan', onPress: () => router.push('/buy-passes') },
        ],
      );
      return;
    }
    setSchedulingExtraDates((s) => new Set(s).add(dateStr));
    try {
      const res = await deliveriesApi.scheduleExtra(dateStr);
      if (!res.success)
        throw new Error(
          (res as unknown as { error?: string }).error ?? 'Failed to schedule',
        );
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    } catch (err) {
      showAlert(
        'Could not add delivery',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSchedulingExtraDates((s) => {
        const n = new Set(s);
        n.delete(dateStr);
        return n;
      });
    }
  }

  // ─── Derived state ──────────────────────────────────────────────────────────

  const today = todayISTStr();
  const weekDates = getWeekDates(weekOffset, today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[5];
  const weekLogs = [...logs]
    .filter((l) => l.delivery_date >= weekStart && l.delivery_date <= weekEnd)
    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
  const walletScheduledQty = logs
    .filter(
      (l) =>
        l.delivery_date > today &&
        (l.status === "scheduled" || l.status === "out_for_delivery"),
    )
    .reduce((sum, l) => sum + (l.quantity ?? 1), 0);
  const todayLogForPast = logs.find((l) => l.delivery_date === today) ?? null;
  const todayDeliveredMoveOn =
    todayLogForPast?.status === "delivered" &&
    todayLogForPast.delivered_at != null &&
    Date.now() - new Date(todayLogForPast.delivered_at).getTime() >=
      2 * 60 * 60 * 1000;
  const currentWeekPastDates = [
    ...getWeekDates(0, today).filter((d) => d < today),
    ...(todayDeliveredMoveOn ? [today] : []),
  ].reverse(); // most recent first
  const showLastWeekPast = currentWeekPastDates.length === 0;
  const pastGridDates = showLastWeekPast
    ? [...getWeekDates(-1, today)].reverse()
    : currentWeekPastDates;
  const pastGridLogs = logs.filter((l) =>
    pastGridDates.includes(l.delivery_date),
  );
  const hasPastGrid = pastGridLogs.length > 0;

  const lastScheduledDate = useMemo(
    () =>
      [...logs]
        .filter(
          (l) =>
            l.delivery_date >= today &&
            (l.status === "scheduled" || l.status === "out_for_delivery"),
        )
        .map((l) => l.delivery_date)
        .sort()
        .at(-1) ?? null,
    [logs, today],
  );

  const registeredDateStr = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    : today;
  const earliestMonday = getWeekDates(0, registeredDateStr)[0];
  const canGoPrev = !!passPurchase && weekStart > earliestMonday;
  const nextWeekMonday = getWeekDates(weekOffset + 1, today)[0];
  const currentWeekMonday = getWeekDates(0, today)[0];
  const canGoNext =
    !!passPurchase &&
    (nextWeekMonday <= currentWeekMonday ||
      (lastScheduledDate != null && nextWeekMonday <= lastScheduledDate));
  const remaining = passesBalance ? passesBalance.total_purchased - passesBalance.total_used : 0;
  const total = passesBalance?.total_purchased ?? 0;
  const isAnyPending = adjustingIds.size > 0 || skippingIds.size > 0 || schedulingExtraDates.size > 0;
  const defaultSchedule = schedules.find((s) => s.is_default) ?? null;
  const preferredDays = defaultSchedule?.preferred_days ?? [];
  const currentSlot = defaultSchedule?.delivery_slot ?? slots[0]?.id ?? '';

  // ─── Detail nav helper ──────────────────────────────────────────────────────

  function navToDetail(log: DeliveryLog) {
    router.push({
      pathname: '/delivery-detail',
      params: {
        id: log.id,
        date: log.delivery_date,
        slot: log.delivery_slot,
        status: log.status,
        passPurchaseId: passPurchase?.id ?? '',
        quantity: String(log.quantity ?? 1),
        mealName: bowl.name,
        mealImageUrl: '',
        addressLine: [
          defaultAddress?.label,
          defaultAddress?.full_address,
          defaultAddress?.area,
          defaultAddress?.city,
        ]
          .filter(Boolean)
          .join(' · '),
      },
    });
  }

  // ─── Loading / error states ─────────────────────────────────────────────────
  // Show skeleton only on very first open (no cache). On 2nd+ opens, cached
  // data is already in initData so we render immediately.
  const showSkeleton = cachedDeliveries === null && isLoading;

  if (showSkeleton) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 0) }]}>
          <Text style={[s.pageTitle, { color: colors.text, fontFamily: fonts.display }]}>Deliveries</Text>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: Spacing[3], paddingBottom: Spacing[5] }}>
          <DeliveriesSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (isError && !initData) {
    const errMsg = error instanceof Error ? error.message : 'Failed to load deliveries';
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 0) }]}>
          <Text style={[s.pageTitle, { color: colors.text, fontFamily: fonts.display }]}>Deliveries</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[6] }}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 12 }} />
          <Text style={[{ color: colors.text, fontFamily: fonts.bodySemibold, fontSize: FontSize.base, textAlign: 'center', marginBottom: 6 }]}>
            {"Couldn't load deliveries"}
          </Text>
          <Text style={[{ color: colors.textMuted, fontFamily: fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginBottom: 20 }]}>
            {errMsg}
          </Text>
          <TouchableOpacity
            style={[{ backgroundColor: colors.primary, paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderRadius: Radius.md }]}
            onPress={() => void refetch()}
            activeOpacity={0.85}>
            <Text style={[{ color: '#fff', fontFamily: fonts.bodySemibold, fontSize: FontSize.sm }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          s.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "android" ? 12 : 0),
          },
        ]}
      >
        <Text
          style={[
            s.pageTitle,
            { color: colors.text, fontFamily: fonts.display },
          ]}
        >
          Deliveries
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.content,
            { paddingTop: Spacing[3], paddingBottom: Spacing[5] },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={() => void handleManualRefresh()}
              tintColor={colors.primary}
            />
          }
        >
          {initData?.deliveriesPaused ? (
            <DeliveryCard colors={colors} style={{ backgroundColor: colors.warningBg, borderColor: "transparent" }}>
              <View style={s.pausedRow}>
                <Ionicons name="pause-circle-outline" size={20} color={colors.warning} />
                <Text style={[s.pausedText, { color: colors.text, fontFamily: fonts.body }]}>
                  Your deliveries are paused. Your meals are safe — message us to start them again.
                </Text>
              </View>
            </DeliveryCard>
          ) : null}

          {/* Wallet compact */}
          <DeliveryCard
            colors={colors}
            style={{
              backgroundColor: colors.primaryTint,
              borderColor: "transparent",
            }}
          >
            <View style={s.walletRow}>
              <View>
                <Text
                  style={[
                    s.walletMeta,
                    { color: colors.primary, fontFamily: fonts.bodySemibold },
                  ]}
                >
                  WALLET
                </Text>
                <View style={s.walletCountRow}>
                  <Text
                    style={[
                      s.walletCount,
                      { color: colors.primaryDark, fontFamily: fonts.display },
                    ]}
                  >
                    {remaining}
                  </Text>
                  <Text
                    style={[
                      s.walletSuffix,
                      { color: colors.textMuted, fontFamily: fonts.body },
                    ]}
                  >
                    {total > 0 ? ` of ${total}` : ""} meals left
                  </Text>
                </View>
                {walletScheduledQty > 0 && (
                  <Text
                    style={[
                      s.walletScheduled,
                      { color: colors.textMuted, fontFamily: fonts.body },
                    ]}
                  >
                    {walletScheduledQty} meal
                    {walletScheduledQty !== 1 ? "s" : ""} scheduled ahead
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[s.buyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/buy-passes")}
                activeOpacity={0.85}
              >
                <Text
                  style={[s.buyBtnText, { fontFamily: fonts.bodySemibold }]}
                >
                  Buy more
                </Text>
              </TouchableOpacity>
            </View>
          </DeliveryCard>

          {/* Address */}
          {passPurchase && (
            <DeliveryCard colors={colors}>
              <View style={s.addressRow}>
                <View style={s.addressLeft}>
                  <Text
                    style={[
                      s.addressMeta,
                      { color: colors.primary, fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    DELIVERY ADDRESS
                  </Text>
                  {defaultAddress ? (
                    <>
                      <Text
                        style={[
                          s.addressMain,
                          { color: colors.text, fontFamily: fonts.bodySemibold },
                        ]}
                        numberOfLines={2}
                      >
                        {defaultAddress.full_address}
                      </Text>
                      {(defaultAddress.label || defaultAddress.pincode) ? (
                        <Text
                          style={[
                            s.addressSub,
                            { color: colors.textMuted, fontFamily: fonts.body },
                          ]}
                        >
                          {[defaultAddress.label, defaultAddress.pincode]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text
                      style={[
                        s.addressMain,
                        { color: colors.textMuted, fontFamily: fonts.body },
                      ]}
                    >
                      No address saved
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={s.changeBtn}
                  onPress={() =>
                    showAlert(
                      'Change delivery address?',
                      'This will update your delivery address for all upcoming deliveries.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Change address',
                          onPress: () => router.push({ pathname: '/addresses', params: { selectMode: 'true' } }),
                        },
                      ],
                    )
                  }
                >
                  <Ionicons
                    name="pencil-outline"
                    size={12}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      s.changeBtnText,
                      { color: colors.primary, fontFamily: fonts.bodyMedium },
                    ]}
                  >
                    Change
                  </Text>
                </TouchableOpacity>
              </View>
            </DeliveryCard>
          )}

          {/* Preferred delivery days */}
          {passPurchase && (
            <DeliveryCard colors={colors}>
              <View style={s.prefRow}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={[
                        s.prefMeta,
                        { color: colors.primary, fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      DELIVERY DAYS
                    </Text>
                    <Text
                      style={[
                        s.prefMeta,
                        { color: colors.primary, fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      {(pendingDays ?? preferredDays).filter((x) => x !== 'Sunday').length}×/wk
                    </Text>
                  </View>
                </View>
                {pendingDays && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleSaveDays}
                    disabled={savingDays}
                    style={[s.saveDaysBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text
                      style={[
                        s.changeBtnText,
                        { color: "#fff", fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      {savingDays ? "Saving…" : "Save"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.dayRow}>
                {DISPLAY_DAYS.map((d) => {
                  const activeDays = pendingDays ?? preferredDays;
                  const isActive = activeDays.includes(d);
                  return (
                    <DayPill
                      key={d}
                      label={DAY_SHORT[d]}
                      active={isActive}
                      onPress={() => {
                        const current = pendingDays ?? [...preferredDays];
                        if (
                          isActive &&
                          current.filter((x) => x !== "Sunday").length <= 1
                        )
                          return;
                        const next = isActive
                          ? current.filter((x) => x !== d)
                          : [...current, d];
                        const isDirty =
                          next.length !== preferredDays.length ||
                          next.some((x) => !preferredDays.includes(x));
                        setPendingDays(isDirty ? next : null);
                      }}
                      colors={colors}
                      fonts={fonts}
                    />
                  );
                })}
              </View>
            </DeliveryCard>
          )}

          {/* Delivery time slot */}
          {passPurchase && (
            <DeliveryCard colors={colors}>
              <View style={s.prefRow}>
                <View style={s.prefTitle}>
                  <Text
                    style={[
                      s.prefMeta,
                      { color: colors.primary, fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    DELIVERY TIME
                  </Text>
                </View>
                {pendingSlot && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleSaveSlot}
                    disabled={savingSlot}
                    style={[s.saveDaysBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text
                      style={[
                        s.changeBtnText,
                        { color: "#fff", fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      {savingSlot ? "Saving…" : "Save"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.dayRow}>
                {slots.map((slot) => {
                  const activeSlot = pendingSlot ?? currentSlot;
                  const isActive = activeSlot === slot.id;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[
                        s.slotChip,
                        {
                          backgroundColor: isActive
                            ? colors.primary
                            : colors.surface2,
                          borderColor: "transparent",
                        },
                      ]}
                      onPress={() =>
                        setPendingSlot(slot.id === currentSlot ? null : slot.id)
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13 }}>{slot.icon ?? "⏰"}</Text>
                      <Text
                        style={[
                          s.slotChipLabel,
                          {
                            color: isActive ? colors.textOnPrimary : colors.text,
                            fontFamily: fonts.bodySemibold,
                          },
                        ]}
                      >
                        {slot.label}
                      </Text>
                      <Text
                        style={[
                          s.slotChipSub,
                          {
                            color: isActive ? colors.textOnPrimary : colors.textMuted,
                            fontFamily: fonts.body,
                          },
                        ]}
                      >
                        {formatTimeRange(slot.time_range)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </DeliveryCard>
          )}

          {/* Additional (non-default) schedules */}
          {passPurchase &&
            schedules
              .filter((sc) => !sc.is_default)
              .map((sched) => (
                <DeliveryCard key={sched.id} colors={colors}>
                  <View style={s.prefRow}>
                    <View>
                      <Text
                        style={[
                          s.prefMeta,
                          {
                            color: colors.textMuted,
                            fontFamily: fonts.bodyMedium,
                          },
                        ]}
                      >
                        {sched.label.toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          s.prefSub,
                          { color: colors.textMuted, fontFamily: fonts.body },
                        ]}
                      >
                        {sched.preferred_days.length > 0
                          ? `${sched.preferred_days.length} days · ${slotLabel(sched.delivery_slot, slots)}`
                          : "No days selected"}
                      </Text>
                    </View>
                  </View>
                  <View style={s.dayRow}>
                    {DISPLAY_DAYS.map((d) => (
                      <DayPill
                        key={d}
                        label={DAY_SHORT[d]}
                        active={sched.preferred_days.includes(d)}
                        colors={colors}
                        fonts={fonts}
                      />
                    ))}
                  </View>
                </DeliveryCard>
              ))}

          {/* Schedule — week calendar with navigation */}
          <View style={{ gap: Spacing[2] }}>
            <SectionHeader label="Schedule" />
            <WeekNav
              weekOffset={weekOffset}
              weekStart={weekStart}
              weekEnd={weekEnd}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              isAnyPending={isAnyPending}
              onPrev={() => setWeekOffset((o) => o - 1)}
              onNext={() => setWeekOffset((o) => o + 1)}
              onJumpToActive={() => setWeekOffset(0)}
              colors={colors}
              fonts={fonts}
            />
            <DeliveryCard colors={colors} style={{ padding: 0 }}>
              {rowsForDays(weekDates, weekLogs).map(({ dateStr, log }, i) => {
                const isNonPreferred =
                  !log && !preferredDays.includes(weekdayOf(dateStr));
                return (
                  <DeliveryRow
                    key={log?.id ?? dateStr}
                    dateStr={dateStr}
                    log={log}
                    index={i}
                    today={today}
                    passPurchaseId={passPurchase?.id}
                    hasPurchase={!!passPurchase}
                    bowl={bowl}
                    slots={slots}
                    adjustingIds={adjustingIds}
                    skippingIds={skippingIds}
                    isAnyPending={isAnyPending}
                    isNonPreferredDay={isNonPreferred}
                    lastScheduledDate={lastScheduledDate}
                    schedulingExtraDates={schedulingExtraDates}
                    colors={colors}
                    fonts={fonts}
                    onPress={navToDetail}
                    onQtyChange={handleQtyChange}
                    onSkip={handleInlineSkip}
                    onUnskip={handleInlineUnskip}
                    onScheduleExtra={weekOffset === 0 ? handleScheduleExtra : undefined}
                  />
                );
              })}

              {/* Sunday rest day */}
              <View
                style={[
                  s.sundayRow,
                  {
                    borderTopColor: colors.borderLight,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Ionicons
                  name="cafe-outline"
                  size={12}
                  color={colors.textMuted}
                  style={{ opacity: 0.5 }}
                />
                <Text
                  style={[
                    s.sundayText,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  Sunday · Rest Day
                </Text>
              </View>
            </DeliveryCard>
          </View>

          {/* Past deliveries — week grid */}
          {hasPastGrid && (
            <View style={{ gap: Spacing[2] }}>
              <SectionHeader
                label={`Past · ${formatWeekRange(pastGridDates[0], pastGridDates[pastGridDates.length - 1])}`}
                action="View history →"
                onAction={() => router.push("/delivery-history")}
              />
              <DeliveryCard colors={colors} style={{ padding: 0 }}>
                {rowsForDays(pastGridDates, pastGridLogs).map(({ dateStr, log: pastLog }, i) => {
                  const isNonPreferredPast = !pastLog && !preferredDays.includes(weekdayOf(dateStr));
                  return (
                    <DeliveryRow
                      key={pastLog?.id ?? dateStr}
                      dateStr={dateStr}
                      log={pastLog}
                      index={i}
                      today={today}
                      passPurchaseId={passPurchase?.id}
                      hasPurchase={!!passPurchase}
                      bowl={bowl}
                      slots={slots}
                      adjustingIds={adjustingIds}
                      skippingIds={skippingIds}
                      isAnyPending={isAnyPending}
                      isNonPreferredDay={isNonPreferredPast}
                      colors={colors}
                      fonts={fonts}
                      onPress={navToDetail}
                      onQtyChange={handleQtyChange}
                      onSkip={handleInlineSkip}
                      onUnskip={handleInlineUnskip}
                    />
                  );
                })}
              </DeliveryCard>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pausedRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  pausedText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4] },
  header: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3] },

  pageTitle: {
    fontSize: FontSize["1.5xl"],
    letterSpacing: -0.5,
  },

  // Wallet compact
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing[4],
  },
  walletMeta: { fontSize: 11, letterSpacing: 0.6, marginBottom: 2 },
  walletCountRow: { flexDirection: "row", alignItems: "baseline" },
  walletCount: { fontSize: FontSize["2xl"], fontWeight: FontWeight.semibold },
  walletSuffix: { fontSize: FontSize.sm },
  walletScheduled: { fontSize: FontSize.xs, marginTop: 3 },
  buyBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
  },
  buyBtnText: { fontSize: FontSize.sm, color: "#fff" },

  // Address
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: Spacing[4],
  },
  addressLeft: { flex: 1 },
  addressMeta: { fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },
  addressMain: { fontSize: FontSize.base },
  addressSub: { fontSize: FontSize.xs, marginTop: 2 },
  changeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  changeBtnText: { fontSize: FontSize.xs },
  saveDaysBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
    borderRadius: Radius.full,
  },

  // Preferred days / slot
  prefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: Spacing[4],
    paddingBottom: Spacing[3],
  },
  prefTitle: { gap: Spacing[1] },
  prefMeta: { fontSize: 11, letterSpacing: 0.6, marginBottom: 2 },
  prefSub: { fontSize: FontSize.xs, marginTop: 2 },
  dayRow: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
  },

  // Slot chips
  slotChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  slotChipLabel: { fontSize: FontSize.xs },
  slotChipSub: { fontSize: 10, opacity: 0.7 },

  // Sunday rest day
  sundayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing[3],
  },
  sundayText: { fontSize: FontSize.xs },
});
