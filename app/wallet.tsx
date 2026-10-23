import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { useQuery } from '@tanstack/react-query';

import { BalanceCard } from '@/components/screens/wallet/balance-card';
import { PassCard } from '@/components/screens/wallet/pass-card';
import { StatsStrip } from '@/components/screens/wallet/stats-strip';
import { Skeleton } from "@/components/skeleton";
import { ScreenHeader } from '@/components/ui/screen-header';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth';
import { invoicesApi, walletApi } from '@/lib/api';
import { readWalletCache, writeWalletCache } from '@/lib/home-cache';
import { trackScreenOpened } from '@/lib/analytics';
import { CACHE_TTL } from '@/lib/query-client';
import type { Invoice, PassPurchase } from '@/types/api';

// ─── Skeleton row — exact geometry match of PassCard so the list never reflows ─

function SkeletonPassRow({ colors, index }: { colors: ReturnType<typeof useTheme>['colors']; index: number }) {
  return (
    <View style={[
      s.passRow,
      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    ]}>
      {/* Icon — 36×36, matches PassCard icon */}
      <Skeleton width={36} height={36} radius={8} />
      {/* Info column — gap:2 matches PassCard info gap */}
      <View style={{ flex: 1, gap: 2 }}>
        <Skeleton width={100} height={16} radius={5} />
        <Skeleton width={72} height={13} radius={4} />
      </View>
      {/* Right column — gap:6 and heights match purchaseAmt + badge */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={56} height={19} radius={4} />
        <Skeleton width={48} height={18} radius={9} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { colors, fonts } = useTheme();
  useEffect(() => { trackScreenOpened('wallet'); }, []);
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Synchronous MMKV read before first render (fast path: tab navigation with session already resolved)
  const [cachedWallet, setCachedWallet] = useState<ReturnType<typeof readWalletCache>>(
    () => (userId ? readWalletCache(userId) : null),
  );
  // Deeplink path: userId is null on mount because auth resolves asynchronously.
  // Read cache once as soon as userId becomes available.
  const cacheInitRef = useRef(userId !== null);
  useEffect(() => {
    if (cacheInitRef.current || !userId) return;
    cacheInitRef.current = true;
    const cached = readWalletCache(userId);
    if (cached) setCachedWallet(cached);
  }, [userId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.init,
    staleTime: CACHE_TTL.wallet,
  });
  useQueryFocusRefetch(['wallet']);

  // Read invoices from cache to resolve purchase → invoice_detail navigation
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

  // Write MMKV cache when API responds (for next cold start)
  React.useEffect(() => {
    if (!data || !userId) return;
    writeWalletCache(userId, {
      balance: data.balance
        ? { totalPurchased: data.balance.total_purchased, totalUsed: data.balance.total_used }
        : null,
      purchases: data.purchases,
      stats: data.stats,
    });
  }, [data, userId]);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  async function handleManualRefresh() {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  }

  // Skeleton only on first install — cached data shows immediately on second+ opens
  const showSkeleton = cachedWallet === null && isLoading;

  // Server data takes priority; cache fills in before first API response
  const totalPurchased = data?.balance?.total_purchased ?? cachedWallet?.balance?.totalPurchased ?? 0;
  const totalUsed      = data?.balance?.total_used      ?? cachedWallet?.balance?.totalUsed      ?? 0;
  const remaining      = totalPurchased - totalUsed;
  const progressPct    = totalPurchased > 0 ? Math.min((totalUsed / totalPurchased) * 100, 100) : 0;
  const purchases      = data?.purchases ?? cachedWallet?.purchases ?? [];
  const stats          = data?.stats     ?? cachedWallet?.stats     ?? { delivered: 0, upcoming: 0, skipped: 0 };

  const isEmpty = !showSkeleton && purchases.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Wallet"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing[3], paddingBottom: Spacing[5] },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={() => void handleManualRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.innerContent}>
          {/* Balance card — always rendered; skeleton values swap in on loading */}
          <BalanceCard
            remaining={remaining}
            totalUsed={totalUsed}
            totalPurchased={totalPurchased}
            progressPct={progressPct}
            onBuyPress={() => router.push("/buy-passes")}
            loading={showSkeleton}
          />

          {/* Stats strip — always rendered; skeleton numbers swap in on loading */}
          <StatsStrip
            delivered={stats.delivered}
            upcoming={stats.upcoming}
            skipped={stats.skipped}
            loading={showSkeleton}
          />

          {/* Purchases section — listCard always rendered; content changes between skeleton / empty / data */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sHead,
                { color: colors.primary, fontFamily: fonts.bodySemibold },
              ]}
            >
              PURCHASES
            </Text>

            <View
              style={[
                styles.listCard,
                { backgroundColor: colors.surface, borderWidth: 0 },
                CardEdge,
              ]}
            >
              {showSkeleton ? (
                <SkeletonPassRow colors={colors} index={0} />
              ) : isEmpty ? (
                /* Empty row — same padding/height as a single PassCard so the card stays compact */
                <View style={s.passRow}>
                  <View
                    style={[s.emptyIcon, { backgroundColor: colors.primaryBg }]}
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        styles.emptyTitle,
                        { color: colors.text, fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      No purchases yet
                    </Text>
                    <Text
                      style={[
                        styles.emptyMeta,
                        { color: colors.textMuted, fontFamily: fonts.body },
                      ]}
                    >
                      Your plan history will appear here
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.emptyBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => router.push("/buy-passes")}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.emptyBtnText,
                        { fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      Browse
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                purchases.map((p: PassPurchase, i: number) => {
                  const inv = p.order_id ? invoicesByOrderId.get(p.order_id) : undefined;
                  return (
                  <PassCard
                    key={p.id}
                    purchase={p}
                    index={i}
                    onPress={inv
                      ? () => router.push({ pathname: '/invoice-detail', params: { id: inv.id, invoice_number: inv.invoice_number } })
                      : () => router.push('/invoices')}
                  />
                  );
                })
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.invoiceLink,
              { backgroundColor: colors.surface, borderWidth: 0 },
              CardEdge,
            ]}
            onPress={() => router.push("/invoices")}
            activeOpacity={1}
          >
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text
              style={[
                styles.invoiceLinkText,
                { color: colors.primary, fontFamily: fonts.bodyMedium },
              ]}
            >
              View all invoices
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.primary}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* Shared row geometry — used by SkeletonPassRow and the empty-state row */
const s = StyleSheet.create({
  passRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[4], paddingVertical: 14 },
  emptyIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  innerContent: { gap: Spacing[4] },
  section: { gap: Spacing[2] },

  sHead: { fontSize: 11, letterSpacing: 0.6, marginLeft: 2 },

  listCard: { borderRadius: 16, overflow: "hidden" },

  emptyTitle: { fontSize: FontSize.sm },
  emptyMeta: { fontSize: FontSize.xs },
  emptyBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  emptyBtnText: { fontSize: FontSize.xs, color: "#fff" },

  invoiceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: Spacing[4],
  },
  invoiceLinkText: { fontSize: FontSize.sm },
});
