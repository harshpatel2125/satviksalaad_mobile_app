import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { DeliveryDayCard } from '@/components/screens/deliveries/delivery-day-card';
import { DeliveryPatternCard, addressLine } from '@/components/screens/deliveries/delivery-pattern-card';
import { deliveryDetailParams, useSubscriptions } from '@/components/screens/subscriptions/subscription-info';
import { DeliveriesSkeleton } from '@/components/skeletons/deliveries-skeleton';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { useTheme } from '@/hooks/use-theme';
import { deliveriesApi, subscriptionsApi } from '@/lib/api';
import { CHANGE_CUTOFFS_NOTE, DEFAULT_DELIVERY_DAYS, istDate } from '@/lib/delivery-rules';
import { readDeliveriesCache, writeDeliveriesCache } from '@/lib/home-cache';
import { CACHE_TTL, queryClient } from '@/lib/query-client';
import {
  categoryInfo,
  formatDay,
  groupByDay,
  namesCategories,
  nextLine,
  runningWithNext,
  subscriptionDetail,
  subscriptionTitle,
  toDayItem,
  type DayItemView,
} from '@/lib/subscription-view';

const FIRST_DAYS = 10;

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default function DeliveriesScreen() {
  const { colors, fonts } = useTheme();
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

  const [showAll, setShowAll] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['deliveries'],
    queryFn: deliveriesApi.init,
    staleTime: CACHE_TTL.deliveries,
  });
  useQueryFocusRefetch(['deliveries']);

  useEffect(() => {
    if (!data?.data || !userId) return;
    writeDeliveriesCache(userId, data.data);
  }, [data, userId]);

  useFocusEffect(
    useCallback(() => {
      const runSync = async () => {
        try {
          const result = await subscriptionsApi.sync();
          if (result.added > 0 || result.removed > 0) {
            await refetch();
            void queryClient.invalidateQueries({ queryKey: ['home'] });
            void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          }
        } catch {}
      };
      void runSync();
    }, [refetch]),
  );

  const { data: subscriptionsData } = useSubscriptions();

  // API data takes priority; cache fills in before first API response
  const initData = data?.data ?? cachedDeliveries ?? undefined;
  const categories = useMemo(() => initData?.categories ?? {}, [initData?.categories]);
  const open = useMemo(() => initData?.subscriptions ?? [], [initData?.subscriptions]);
  const logs = useMemo(() => initData?.logs ?? [], [initData?.logs]);
  const slots = initData?.slots ?? [];
  const addresses = useMemo(() => initData?.addresses ?? [], [initData?.addresses]);
  const schedules = initData?.schedules ?? [];
  const schedule = schedules.find((sc) => sc.is_default) ?? schedules[0] ?? null;
  const hadSubscription = open.length > 0 || (subscriptionsData?.data.length ?? 0) > 0;
  const showCategory = namesCategories(open);

  const today = istDate();
  const tomorrow = addDays(today, 1);
  const days = useMemo(
    () =>
      groupByDay(
        logs.filter((l) => l.delivery_date >= today && l.status !== 'cancelled').map((l) => toDayItem(l, categories)),
        (slug) => categoryInfo(categories, slug).sort_order,
      ),
    [logs, categories, today],
  );
  const shownDays = showAll ? days : days.slice(0, FIRST_DAYS);
  const scheduleAddress = addresses.find((a) => a.id === schedule?.delivery_address_id) ?? null;

  async function handleManualRefresh() {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  }

  async function afterPatternSaved() {
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ['home'] });
    void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  }

  function openItem(item: DayItemView) {
    router.push({
      pathname: '/delivery-detail',
      params: deliveryDetailParams(item, scheduleAddress ? addressLine(scheduleAddress) : undefined),
    });
  }

  const header = (
    <View style={[s.header, column(), { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 0) }]}>
      <Text style={[s.pageTitle, { color: colors.text, fontFamily: fonts.display }]}>Deliveries</Text>
    </View>
  );

  // Skeleton only on the very first open; later opens render the cached copy at once.
  if (cachedDeliveries === null && isLoading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {header}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[column(), { paddingTop: Spacing[3], paddingBottom: Spacing[5] }]}>
          <DeliveriesSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (isError && !initData) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {header}
        <View style={s.errorWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 12 }} />
          <Text style={[s.errorTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{"Couldn't load deliveries"}</Text>
          <Text style={[s.errorText, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {error instanceof Error ? error.message : 'Failed to load deliveries'}
          </Text>
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => void refetch()} activeOpacity={0.85}>
            <Text style={[s.primaryBtnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const lines = runningWithNext(open);
  const current = initData?.subscription ?? null;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[column(), s.content, { paddingTop: Spacing[3], paddingBottom: Spacing[5] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isManualRefreshing} onRefresh={() => void handleManualRefresh()} tintColor={colors.primary} />
        }
      >
        {initData?.deliveriesPaused ? (
          <View style={[s.notice, { backgroundColor: colors.warningBg }]}>
            <Ionicons name="pause-circle-outline" size={20} color={colors.warning} />
            <Text style={[s.noticeText, { color: colors.text, fontFamily: fonts.body }]}>
              {current
                ? `Your deliveries are paused. Message us to start them again; your ${current.plan.name} can run until ${formatDay(current.last_allowed_on)} at the latest.`
                : 'Your deliveries are paused. Message us to start them again.'}
            </Text>
          </View>
        ) : null}

        {lines.length === 0 && days.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.surface }, CardEdge]}>
            <View style={[s.emptyIcon, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="bag-handle-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.display }]}>
              {hadSubscription ? 'Your subscription has ended' : 'No subscription yet'}
            </Text>
            <Text style={[s.emptyText, { color: colors.textMuted, fontFamily: fonts.body }]}>
              Pick a plan and get fresh bowls on the days you choose.
            </Text>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/plans')} activeOpacity={0.85}>
              <Text style={[s.primaryBtnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                {hadSubscription ? 'Renew' : 'Choose a plan'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {lines.map(({ sub, next }) => (
              <TouchableOpacity
                key={sub.id}
                style={[s.line, { backgroundColor: colors.primaryTint }]}
                onPress={() => router.push('/subscriptions')}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <View style={s.lineText}>
                  <Text style={[s.lineTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                    {subscriptionTitle(sub, showCategory ? categoryInfo(categories, sub.category).name : null)}
                  </Text>
                  <Text style={[s.lineDetail, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    {subscriptionDetail(sub, today)}
                  </Text>
                  {next ? (
                    <Text style={[s.lineNext, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>{nextLine(next)}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}

            {schedule ? (
              <DeliveryPatternCard
                scheduleId={schedule.id}
                days={schedule.preferred_days?.length ? schedule.preferred_days : [...DEFAULT_DELIVERY_DAYS]}
                slot={schedule.delivery_slot || slots[0]?.id || 'noon'}
                addressId={schedule.delivery_address_id ?? null}
                slots={slots}
                addresses={addresses}
                onSaved={afterPatternSaved}
              />
            ) : null}

            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.display }]}>Coming up</Text>
              <Text style={[s.sectionNote, { color: colors.textMuted, fontFamily: fonts.body }]}>{CHANGE_CUTOFFS_NOTE}</Text>
            </View>
            {shownDays.length === 0 ? (
              <View style={[s.emptyCard, { backgroundColor: colors.surface }, CardEdge]}>
                <Text style={[s.emptyText, { color: colors.textMuted, fontFamily: fonts.body }]}>Nothing coming up right now.</Text>
              </View>
            ) : (
              shownDays.map((day) => (
                <DeliveryDayCard
                  key={day.date}
                  date={day.date}
                  items={day.items}
                  slots={slots}
                  today={today}
                  tomorrow={tomorrow}
                  showCategory={showCategory}
                  onOpenItem={openItem}
                />
              ))
            )}
            {!showAll && days.length > FIRST_DAYS ? (
              <TouchableOpacity
                style={[s.moreBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowAll(true)}
                activeOpacity={0.8}
              >
                <Text style={[s.moreText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                  {`Show ${days.length - FIRST_DAYS} more ${days.length - FIRST_DAYS === 1 ? 'day' : 'days'}`}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/delivery-history')} activeOpacity={0.7}>
              <Text style={[s.moreText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Past deliveries →</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  header: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3] },
  pageTitle: { fontSize: FontSize['1.5xl'], letterSpacing: -0.5 },

  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], borderRadius: 16, padding: Spacing[4] },
  noticeText: { flex: 1, fontSize: FontSize.base, lineHeight: 20 },

  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderRadius: 16, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], minHeight: 56 },
  lineText: { flex: 1, gap: 2 },
  lineTitle: { fontSize: FontSize.md },
  lineDetail: { fontSize: FontSize.base },
  lineNext: { fontSize: FontSize.sm },

  section: { gap: 2, marginTop: Spacing[2] },
  sectionTitle: { fontSize: FontSize.lg },
  sectionNote: { fontSize: FontSize.sm, lineHeight: 19 },

  emptyCard: { borderRadius: 16, padding: Spacing[5], alignItems: 'center', gap: Spacing[2] },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[1] },
  emptyTitle: { fontSize: FontSize.lg, textAlign: 'center' },
  emptyText: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },

  primaryBtn: { minHeight: 48, paddingHorizontal: Spacing[6], borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: Spacing[2] },
  primaryBtnText: { fontSize: FontSize.md },
  moreBtn: { minHeight: 48, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: FontSize.base },
  linkBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[6] },
  errorTitle: { fontSize: FontSize.md, textAlign: 'center', marginBottom: 6 },
  errorText: { fontSize: FontSize.base, textAlign: 'center', marginBottom: 20 },
});
