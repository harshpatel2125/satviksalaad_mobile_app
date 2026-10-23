import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { HomeHeader } from '@/components/ui/home-header';
import { SectionHeader } from '@/components/ui/section-header';
import { QuickActions } from '@/components/screens/home/quick-actions';
import { RecentActivity } from '@/components/screens/home/recent-activity';
import { ThisWeek } from '@/components/screens/home/this-week';
import { TodayDelivery, type DeliveryCardState } from '@/components/screens/home/today-delivery';
import { WalletHero } from '@/components/screens/home/wallet-hero';
import { VideoStrip } from '@/components/screens/home/video-strip';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { deliveriesApi, homeApi, notificationsApi, passesApi, plansApi } from '@/lib/api';
import { useTrialPopupTrigger } from '@/hooks/use-trial-popup-trigger';
import { TrialBowlSheet } from '@/components/screens/home/trial-bowl-sheet';
import { optimizedImageUrls } from '@/lib/image-url';
import { CACHE_TTL, homeStaticPersister } from '@/lib/query-client';
import { slotLabel } from '@/lib/slots';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth';
import type { HomeCriticalLog, DeliveryStatus } from '@/types/api';
import { readHomeCache, writeHomeCache, parseTimeRange } from '@/lib/home-cache';
import type { CachedDeliveryLog } from '@/lib/home-cache';
import { predictHomeState } from '@/lib/predictive-engine';
import type { PredictedHomeState } from '@/lib/predictive-engine';
import { bowlFor } from "@/components/screens/deliveries/delivery-row";

const HOME_BOWL = bowlFor(null);

function todayISTStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function tomorrowISTStr(): string {
  return new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function currentHourIST(): number {
  return parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
    10,
  );
}

function isAfter11PMIST(): boolean {
  return currentHourIST() >= 23;
}

