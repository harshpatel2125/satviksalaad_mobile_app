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
import { CheckoutFooter } from '@/components/screens/plans/checkout-footer';
import {
  DeliverySchedule,
  SectionLabel,
} from '@/components/screens/plans/delivery-schedule';
import {
  FruitPlanCard,
  HeroPlanCard,
  planBadge,
  StandardPlanCard,
} from '@/components/screens/plans/plan-card';
import { useSubscriptions } from '@/components/screens/subscriptions/subscription-info';
import { PlansSkeleton } from '@/components/skeletons/plans-skeleton';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { homeApi, plansApi, slotsApi } from '@/lib/api';
import { trackPlanSelected, trackScreenOpened } from '@/lib/analytics';
import { readPlansCache, readSlotsCache, writePlansCache, writeSlotsCache } from '@/lib/home-cache';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import type { Plan, TimeSlot } from '@/types/api';
import { DEFAULT_DELIVERY_DAYS } from '@/lib/delivery-rules';
import { categoryInfo, countOf, formatDay } from '@/lib/subscription-view';

/** The launch offer leads, then the largest plans, as on the website. */
function inShowOrder(plans: Plan[]): Plan[] {
  return [...plans].sort(
    (a, b) =>
      Number(planBadge(b)?.tone === 'gold') - Number(planBadge(a)?.tone === 'gold') ||
      b.bowls_count - a.bowls_count,
  );
}

const TABLET_BREAKPOINT = 768;

const TRUST_ITEMS = [
  { icon: "shield-checkmark-outline", text: "Secure payment" },
  { icon: "calendar-outline", text: "Skipped bowls move to the end" },
  { icon: "refresh-outline", text: "Nothing renews by itself" },
] as const;

