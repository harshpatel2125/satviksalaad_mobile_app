import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from '@/components/ui/text';
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQuery } from '@tanstack/react-query';

import { BottomActionBar } from "@/components/ui/bottom-action-bar";
import { ScreenHeader } from "@/components/ui/screen-header";
import { CheckoutFooter } from '@/components/screens/buy-passes/checkout-footer';
import {
  DeliverySchedule,
  SectionLabel,
} from '@/components/screens/buy-passes/delivery-schedule';
import {
  FruitPlanCard,
  HeroPlanCard,
  planBadge,
  StandardPlanCard,
  totalFor,
} from '@/components/screens/buy-passes/plan-card';
import { BuyPassesSkeleton } from '@/components/skeletons/buy-passes-skeleton';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { passesApi, plansApi, slotsApi } from '@/lib/api';
import { trackPlanSelected, trackScreenOpened } from '@/lib/analytics';
import { readPlansCache, readSlotsCache, writePlansCache, writeSlotsCache } from '@/lib/home-cache';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import type { Plan, TimeSlot } from '@/types/api';
import { DISPLAY_DAYS } from '@/components/screens/deliveries/week-nav';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLET_BREAKPOINT = 768;


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BuyPassesScreen() {
  const { colors, fonts } = useTheme();
  const router  = useRouter();
  const { planId: requestedPlanId } = useLocalSearchParams<{ planId?: string }>();
  const { width, height: windowHeight } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const scrollViewRef   = useRef<ScrollView>(null);
  const scheduleLayoutY = useRef(0);
  const currentScrollY  = useRef(0);
  const [scheduleViewed, setScheduleViewed] = useState(false);

  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [mealCounts, setMealCounts]     = useState<Record<string, number>>({});
  const [selectedDays, setSelectedDays] = useState<string[]>([...DISPLAY_DAYS]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('noon');
  const didInit = useRef(false);

  // Synchronous MMKV reads before first render — instant content on 2nd+ opens
  const [cachedPlans] = useState(() => readPlansCache());
  const [cachedSlots] = useState(() => readSlotsCache());

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: plansApi.list,
    staleTime: CACHE_TTL.plans,
    persister: asyncPersister.persisterFn,
  });
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots'],
    queryFn: slotsApi.list,
    staleTime: CACHE_TTL.slots,
    persister: asyncPersister.persisterFn,
  });
  const { data: passesData } = useQuery({
    queryKey: ['passes'],
    queryFn: () => passesApi.list().catch(() => null),
    staleTime: CACHE_TTL.wallet,
  });

  React.useEffect(() => {
    if (plansData?.data) writePlansCache(plansData.data);
  }, [plansData]);
  React.useEffect(() => {
    if (slotsData?.data) writeSlotsCache(slotsData.data);
  }, [slotsData]);

  // Server data takes priority; MMKV cache fills in before first API response
  const allPlans = useMemo<Plan[]>(() => plansData?.data ?? cachedPlans ?? [], [plansData, cachedPlans]);
  const slots    = useMemo<TimeSlot[]>(() => slotsData?.data ?? cachedSlots ?? [], [slotsData, cachedSlots]);
  const passesLeft: number | null = passesData?.meta?.balance?.remaining ?? null;
  // Skeleton only on first install — cached data shows immediately on 2nd+ opens
  const isLoading = (plansLoading || slotsLoading) && cachedPlans === null && cachedSlots === null;

  useEffect(() => {
    if (isLoading || didInit.current || !allPlans.length) return;
    didInit.current = true;

    let defaultCategory = 'salad';

    if (passesData?.data?.length) {
      const sorted = [...passesData.data]
        .filter((p): p is typeof p & { paid_at: string } => Boolean(p.paid_at))
        .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
      const last = sorted[0] ?? passesData.data[0];
      if (last?.pass_plans?.category === 'fruit') defaultCategory = 'fruit';
    }

    setSelectedSlotId(slots[0]?.id ?? 'noon');

    const counts: Record<string, number> = {};
    allPlans.forEach((p) => { counts[p.id] = p.total_meals; });
    setMealCounts(counts);

    const saladPlans = allPlans.filter((p) => p.category !== 'fruit');
    const defaultPlan =
      defaultCategory === 'fruit'
        ? allPlans.find((p) => p.category === 'fruit' && p.is_popular) ?? allPlans.find((p) => p.category === 'fruit')
        : saladPlans.find((p) => p.is_popular) ?? saladPlans[0];
    const requestedPlan = allPlans.find((p) => p.id === requestedPlanId);
    setSelectedId(requestedPlan?.id ?? defaultPlan?.id ?? null);
  }, [isLoading, allPlans, slots, passesData, requestedPlanId]);

  useEffect(() => { trackScreenOpened('buy_passes'); }, []);

  const selectedPlan      = allPlans.find((p) => p.id === selectedId);
  const selectedMealCount = selectedId ? (mealCounts[selectedId] ?? selectedPlan?.total_meals ?? 0) : 0;
  const totalPricePaise   = selectedPlan ? totalFor(selectedPlan, selectedMealCount) : 0;
  const totalRs           = Math.round(totalPricePaise / 100);

  function handleSelectPlan(plan: Plan) {
    setSelectedId(plan.id);
    trackPlanSelected(plan.id);
  }

  function handleScrollEvent(e: NativeSyntheticEvent<NativeScrollEvent>) {
    currentScrollY.current = e.nativeEvent.contentOffset.y;
  }

  function handleCheckoutPress() {
    if (!selectedPlan || !canCheckout) return;

    // Skip the forced scroll if the user has already scrolled to the schedule area manually
    const alreadyScrolledDown =
      scheduleLayoutY.current > 0 &&
      currentScrollY.current > scheduleLayoutY.current - windowHeight * 0.3;

    if (!scheduleViewed && !alreadyScrolledDown) {
      // First tap: scroll to the Delivery Schedule and mark it as viewed
      setScheduleViewed(true);
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, scheduleLayoutY.current - 16),
        animated: true,
      });
      return;
    }

    router.push({
      pathname: '/checkout',
      params: {
        planId: selectedPlan.id,
        mealCount: String(selectedMealCount),
        totalPricePaise: String(totalPricePaise),
        days: selectedDays.join(','),
        slot: selectedSlotId,
      },
    });
  }

  function handleMealCountChange(planId: string, count: number) {
    setMealCounts((prev) => ({ ...prev, [planId]: count }));
  }

  function toggleDay(day: string) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  }

  // Largest packs first, but the launch offer leads the list, as on the website.
  const saladPlans = allPlans
    .filter((p) => p.category !== 'fruit')
    .sort((a, b) =>
      Number(planBadge(b)?.tone === 'gold') - Number(planBadge(a)?.tone === 'gold') ||
      b.total_meals - a.total_meals,
    );
  const heroPlan = saladPlans.find((p) => p.is_popular) ?? saladPlans[0];
  const fruitPlans = allPlans.filter((p) => p.category === 'fruit').sort((a, b) => b.total_meals - a.total_meals);

  const canCheckout   = !!selectedPlan && selectedDays.length > 0;
  const contentPadding = isTablet ? Spacing[8] : Spacing[5];
  const maxCardWidth   = isTablet ? Math.min(width - contentPadding * 2, 640) : undefined;
  const tabletCenter: object | undefined = isTablet
    ? { maxWidth: maxCardWidth, alignSelf: 'center' as const, width: '100%' as const }
    : undefined;

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <BuyPassesSkeleton />
      </View>
    );
  }

  const balancePill =
    passesLeft !== null ? (
      <View
        style={[
          styles.balancePill,
          {
            backgroundColor: colors.primaryTint,
            borderColor: colors.primary + "33",
          },
        ]}
      >
        <Text
          style={[
            styles.balanceNum,
            { color: colors.primaryDark, fontFamily: fonts.display },
          ]}
        >
          {passesLeft}
        </Text>
        <Text
          style={[
            styles.balanceLabel,
            { color: colors.textMuted, fontFamily: fonts.body },
          ]}
        >
          left
        </Text>
      </View>
    ) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Choose your plan"
        onBack={() => router.back()}
        right={balancePill}
      />
      <Animated.View
        entering={FadeIn.duration(350).withInitialValues({
          transform: [{ translateY: 8 }],
        })}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScrollEvent}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Spacing[3],
              paddingBottom: Spacing[5],
              paddingHorizontal: contentPadding,
            },
          ]}
        >
          {/* ── Salad plans ───────────────────────────────────────────────── */}
          <View style={[styles.section, tabletCenter]}>
            <SectionLabel
              label="SALAD PLANS"
              sub={`${saladPlans.length} plans`}
              enterDelay={60}
            />

            {heroPlan && (
              <HeroPlanCard
                plan={heroPlan}
                isSelected={selectedId === heroPlan.id}
                mealCount={mealCounts[heroPlan.id] ?? heroPlan.total_meals}
                onSelect={handleSelectPlan}
                onMealCountChange={(n) => handleMealCountChange(heroPlan.id, n)}
                enterDelay={120}
              />
            )}

            {saladPlans.filter((p) => p !== heroPlan).map((plan, i) => (
              <StandardPlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedId === plan.id}
                mealCount={mealCounts[plan.id] ?? plan.total_meals}
                onSelect={handleSelectPlan}
                onMealCountChange={(n) => handleMealCountChange(plan.id, n)}
                enterDelay={200 + i * 80}
              />
            ))}
          </View>

          {/* ── Fruit plans ───────────────────────────────────────────────── */}
          {fruitPlans.length > 0 && (
            <View style={[styles.section, tabletCenter]}>
              <SectionLabel
                label="FRUIT PLANS"
                sub="Seasonal fresh bowls"
                enterDelay={320}
              />
              {fruitPlans[0] && (
                <FruitPlanCard
                  plan={fruitPlans[0]}
                  isSelected={selectedId === fruitPlans[0].id}
                  mealCount={mealCounts[fruitPlans[0].id] ?? fruitPlans[0].total_meals}
                  onSelect={handleSelectPlan}
                  onMealCountChange={(n) => handleMealCountChange(fruitPlans[0].id, n)}
                  enterDelay={380}
                />
              )}
              {fruitPlans.slice(1).map((plan, i) => (
                <StandardPlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedId === plan.id}
                  mealCount={mealCounts[plan.id] ?? plan.total_meals}
                  onSelect={handleSelectPlan}
                  onMealCountChange={(n) => handleMealCountChange(plan.id, n)}
                  enterDelay={460 + i * 80}
                />
              ))}
            </View>
          )}

          {/* ── Delivery Schedule ─────────────────────────────────────────── */}
          <View
            style={tabletCenter}
            onLayout={(e) => { scheduleLayoutY.current = e.nativeEvent.layout.y; }}
          >
            <DeliverySchedule
              selectedDays={selectedDays}
              onToggleDay={toggleDay}
              slots={slots}
              selectedSlotId={selectedSlotId}
              onSelectSlot={setSelectedSlotId}
              enterDelay={460}
            />
          </View>

          {/* ── Trust row ─────────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(540).springify().damping(16)}
            style={[styles.trustRow, tabletCenter]}
          >
            {[
              { icon: "shield-checkmark-outline", text: "Secure Payment" },
              { icon: "infinite-outline", text: "Never Expire" },
              { icon: "flash-outline", text: "Instant Activation" },
            ].map((t) => (
              <View key={t.text} style={styles.trustItem}>
                <Ionicons
                  name={t.icon as never}
                  size={13}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.trustText,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  {t.text}
                </Text>
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      </Animated.View>

      {/* ── Sticky checkout bar ───────────────────────────────────────────── */}
      {selectedPlan && (
        <BottomActionBar>
          <CheckoutFooter
            selectedMealCount={selectedMealCount}
            selectedDaysCount={selectedDays.length}
            totalRs={totalRs}
            canCheckout={canCheckout}
            onCheckout={handleCheckoutPress}
            style={
              isTablet
                ? { maxWidth: maxCardWidth, alignSelf: "center", width: "100%" }
                : undefined
            }
          />
        </BottomActionBar>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { gap: Spacing[5] },

  balancePill: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    flexShrink: 0,
  },
  balanceNum: { fontSize: FontSize.xl, lineHeight: 24 },
  balanceLabel: { fontSize: 10 },

  section: { gap: Spacing[3] },
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing[5],
    flexWrap: "wrap",
  },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustText: { fontSize: FontSize.xs },

});
