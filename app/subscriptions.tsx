import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useQuery } from '@tanstack/react-query';

import {
  NoSubscriptionCard,
  NoteCard,
  SubscriptionCard,
} from '@/components/screens/subscriptions/current-subscription-card';
import { StatsStrip } from '@/components/screens/subscriptions/stats-strip';
import { useSubscriptions } from '@/components/screens/subscriptions/subscription-info';
import { SubscriptionRow } from '@/components/screens/subscriptions/subscription-row';
import { Skeleton } from '@/components/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth';
import { invoicesApi } from '@/lib/api';
import { istDate } from '@/lib/delivery-rules';
import { readSubscriptionsCache, writeSubscriptionsCache } from '@/lib/home-cache';
import { trackScreenOpened } from '@/lib/analytics';
import { CACHE_TTL } from '@/lib/query-client';
import { categoryInfo, namesCategories, renewPlanSlug, runningWithNext, skipRuleText, subscriptionTitle } from '@/lib/subscription-view';
import type { Invoice, Subscription } from '@/types/api';

// Same geometry as SubscriptionRow so the list never reflows when data arrives.
function SkeletonRow() {
  return (
    <View style={s.row}>
      <Skeleton width={36} height={36} radius={18} />
      <View style={{ flex: 1, gap: 4 }}>
        <Skeleton width={120} height={16} radius={5} />
        <Skeleton width={180} height={13} radius={4} />
        <Skeleton width={64} height={18} radius={9} />
      </View>
    </View>
  );
}

export default function SubscriptionsScreen() {
  const { colors, fonts } = useTheme();
  useEffect(() => { trackScreenOpened('subscriptions'); }, []);
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [cached, setCached] = useState<ReturnType<typeof readSubscriptionsCache>>(
    () => (userId ? readSubscriptionsCache(userId) : null),
  );
  // A deep link mounts this before auth resolves, so the cache is read once the user is known.
  const cacheInitRef = useRef(userId !== null);
  useEffect(() => {
    if (cacheInitRef.current || !userId) return;
    cacheInitRef.current = true;
    const fromCache = readSubscriptionsCache(userId);
    if (fromCache) setCached(fromCache);
  }, [userId]);

  const { data, isLoading, refetch } = useSubscriptions();
  useQueryFocusRefetch(['subscriptions']);

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesApi.list,
    staleTime: CACHE_TTL.invoices,
  });
  const invoicesByOrderId = React.useMemo(() => {
    const map = new Map<string, Invoice>();
    for (const inv of invoicesData?.data ?? []) {
      if (inv.order_id) map.set(inv.order_id, inv);
    }
    return map;
  }, [invoicesData]);

  useEffect(() => {
    if (!data || !userId) return;
    writeSubscriptionsCache(userId, { data: data.data, meta: data.meta });
  }, [data, userId]);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  async function handleManualRefresh() {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  }

  const today = istDate();
  const showSkeleton = cached === null && isLoading;
  const subs = data?.data ?? cached?.data ?? [];
  const meta = data?.meta ?? cached?.meta ?? null;
  const categories = meta?.categories ?? {};
  const open = subs.filter((sub) => sub.status === 'active' || sub.status === 'upcoming');
  const lines = runningWithNext(open);
  // Newest first, so the first ended one of a category is its latest.
  const history = subs.filter((sub) => sub.status !== 'active' && sub.status !== 'upcoming');
  const several = namesCategories(subs);
  const title = (sub: Subscription) =>
    subscriptionTitle(sub, several ? categoryInfo(categories, sub.category).name : null);
  const covered = (category: string) => open.some((sub) => sub.category === category);
  const latestEnded = (sub: Subscription) => history.find((h) => h.category === sub.category)?.id === sub.id;
  const skipRule = skipRuleText(open);

  function renew(sub: Subscription | null) {
    const slug = sub ? renewPlanSlug(sub) : null;
    router.push(slug ? { pathname: '/plans', params: { planId: slug } } : '/plans');
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={lines.length > 1 ? 'My subscriptions' : 'My subscription'}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[column(), styles.content, { paddingTop: Spacing[3], paddingBottom: Spacing[5] }]}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={() => void handleManualRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        {showSkeleton || lines.length === 0 ? (
          <NoSubscriptionCard
            lastEnded={history[0] ?? null}
            onRenew={() => renew(history[0] ?? null)}
            loading={showSkeleton}
          />
        ) : (
          lines.map(({ sub, next }) => (
            <SubscriptionCard
              key={sub.id}
              sub={sub}
              title={title(sub)}
              next={next}
              today={today}
              onRenew={() => renew(sub)}
              onDeliveries={() => router.navigate('/(tabs)/deliveries')}
            />
          ))
        )}

        {lines.length > 0 && skipRule ? <NoteCard text={skipRule} /> : null}

        {showSkeleton || subs.length > 0 ? (
          <StatsStrip
            delivered={subs.reduce((n, sub) => n + sub.bowls_delivered, 0)}
            scheduled={open.reduce((n, sub) => n + sub.bowls_scheduled, 0)}
            skipped={subs.reduce((n, sub) => n + sub.days_skipped, 0)}
            loading={showSkeleton}
          />
        ) : null}

        {showSkeleton || history.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sHead, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
              EARLIER SUBSCRIPTIONS
            </Text>
            <View style={[styles.listCard, { backgroundColor: colors.surface }, CardEdge]}>
              {showSkeleton ? (
                <SkeletonRow />
              ) : (
                history.map((sub, i) => {
                  const inv = sub.order_id ? invoicesByOrderId.get(sub.order_id) : undefined;
                  return (
                    <SubscriptionRow
                      key={sub.id}
                      subscription={sub}
                      title={title(sub)}
                      today={today}
                      index={i}
                      onPress={
                        inv
                          ? () => router.push({ pathname: '/invoice-detail', params: { id: inv.id, invoice_number: inv.invoice_number } })
                          : () => router.push('/invoices')
                      }
                      onRenew={!covered(sub.category) && latestEnded(sub) ? () => renew(sub) : undefined}
                    />
                  );
                })
              )}
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.invoiceLink, { backgroundColor: colors.surface }, CardEdge]}
          onPress={() => router.push('/invoices')}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.primary} />
          <Text style={[styles.invoiceLinkText, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
            View all invoices
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[4], paddingVertical: Spacing[3] },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4] },
  section: { gap: Spacing[2] },
  sHead: { fontSize: FontSize.xs, letterSpacing: 0.6, marginLeft: 2 },
  listCard: { borderRadius: 16, overflow: 'hidden' },
  invoiceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderRadius: Radius.md,
    minHeight: 48,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  invoiceLinkText: { fontSize: FontSize.base },
});