function cachedLogToHomeCriticalLog(l: CachedDeliveryLog): HomeCriticalLog {
  return {
    id: l.id,
    delivery_date: l.deliveryDate,
    delivery_slot: l.deliverySlot,
    status: l.status as DeliveryStatus,
    quantity: l.quantity,
    delivered_at: l.deliveredAt,
    meal_id: l.mealId,
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors, fonts, isDark } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const userId = session?.user?.id ?? null;

  // Synchronous MMKV read before first render — shows real data with zero skeleton on second+ opens
  const [predictedState, setPredictedState] = useState<PredictedHomeState | null>(() => {
    if (!userId) return null;
    const cached = readHomeCache(userId);
    if (!cached) return null;
    return predictHomeState({ cache: cached, now: new Date() });
  });

  // If session wasn't available at mount (rare), try once when it resolves
  React.useEffect(() => {
    if (!userId || predictedState) return;
    const cached = readHomeCache(userId);
    if (!cached) return;
    setPredictedState(predictHomeState({ cache: cached, now: new Date() }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: homeApi.critical,
    staleTime: CACHE_TTL.home,
    enabled: !!session,
  });
  useQueryFocusRefetch(['home']);

  const { data: staticData } = useQuery({
    queryKey: ['home-static'],
    queryFn: homeApi.static,
    staleTime: CACHE_TTL.homeStatic,
    persister: homeStaticPersister.persisterFn,
  });

  // Cached for the next cold start; this render already has live data.
  React.useEffect(() => {
    if (!data?.data || !userId || !staticData?.data) return;
    const slots = staticData.data.slots.map((s) => {
      const { startMinutes, endMinutes } = parseTimeRange(s.time_range);
      return { id: s.id, label: s.label, startMinutes, endMinutes };
    });
    const cacheData = {
      userId,
      cachedAt: new Date().toISOString(),
      purchaseId: data.data.purchase?.id ?? null,
      planName: data.data.purchase?.plan_name ?? null,
      logs: data.data.logs.map((l) => ({
        id: l.id,
        deliveryDate: l.delivery_date,
        deliverySlot: l.delivery_slot,
        status: l.status,
        quantity: l.quantity,
        mealId: l.meal_id,
        deliveredAt: l.delivered_at,
      })),
      schedule: data.data.schedule
        ? { preferredDays: data.data.schedule.preferred_days, deliverySlot: data.data.schedule.delivery_slot }
        : null,
      balance: data.data.balance
        ? { totalPurchased: data.data.balance.total_purchased, totalUsed: data.data.balance.total_used }
        : null,
      slots,
    };
    writeHomeCache(userId, cacheData);

    // Warm expo-image disk cache with all meal images so the menu tab loads
    // instantly when the user first opens it.
    const mealImageUrls = optimizedImageUrls(staticData.data.meals.map((m) => m.image_url));
    if (mealImageUrls.length > 0) {
      Image.prefetch(mealImageUrls)
        .catch(() => { /* non-critical */ });
    }
  }, [data, staticData, userId]);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    staleTime: CACHE_TTL.notifications,
    refetchOnMount: false,
    enabled: !!session,
  });
  const hasUnreadNotifications = (notifData?.unread_count ?? 0) > 0;

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: plansApi.list,
    staleTime: 10 * 60 * 1000,
  });
  const trialPlan = (plansData?.data ?? [])
    .filter((p) => p.duration === 'trial')
    .sort((a, b) => a.price_paise - b.price_paise)[0] ?? null;

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  async function handleManualRefresh() {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  }

  // A fire-and-forget side effect on every focus — not a data read, so not in useQuery
  useFocusEffect(
    useCallback(() => {
      void passesApi.heal().catch(() => {});
    }, [])
  );

  const screenOpacity = useSharedValue(1);
  const animatedScreenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  // Dip-and-recover animation fires only on first install (skeleton was showing)
  // On second+ opens predictedState already shows real data — no dip needed
  const hadSkeleton = React.useRef(!predictedState);
  const prevIsLoading = React.useRef(true);
  React.useEffect(() => {
    if (prevIsLoading.current && !isLoading && hadSkeleton.current) {
      screenOpacity.value = 0.75;
      screenOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
    }
    prevIsLoading.current = isLoading;
  }, [isLoading, screenOpacity]);

  const homeData = data?.data;
  const staticHomeData = staticData?.data;

  // Show skeleton only when no cache exists (first install). Second+ opens: cache → instant render.
  const showSkeleton = !predictedState && isLoading;

  const passPurchase = homeData?.purchase ?? null;
  const passesBalance = homeData?.balance ?? null;
  const mealsLeft = passesBalance
    ? passesBalance.total_purchased - passesBalance.total_used
    : (predictedState?.passesRemaining ?? 0);
  const outOfMeals = !!passPurchase && mealsLeft <= 0;

  const logs: HomeCriticalLog[] = useMemo(() => {
    if (homeData?.logs) return homeData.logs;
    if (!userId) return [];
    const cached = readHomeCache(userId);
    if (!cached) return [];
    return cached.logs.map(cachedLogToHomeCriticalLog);
  }, [homeData, userId]);

  // Before the API answers, the cached prediction decides whether there is a plan.
  const hasPurchase = homeData
    ? !!homeData.purchase
    : predictedState !== null && predictedState.passesRemaining > 0;

  const today = todayISTStr();

  const preferredDays = useMemo(() => {
    const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return [...new Set(
      logs
        .filter((l) => l.delivery_date >= today && l.status === 'scheduled')
        .map((l) => dow[new Date(l.delivery_date + 'T00:00:00').getDay()])
    )];
  }, [logs, today]);

  const tomorrow = tomorrowISTStr();
  const nowHourIST = currentHourIST();

  const rawTodayLog = logs.find((l) => l.delivery_date === today) ?? null;

  // When API hasn't loaded yet and today has a 'scheduled' log, upgrade to out_for_delivery if
  // the predictive engine says the slot window has started. 'preparing' and 'delivered' are
  // handled in the delivery-state block below to avoid null delivered_at guard issues.
  const todayLog: HomeCriticalLog | null = useMemo(() => {
    if (homeData || !predictedState || !rawTodayLog) return rawTodayLog;
    if (rawTodayLog.status === 'scheduled' && predictedState.todayStatus === 'out_for_delivery') {
      return { ...rawTodayLog, status: 'out_for_delivery' as DeliveryStatus };
    }
    return rawTodayLog;
  }, [homeData, predictedState, rawTodayLog]);
  const nextScheduled =
    [...logs]
      .filter((l) => l.delivery_date >= today && (l.status === 'scheduled' || l.status === 'out_for_delivery'))
      .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))[0] ?? null;
  const todayDeliveredMoveOn =
    todayLog?.status === "delivered" &&
    todayLog.delivered_at != null &&
    Date.now() - new Date(todayLog.delivered_at).getTime() >=
      2 * 60 * 60 * 1000;
  const recentLogs = [
    ...(todayDeliveredMoveOn && todayLog ? [todayLog] : []),
    ...logs
      .filter((l) => l.delivery_date < today)
      .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date)),
  ].slice(0, 3);

  // Nearest future skip still within the undo window (before 11 PM cutoff for its date)
  const nearestSkippedLog = useMemo(
    () =>
      [...logs]
        .filter((l) => {
          if (l.status !== "skipped") return false;
          if (l.delivery_date < tomorrow) return false;
          if (l.delivery_date === tomorrow && nowHourIST >= 23) return false;
          return true;
        })
        .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))[0] ??
      null,
    [logs, tomorrow, nowHourIST],
  );

  async function handleUndoSkip() {
    if (!passPurchase || !nearestSkippedLog) return;
    try {
      const result = await deliveriesApi.action({ action: "unskip", passId: passPurchase.id, date: nearestSkippedLog.delivery_date, deliverySlot: nearestSkippedLog.delivery_slot });
      queryClient.setQueryData(["deliveries"], result);
      queryClient.setQueryData(["home"], { success: true, data: result.homeData });
    } catch {
      // silent — user can retry from the deliveries tab
    }
  }

  let deliveryState: DeliveryCardState = "skip";
  let displayLog: HomeCriticalLog | null = null;

  if (todayLog?.status === "out_for_delivery") {
    deliveryState = "on_the_way";
    displayLog = todayLog;
  } else if (todayLog?.status === "delivered") {
    const deliveredAt = todayLog.delivered_at
      ? new Date(todayLog.delivered_at).getTime()
      : null;
    if (deliveredAt && Date.now() - deliveredAt < 2 * 60 * 60 * 1000) {
      deliveryState = "delivered";
      displayLog = todayLog;
    } else {
      displayLog = nextScheduled;
      if (displayLog) {
        deliveryState =
          isAfter11PMIST() && displayLog.delivery_date === tomorrow
            ? "locked"
            : "skip";
      }
    }
  } else if (todayLog?.status === "scheduled") {
    displayLog = todayLog;
    if (!homeData && predictedState?.todayStatus === 'delivered') {
      // Past slot end — predict delivered while API reconciles; no delivered_at yet
      deliveryState = "delivered";
    } else {
      deliveryState = nowHourIST >= 7 ? "preparing" : "locked";
    }
  } else {
    // No today log, or today is skipped/missed — show next upcoming
    displayLog = nextScheduled;
    if (displayLog) {
      deliveryState =
        isAfter11PMIST() && displayLog.delivery_date === tomorrow
          ? "locked"
          : "skip";
    }
  }

  if (deliveryState === "skip" && nearestSkippedLog != null) {
    deliveryState = "undo_skip";
  }

  // QuickActions "Skip a day" — opens picker showing all future deliveries
  function handlePickerPress() {
    if (!passPurchase) {
      router.push({ pathname: "/skip-delivery", params: { explain: "true" } });
      return;
    }
    router.push({
      pathname: "/skip-delivery",
      params: { passPurchaseId: passPurchase.id },
    });
  }

  function handleSkipPress() {
    if (!passPurchase || !nextScheduled) {
      router.push({ pathname: '/skip-delivery', params: { explain: 'true' } });
      return;
    }

    const isLocked = (d: string) => d <= today || (isAfter11PMIST() && d === tomorrow);

    if (isLocked(nextScheduled.delivery_date)) {
      const nextSkippable = logs
        .filter((l) => !isLocked(l.delivery_date) && (l.status === 'scheduled' || l.status === 'out_for_delivery'))
        .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))[0] ?? null;
      if (!nextSkippable) return;
      const lockedMeal = HOME_BOWL;
      const nextMeal = HOME_BOWL;
      router.push({
        pathname: '/skip-delivery',
        params: {
          passPurchaseId: passPurchase.id,
          date: nextScheduled.delivery_date,
          slot: nextScheduled.delivery_slot,
          mealName: lockedMeal.name,
          mealImageUrl: lockedMeal.image_url ?? '',
          nextDate: nextSkippable.delivery_date,
          nextSlot: nextSkippable.delivery_slot,
          nextMealName: nextMeal.name,
          nextMealImageUrl: nextMeal.image_url ?? '',
        },
      });
      return;
    }
    const meal = HOME_BOWL;
    router.push({ pathname: '/skip-delivery', params: { passPurchaseId: passPurchase.id, date: nextScheduled.delivery_date, slot: nextScheduled.delivery_slot, mealName: meal.name, mealImageUrl: meal.image_url ?? '' } });
  }

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    'worklet';
    scrollY.value = event.contentOffset.y;
  });

  const { show: showTrialSheet, dismiss: dismissTrialSheet } = useTrialPopupTrigger(scrollY, !hasPurchase);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      <HomeHeader
        scrollY={scrollY}
        onBellPress={() => router.push("/notifications")}
        hasBellDot={hasUnreadNotifications}
      />

      <Animated.ScrollView
        style={[styles.scroll, animatedScreenStyle]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing[3], paddingBottom: Spacing[5] },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={() => void handleManualRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <WalletHero
          remaining={mealsLeft}
          total={passesBalance?.total_purchased ?? (predictedState?.totalPurchased ?? 0)}
          colors={colors}
          fonts={fonts}
          loading={showSkeleton}
          empty={!showSkeleton && !passPurchase && !hasPurchase}
          onBuyMore={() => router.push("/buy-passes")}
          onHistory={() => router.push("/delivery-history")}
          onPress={() => router.push("/wallet")}
        />

        <View style={styles.section}>
          <SectionHeader
            label={
              showSkeleton
                ? "Today's delivery"
                : displayLog?.delivery_date === today
                  ? "Today's delivery"
                  : displayLog?.delivery_date === tomorrow
                    ? "Tomorrow's delivery"
                    : displayLog
                      ? "Next delivery"
                      : passPurchase
                        ? "Deliveries"
                        : "Your first delivery"
            }
          />
          {showSkeleton || displayLog ? (
            <TodayDelivery
              log={
                displayLog ?? {
                  id: "",
                  delivery_date: today,
                  delivery_slot: staticHomeData?.slots[0]?.id ?? "noon",
                  status: "scheduled",
                  quantity: 1,
                  delivered_at: null,
                }
              }
              deliveryState={deliveryState}
              colors={colors}
              fonts={fonts}
              loading={showSkeleton}
              mealName={displayLog ? HOME_BOWL.name : undefined}
              imageUrl={displayLog ? HOME_BOWL.image_url : null}
              onSkip={handleSkipPress}
              onUndoSkip={() => void handleUndoSkip()}
            />
          ) : (
            /* Mirrors TodayDelivery layout exactly — same card, same row + button structure */
            <View
              style={[
                styles.edCard,
                { backgroundColor: colors.surface },
                CardEdge,
              ]}
            >
              <View style={styles.edRow}>
                <View
                  style={[
                    styles.edThumb,
                    { backgroundColor: colors.primaryBg },
                  ]}
                >
                  <Ionicons
                    name={
                      passPurchase ? "checkmark-circle-outline" : "leaf-outline"
                    }
                    size={28}
                    color={colors.primaryDark}
                  />
                </View>

                <View style={styles.edInfo}>
                  <View style={styles.edInfoTop}>
                    <Text
                      style={[
                        styles.edMealName,
                        { color: colors.text, fontFamily: fonts.bodySemibold },
                      ]}
                      numberOfLines={1}
                    >
                      {outOfMeals
                        ? "No meals left"
                        : passPurchase
                          ? "All set this week!"
                          : "Your first delivery"}
                    </Text>
                    <View
                      style={[
                        styles.edBadge,
                        {
                          backgroundColor: passPurchase
                            ? colors.primaryBg
                            : colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.edBadgeText,
                          {
                            color: passPurchase
                              ? colors.primaryDark
                              : colors.textMuted,
                            fontFamily: fonts.bodyMedium,
                          },
                        ]}
                      >
                        {outOfMeals ? "Plan used up" : passPurchase ? "Scheduled" : "Not set up"}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.edSlot,
                      { color: colors.textMuted, fontFamily: fonts.body },
                    ]}
                    numberOfLines={1}
                  >
                    {outOfMeals
                      ? "Buy a plan to keep your meals coming"
                      : passPurchase
                      ? "☀️ Check back for your next slot"
                      : staticData?.data?.slots?.length
                        ? slotLabel(staticData.data.slots[0].id, staticData.data.slots)
                        : "Pick your delivery slot"}
                  </Text>

                  <View style={styles.edDateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={11}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.edDate,
                        { color: colors.textMuted, fontFamily: fonts.body },
                      ]}
                    >
                      {passPurchase
                        ? "No upcoming delivery"
                        : "Not scheduled yet"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bottom button — same height/position as TodayDelivery's trackBtn */}
              <TouchableOpacity
                style={[styles.edBtn, { backgroundColor: colors.primary }]}
                onPress={() =>
                  router.push(
                    passPurchase && !outOfMeals ? "/(tabs)/deliveries" : "/buy-passes",
                  )
                }
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.edBtnText, { fontFamily: fonts.bodySemibold }]}
                >
                  {passPurchase && !outOfMeals ? "See full schedule →" : "Buy a plan →"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {(showSkeleton || hasPurchase) && (
          <View style={styles.section}>
            <SectionHeader
              label="This week"
              action="See all"
              onAction={() => router.push("/(tabs)/deliveries")}
            />
            <ThisWeek
              preferredDays={preferredDays}
              logs={logs}
              colors={colors}
              fonts={fonts}
              loading={showSkeleton}
              onDayPress={(log) =>
                !isLoading &&
                (log
                  ? router.push({
                      pathname: "/delivery-detail",
                      params: {
                        id: log.id,
                        date: log.delivery_date,
                        slot: log.delivery_slot,
                        status: log.status,
                        passPurchaseId: passPurchase?.id ?? "",
                        quantity: String(log.quantity ?? 1),
                        mealName: HOME_BOWL.name,
                        mealImageUrl: HOME_BOWL.image_url ?? "",
                      },
                    })
                  : router.push("/(tabs)/deliveries"))
              }
            />
          </View>
        )}

        <View style={styles.actions}>
          <View style={styles.section}>
            <SectionHeader label="Quick actions" />
            <QuickActions
              colors={colors}
              fonts={fonts}
              onSkipToday={handlePickerPress}
              onBuyPasses={() => router.push("/buy-passes")}
              onMenu={() => router.push("/(tabs)/menu")}
              onSettings={() => router.push("/settings")}
            />
          </View>

          <VideoStrip
            onOpen={(video) => router.push({ pathname: "/video-player", params: { id: video.id } })}
            onSeeAll={() => router.navigate("/(tabs)/videos")}
          />

          {(showSkeleton || recentLogs.length > 0) && (
            <RecentActivity
              logs={recentLogs}
              bowl={HOME_BOWL}
              colors={colors}
              fonts={fonts}
              loading={showSkeleton}
              onSeeAll={() => router.push("/delivery-history")}
            />
          )}
        </View>
      </Animated.ScrollView>

      {!hasPurchase && trialPlan && (
        <TrialBowlSheet
          visible={showTrialSheet}
          trialPlanId={trialPlan.id}
          trialPrice={Math.round(trialPlan.price_paise / 100)}
          meals={(staticHomeData?.meals ?? []).slice(0, 6).map((m) => ({
            id: m.name,
            name: m.name,
            image_url: m.image_url,
          }))}
          onDismiss={dismissTrialSheet}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing[5],
    gap: Spacing[5],
  },
  actions: {
    gap: Spacing[2.5],
  },
  section: {
    gap: Spacing[2],
  },

  /* Empty delivery card — mirrors TodayDelivery geometry exactly */
  edCard: {
    borderRadius: 16,
    padding: Spacing[4],
    height: 142,
    overflow: "hidden",
  },
  edRow: {
    flexDirection: "row",
    gap: Spacing[3],
    height: 60,
  },
  edThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  edInfo: {
    flex: 1,
    gap: 3,
  },
  edInfoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  edMealName: {
    fontSize: FontSize.base,
    flex: 1,
  },
  edBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  edBadgeText: {
    fontSize: 11,
  },
  edSlot: {
    fontSize: 11,
    marginTop: -4,
  },
  edDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  edDate: {
    fontSize: 11,
  },
  edBtn: {
    width: "100%" as const,
    height: 38,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[3],
  },
  edBtnText: {
    fontSize: FontSize.sm,
    color: "#fff",
  },
});
