import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { EmptyState } from '@/components/ui/empty-state';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';

import { DeliveryHistorySkeleton } from '@/components/skeletons/delivery-history-skeleton';
import { Skeleton } from '@/components/skeleton';
import { FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { optimizedImageSource } from '@/lib/image-url';
import { deliveryHistoryApi } from '@/lib/api';
import { trackScreenOpened } from '@/lib/analytics';
import { readDeliveryHistoryCache, writeDeliveryHistoryCache } from '@/lib/home-cache';
import { slotTime, useSlots } from '@/lib/slots';
import { useAuth } from '@/context/auth';
import type { DeliveryHistoryLog } from '@/types/api';
import { bowlFor } from '@/components/screens/deliveries/delivery-row';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryLog = DeliveryHistoryLog;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function monthKey(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ─── Status config ────────────────────────────────────────────────────────────

function statusStyle(status: string, colors: ReturnType<typeof useTheme>['colors']) {
  switch (status) {
    case 'delivered':        return { bg: colors.successBg, fg: colors.success,     icon: 'checkmark-circle' as const,    label: 'Delivered' };
    case 'missed':           return { bg: colors.errorBg,   fg: colors.error,       icon: 'close-circle' as const,        label: 'Missed' };
    case 'skipped':          return { bg: colors.warningBg, fg: colors.warning,     icon: 'remove-circle-outline' as const, label: 'Skipped' };
    case 'out_for_delivery': return { bg: colors.blueBg,    fg: colors.blue,        icon: 'bicycle' as const,             label: 'On route' };
    default:                 return { bg: colors.surface2,  fg: colors.textMuted,   icon: 'time-outline' as const,        label: 'Scheduled' };
  }
}

// ─── MealThumb ────────────────────────────────────────────────────────────────

function MealThumb({ imageUrl }: { imageUrl: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[styles.thumb, { overflow: 'hidden' }]}>
      <Image
        source={optimizedImageSource(imageUrl) ?? require('@/assets/images/hero-image.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <Skeleton width={48} height={48} radius={10} style={{ position: 'absolute', top: 0, left: 0 }} />
      )}
    </View>
  );
}

const HISTORY_BOWL = bowlFor(null);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DeliveryHistoryScreen() {
  const { colors, fonts } = useTheme();
  const slots = useSlots();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Synchronous MMKV read — shows cached history instantly on second+ opens
  const [logs, setLogs] = useState<HistoryLog[]>(() => {
    if (!userId) return [];
    return readDeliveryHistoryCache(userId)?.logs ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (!userId) return true;
    return readDeliveryHistoryCache(userId) === null;
  });
  // Deeplink path: userId is null on mount; populate from cache once when auth resolves.
  const cacheInitRef = useRef(userId !== null);
  useEffect(() => {
    if (cacheInitRef.current || !userId) return;
    cacheInitRef.current = true;
    const cached = readDeliveryHistoryCache(userId);
    if (!cached) return;
    setLogs(cached.logs);
    setLoading(false);
  }, [userId]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'delivered' | 'skipped' | 'missed'>('all');

  const load = useCallback(async () => {
    try {
      const res = await deliveryHistoryApi.list();
      const newLogs = res.data?.logs ?? [];
      setLogs(newLogs);
      if (userId) writeDeliveryHistoryCache(userId, { logs: newLogs });
    } catch {
      // keep previous state on error
    }
  }, [userId]);

  useEffect(() => { trackScreenOpened('delivery_history'); }, []);
  useEffect(() => { void load().finally(() => setLoading(false)); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Stats
  const delivered = logs.filter(l => l.status === 'delivered').length;
  const skipped   = logs.filter(l => l.status === 'skipped').length;
  const missed    = logs.filter(l => l.status === 'missed').length;

  // Filtered + grouped by month
  const filtered = logs.filter(l =>
    filter === 'all' ? l.status !== 'scheduled' && l.status !== 'out_for_delivery' : l.status === filter
  );

  const grouped: { month: string; entries: HistoryLog[] }[] = [];
  for (const log of filtered) {
    const m = monthKey(log.delivery_date);
    const last = grouped[grouped.length - 1];
    if (last?.month === m) {
      last.entries.push(log);
    } else {
      grouped.push({ month: m, entries: [log] });
    }
  }

  const FILTERS: { key: typeof filter; label: string; count: number }[] = [
    { key: 'all',       label: 'All',       count: delivered + skipped + missed },
    { key: 'delivered', label: 'Delivered', count: delivered },
    { key: 'skipped',   label: 'Skipped',   count: skipped },
    { key: 'missed',    label: 'Missed',    count: missed },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Delivery History" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing[4], paddingBottom: insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats strip */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.primaryTint, borderColor: "transparent" },
            Shadows.sm,
          ]}
        >
          {[
            { label: "Delivered", value: delivered, color: colors.success },
            { label: "Skipped", value: skipped, color: colors.warning },
            { label: "Missed", value: missed, color: colors.error },
          ].map(({ label, value, color }, i, arr) => (
            <View
              key={label}
              style={[
                styles.statItem,
                i < arr.length - 1 && {
                  borderRightWidth: StyleSheet.hairlineWidth,
                  borderRightColor: colors.primary + "33",
                },
              ]}
            >
              <Text
                style={[styles.statNum, { color, fontFamily: fonts.display }]}
              >
                {value}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: active ? "#fff" : colors.textMuted,
                      fontFamily: fonts.bodyMedium,
                    },
                  ]}
                >
                  {f.label}
                </Text>
                <Text
                  style={[
                    styles.filterChipCount,
                    {
                      color: active
                        ? "rgba(255,255,255,0.8)"
                        : colors.textMuted,
                      fontFamily: fonts.body,
                    },
                  ]}
                >
                  {f.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Loading */}
        {loading && (
          <Animated.View exiting={FadeOut.duration(200)}>
            <DeliveryHistorySkeleton />
          </Animated.View>
        )}

        {/* Empty + Grouped list */}
        {!loading && (
          <Animated.View entering={FadeIn.duration(350).withInitialValues({ transform: [{ translateY: 8 }] })}>
            {filtered.length === 0 && (
              <EmptyState
                icon="time-outline"
                title={`No ${filter === "all" ? "" : `${filter} `}deliveries yet`}
              />
            )}

            {grouped.map(({ month, entries }) => (
              <View key={month}>
                <Text
                  style={[
                    styles.monthHead,
                    { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                  ]}
                >
                  {month.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.listCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {entries.map((log, i) => {
                    const meal = HISTORY_BOWL;
                    const s = statusStyle(log.status, colors);
                    return (
                      <TouchableOpacity
                        key={log.id}
                        activeOpacity={0.7}
                        onPress={() =>
                          router.push({
                            pathname: "/delivery-detail",
                            params: {
                              id: log.id,
                              date: log.delivery_date,
                              slot: log.delivery_slot,
                              status: log.status,
                              quantity: String(log.quantity ?? 1),
                              mealName: meal.name,
                              mealImageUrl: meal.image_url ?? "",
                            },
                          })
                        }
                        style={[
                          styles.row,
                          i > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        {/* Meal image */}
                        <View style={log.status !== "delivered" ? { opacity: 0.5 } : undefined}>
                          <MealThumb imageUrl={meal.image_url} />
                        </View>

                        {/* Info */}
                        <View style={styles.info}>
                          <Text
                            style={[
                              styles.mealName,
                              {
                                color: colors.text,
                                fontFamily: fonts.bodySemibold,
                              },
                            ]}
                          >
                            {meal.name}
                          </Text>
                          <Text
                            style={[
                              styles.dateText,
                              {
                                color: colors.textMuted,
                                fontFamily: fonts.body,
                              },
                            ]}
                          >
                            {formatDate(log.delivery_date)}
                          </Text>
                          <Text
                            style={[
                              styles.slotText,
                              {
                                color: colors.textMuted,
                                fontFamily: fonts.body,
                              },
                            ]}
                          >
                            {slotTime(log.delivery_slot, slots)}
                          </Text>
                        </View>

                        {/* Status */}
                        <View style={styles.right}>
                          <View
                            style={[styles.badge, { backgroundColor: s.bg }]}
                          >
                            <Ionicons name={s.icon} size={12} color={s.fg} />
                            <Text
                              style={[
                                styles.badgeText,
                                { color: s.fg, fontFamily: fonts.bodySemibold },
                              ]}
                            >
                              {s.label}
                            </Text>
                          </View>
                          {log.quantity > 1 && (
                            <Text
                              style={[
                                styles.qty,
                                {
                                  color: colors.textMuted,
                                  fontFamily: fonts.body,
                                },
                              ]}
                            >
                              ×{log.quantity}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { paddingHorizontal: Spacing[4], gap: Spacing[4] },

  // Stats
  statsCard: { borderRadius: 16, borderWidth: 1, padding: Spacing[4], flexDirection: 'row' },
  statItem:  { flex: 1, alignItems: 'center', gap: 2 },
  statNum:   { fontSize: FontSize['2xl'], fontWeight: FontWeight.semibold },
  statLabel: { fontSize: FontSize.xs },

  // Filters
  filterRow: { gap: Spacing[2], paddingHorizontal: 2 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1,
  },
  filterChipText:  { fontSize: FontSize.sm },
  filterChipCount: { fontSize: 11 },

  // Empty

  // Month group
  monthHead: { fontSize: 11, letterSpacing: 0.6, marginBottom: Spacing[1], marginLeft: 2 },
  listCard:  { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[4], paddingVertical: 14,
  },
  thumb:    { width: 48, height: 48, borderRadius: 10, flexShrink: 0 },
  info:     { flex: 1, gap: 2 },
  mealName: { fontSize: FontSize.sm },
  dateText: { fontSize: FontSize.xs },
  slotText: { fontSize: FontSize.xs },
  right:    { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full,
  },
  badgeText:   { fontSize: 11 },
  qty:         { fontSize: 11 },
});
