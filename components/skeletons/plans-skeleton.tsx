import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function PlansSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + Spacing[3] },
      ]}
    >
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Skeleton width={40} height={40} radius={Radius.md} />
        <View style={styles.titleCol}>
          <Skeleton width={170} height={22} radius={6} />
          <Skeleton width={140} height={11} radius={4} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* ── Salad plans section ───────────────────────────────────────────── */}
      <View style={styles.section}>
        {/* Section label row */}
        <View style={styles.sectionLabelRow}>
          <Skeleton width={100} height={11} radius={4} />
          <Skeleton width={44} height={11} radius={4} />
        </View>

        {/* Hero plan card (large green card) */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* badges row */}
          <View style={styles.heroBadgesRow}>
            <Skeleton width={82} height={24} radius={Radius.full} />
            <Skeleton width={70} height={24} radius={Radius.full} />
          </View>
          {/* Plan name */}
          <Skeleton width="65%" height={32} radius={6} style={{ marginTop: Spacing[2] }} />
          {/* Description */}
          <Skeleton width="90%" height={11} radius={4} style={{ marginTop: 10 }} />
          <Skeleton width="70%" height={11} radius={4} style={{ marginTop: 5 }} />
          {/* Price */}
          <View style={styles.heroPriceRow}>
            <Skeleton width={100} height={44} radius={8} />
            <View style={styles.heroPriceRight}>
              <Skeleton width={36} height={11} radius={4} />
              <Skeleton width={60} height={13} radius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
          {/* Features grid (2×2) */}
          <View style={styles.featuresGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.featureItem}>
                <Skeleton width={18} height={18} radius={9} />
                <Skeleton width={80} height={11} radius={4} />
              </View>
            ))}
          </View>
          {/* Bottom row: bowl count pill */}
          <Skeleton width={110} height={32} radius={Radius.full} style={{ marginTop: Spacing[3] }} />
        </View>

        {/* Standard plan cards */}
        {[0, 1].map((i) => (
          <View key={i} style={[styles.stdCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Skeleton width={22} height={22} radius={11} />
            <View style={styles.stdInfo}>
              <Skeleton width="55%" height={15} radius={4} />
              <Skeleton width="72%" height={11} radius={4} style={{ marginTop: 5 }} />
              <Skeleton width="50%" height={11} radius={4} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.stdPrice}>
              <Skeleton width={52} height={22} radius={4} />
              <Skeleton width={28} height={10} radius={3} style={{ marginTop: 3 }} />
            </View>
          </View>
        ))}
      </View>

      {/* ── Delivery schedule card ─────────────────────────────────────────── */}
      <View style={[styles.schedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Card header */}
        <View style={styles.schedHeader}>
          <Skeleton width={34} height={34} radius={Radius.md} />
          <Skeleton width={130} height={15} radius={4} />
        </View>

        {/* Days block */}
        <View style={styles.schedBlock}>
          <Skeleton width={100} height={11} radius={4} />
          <View style={styles.daysRow}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} height={36} radius={Radius.md} style={{ flex: 1 }} />
            ))}
          </View>
          <Skeleton width="80%" height={11} radius={4} />
        </View>

        {/* Divider */}
        <View style={[styles.schedDivider, { backgroundColor: colors.border }]} />

        {/* Slot block */}
        <View style={styles.schedBlock}>
          <Skeleton width={100} height={11} radius={4} />
          <View style={styles.slotsRow}>
            <Skeleton height={52} radius={Radius.md} style={{ flex: 1 }} />
            <Skeleton height={52} radius={Radius.md} style={{ flex: 1 }} />
          </View>
          <Skeleton width="60%" height={11} radius={4} />
        </View>
      </View>

      {/* ── Trust row ──────────────────────────────────────────────────────── */}
      <View style={styles.trustRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.trustItem}>
            <Skeleton width={13} height={13} radius={7} />
            <Skeleton width={68} height={11} radius={4} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing[5],
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[6],
  },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  titleCol:  { flex: 1 },

  // Section
  section:        { gap: Spacing[3] },
  sectionLabelRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Hero card
  heroCard: {
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    padding: Spacing[5],
    overflow: 'hidden',
  },
  heroBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[3],
    marginTop: Spacing[4],
    marginBottom: Spacing[4],
  },
  heroPriceRight: { gap: 2, paddingBottom: 4 },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginBottom: Spacing[2],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '47%',
  },

  // Standard plan card
  stdCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    padding: Spacing[4],
  },
  stdInfo:  { flex: 1 },
  stdPrice: { alignItems: 'flex-end', flexShrink: 0 },

  // Delivery schedule card
  schedCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  schedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
    paddingBottom: Spacing[3],
  },
  schedBlock: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    gap: Spacing[2],
  },
  schedDivider: { height: 1, marginHorizontal: Spacing[4], marginBottom: Spacing[3] },
  daysRow:  { flexDirection: 'row', gap: Spacing[2] },
  slotsRow: { flexDirection: 'row', gap: Spacing[2] },

  // Trust row
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[5],
    flexWrap: 'wrap',
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
