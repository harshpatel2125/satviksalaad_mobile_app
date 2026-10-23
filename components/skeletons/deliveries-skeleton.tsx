import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DeliveriesSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.root}>
      <Skeleton width={160} height={34} radius={8} />

      <View style={[s.card, { backgroundColor: colors.primaryTint, borderColor: 'transparent' }]}>
        <View style={s.walletRow}>
          <View style={s.col}>
            <Skeleton width={54} height={11} radius={4} />
            <View style={s.walletCountRow}>
              <Skeleton width={32} height={30} radius={6} />
              <Skeleton width={80} height={14} radius={4} />
            </View>
          </View>
          <Skeleton width={82} height={34} radius={Radius.md} />
        </View>
      </View>

      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.rowBetween}>
          <View style={s.col}>
            <Skeleton width={130} height={11} radius={4} />
            <Skeleton width={130} height={16} radius={4} style={{ marginTop: 6 }} />
            <Skeleton width={200} height={12} radius={4} style={{ marginTop: 5 }} />
          </View>
          <Skeleton width={55} height={22} radius={Radius.md} />
        </View>
      </View>

      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.rowBetween}>
          <View style={s.col}>
            <Skeleton width={200} height={11} radius={4} />
            <Skeleton width={110} height={12} radius={4} style={{ marginTop: 5 }} />
          </View>
          <Skeleton width={34} height={22} radius={Radius.md} />
        </View>
        <View style={s.dayPills}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={36} radius={10} style={{ flex: 1 }} />
          ))}
        </View>
      </View>

      <View style={s.sHead}>
        <Skeleton width={180} height={11} radius={4} />
      </View>

      <View style={[s.rowsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              s.delivRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
            ]}>
            <Skeleton width={44} height={50} radius={10} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="65%" height={14} radius={4} />
              <Skeleton width="45%" height={12} radius={4} />
            </View>
            <Skeleton width={16} height={16} radius={8} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[4] },
  card:          { borderRadius: 16, borderWidth: 1, padding: Spacing[4] },
  walletRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletCountRow:{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  col:           {},
  rowBetween:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayPills:      { flexDirection: 'row', gap: 5, marginTop: 12 },
  sHead:         { marginBottom: Spacing[1] },
  rowsCard:      { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  delivRow:      {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], gap: Spacing[3],
  },
});