export default function PlansScreen() {
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
  const [selectedDays, setSelectedDays] = useState<string[]>([...DEFAULT_DELIVERY_DAYS]);
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
  const { data: subscriptionsData } = useSubscriptions();
  const { data: homeData } = useQuery({
    queryKey: ['home'],
    queryFn: homeApi.critical,
    staleTime: CACHE_TTL.home,
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
  const subscriptions = useMemo(() => subscriptionsData?.data ?? [], [subscriptionsData]);
  const categories = useMemo(
    () => subscriptionsData?.meta.categories ?? homeData?.data.categories ?? {},
    [subscriptionsData, homeData],
  );
  const open = useMemo(
    () => subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'upcoming'),
    [subscriptions],
  );
  // Days, time and address are shared by every subscription, so a customer
  // already holding one keeps them for the next.
  const keptSchedule = open.length > 0 ? homeData?.data.schedule ?? null : null;
  const days = keptSchedule?.preferred_days?.length ? keptSchedule.preferred_days : selectedDays;
  const slot = keptSchedule?.delivery_slot ?? selectedSlotId;

  // Skeleton only on first install — cached data shows immediately on 2nd+ opens
  const isLoading = (plansLoading || slotsLoading) && cachedPlans === null && cachedSlots === null;

  const unavailableReason = React.useCallback(
    (plan: Plan): string | null => {
      if (plan.is_trial && subscriptionsData?.meta.trial_used_by_category?.[plan.category]) {
        return "You've already had the trial";
      }
      const waiting = open.find((sub) => sub.status === 'upcoming' && sub.category === plan.category);
      return waiting ? `Your next one is booked: ${waiting.plan.name} from ${formatDay(waiting.starts_on)}` : null;
    },
    [subscriptionsData, open],
  );

  useEffect(() => {
    if (isLoading || didInit.current || !allPlans.length) return;
    didInit.current = true;

    setSelectedSlotId(slots[0]?.id ?? 'noon');

    const choosable = allPlans.filter((p) => !unavailableReason(p));
    const usualCategory = subscriptions[0]?.category ?? choosable[0]?.category;
    const sameKind = choosable.filter((p) => p.category === usualCategory);
    const defaultPlan = sameKind.find((p) => p.is_popular) ?? sameKind[0] ?? choosable[0];
    const requestedPlan = choosable.find((p) => p.id === requestedPlanId || p.slug === requestedPlanId);
    setSelectedId(requestedPlan?.id ?? defaultPlan?.id ?? null);
  }, [isLoading, allPlans, slots, subscriptions, requestedPlanId, unavailableReason]);

  useEffect(() => { trackScreenOpened('plans'); }, []);

  // The trial can turn out to be used once subscriptions load after it was picked.
  const selectedPlan = allPlans.find((p) => p.id === selectedId && !unavailableReason(p));

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
        days: days.join(','),
        slot,
      },
    });
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

  const groups = useMemo(() => {
    const keys = [...new Set(allPlans.map((p) => p.category))].sort(
      (a, b) => categoryInfo(categories, a).sort_order - categoryInfo(categories, b).sort_order || a.localeCompare(b),
    );
    return keys.map((key) => ({
      key,
      name: allPlans.find((p) => p.category === key)?.category_name || categoryInfo(categories, key).name,
      plans: inShowOrder(allPlans.filter((p) => p.category === key)),
    }));
  }, [allPlans, categories]);

  const canCheckout   = !!selectedPlan && days.length > 0;
  const contentPadding = isTablet ? Spacing[8] : Spacing[5];
  const maxCardWidth   = isTablet ? Math.min(width - contentPadding * 2, 640) : undefined;
  const tabletCenter: object | undefined = isTablet
    ? { maxWidth: maxCardWidth, alignSelf: 'center' as const, width: '100%' as const }
    : undefined;

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <PlansSkeleton />
      </View>
    );
  }

  // What the customer already holds, told for the category of the plan in view.
  const focusCategory = allPlans.find((p) => p.id === selectedId)?.category ?? groups[0]?.key ?? null;
  const waiting = open.find((sub) => sub.status === 'upcoming' && sub.category === focusCategory) ?? null;
  const current = open.find((sub) => sub.status === 'active' && sub.category === focusCategory) ?? null;
  const alongside = open.filter((sub) => sub.status === 'active' && sub.category !== focusCategory);
  const notice = waiting
    ? {
        icon: "time-outline" as const,
        text: `Your ${waiting.plan.name} already starts on ${formatDay(waiting.starts_on)}. You can buy your next subscription once it has started.`,
        bg: colors.warningBg,
        fg: colors.text,
      }
    : current
      ? {
          icon: "refresh-outline" as const,
          text: `Your ${current.plan.name} has ${countOf(current.bowls_left, current.unit)} left, valid till ${formatDay(current.ends_on)}. The plan you choose now starts after it.`,
          bg: colors.primaryTint,
          fg: colors.primaryDark,
        }
      : alongside.length > 0
        ? {
            icon: "add-circle-outline" as const,
            text: `This starts alongside your ${alongside.map((sub) => categoryInfo(categories, sub.category).name).join(' and ')}, on the same days, time and address.`,
            bg: colors.primaryTint,
            fg: colors.primaryDark,
          }
        : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Choose your plan" onBack={() => router.back()} />
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
          {notice ? (
            <View style={[styles.notice, { backgroundColor: notice.bg }, tabletCenter]}>
              <Ionicons name={notice.icon} size={18} color={notice.fg} />
              <Text style={[styles.noticeText, { color: notice.fg, fontFamily: fonts.body }]}>
                {notice.text}
              </Text>
            </View>
          ) : null}

          {groups.map((group, gi) => {
            const delay = 60 + gi * 260;
            const lead = group.key === 'fruit' ? null : group.plans.find((p) => p.is_popular) ?? (gi === 0 ? group.plans[0] : null);
            return (
              <View key={group.key} style={[styles.section, tabletCenter]}>
                <SectionLabel
                  label={group.name.toUpperCase()}
                  sub={`${group.plans.length} ${group.plans.length === 1 ? 'plan' : 'plans'}`}
                  enterDelay={delay}
                />
                {group.plans.map((plan, i) => {
                  const props = {
                    plan,
                    isSelected: selectedPlan?.id === plan.id,
                    onSelect: handleSelectPlan,
                    unavailable: unavailableReason(plan),
                    enterDelay: delay + 60 + i * 80,
                  };
                  if (plan === lead) return <HeroPlanCard key={plan.id} {...props} />;
                  if (group.key === 'fruit' && i === 0) return <FruitPlanCard key={plan.id} {...props} />;
                  return <StandardPlanCard key={plan.id} {...props} />;
                })}
              </View>
            );
          })}

          {/* ── Delivery Schedule ─────────────────────────────────────────── */}
          <View
            style={tabletCenter}
            onLayout={(e) => { scheduleLayoutY.current = e.nativeEvent.layout.y; }}
          >
            <DeliverySchedule
              selectedDays={days}
              onToggleDay={toggleDay}
              slots={slots}
              selectedSlotId={slot}
              onSelectSlot={setSelectedSlotId}
              readOnly={!!keptSchedule}
              enterDelay={460}
            />
          </View>

          {/* ── Trust row ─────────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(540).springify().damping(16)}
            style={[styles.trustRow, tabletCenter]}
          >
            {TRUST_ITEMS.map((t) => (
              <View key={t.text} style={styles.trustItem}>
                <Ionicons name={t.icon} size={13} color={colors.primary} />
                <Text style={[styles.trustText, { color: colors.textMuted, fontFamily: fonts.body }]}>
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
            count={countOf(selectedPlan.bowls_count, selectedPlan.unit)}
            selectedDaysCount={days.length}
            totalRs={Math.round(selectedPlan.price_paise / 100)}
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { gap: Spacing[5] },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.lg,
  },
  noticeText: { flex: 1, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.5 },

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
