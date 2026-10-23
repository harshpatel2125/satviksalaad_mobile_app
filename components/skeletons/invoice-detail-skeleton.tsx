import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Mirrors the invoice detail screen's layout so nothing shifts when data lands; change the two together. */
export function InvoiceDetailSkeleton() {
  const { colors } = useTheme();
  const cardStyle = { backgroundColor: colors.surface, borderColor: colors.border };

  return (
    <View style={styles.root}>
      <View style={[styles.heroCard, cardStyle]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroLeftCol}>
            <Skeleton width={88} height={10} radius={3} />
            <Skeleton width={184} height={20} radius={4} style={{ marginTop: 2 }} />
            <Skeleton width={132} height={12} radius={3} style={{ marginTop: 4 }} />
          </View>
          <Skeleton width={66} height={22} radius={999} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.amountRow}>
          <Skeleton width={44} height={10} radius={3} />
          <Skeleton width={140} height={28} radius={5} />
        </View>
      </View>

      <View style={[styles.partyCard, cardStyle]}>
        <Skeleton width={42} height={10} radius={3} />
        <Skeleton width={172} height={FontSize.md} radius={4} style={{ marginTop: 6, marginBottom: 4 }} />
        <Skeleton width="86%" height={12} radius={3} style={{ marginTop: 6 }} />
        <Skeleton width="68%" height={12} radius={3} style={{ marginTop: 6 }} />
      </View>

      <View style={{ height: Spacing[3] }} />

      <View style={[styles.partyCard, cardStyle]}>
        <Skeleton width={58} height={10} radius={3} />
        <Skeleton width={148} height={FontSize.md} radius={4} style={{ marginTop: 6, marginBottom: 4 }} />
        <Skeleton width="74%" height={12} radius={3} style={{ marginTop: 6 }} />
        <Skeleton width="56%" height={12} radius={3} style={{ marginTop: 6 }} />
      </View>

      <View style={{ height: Spacing[4] }} />

      <View style={[styles.metaCard, cardStyle]}>
        <Skeleton width={120} height={10} radius={3} />
        <Skeleton width={92} height={13} radius={3} />
      </View>

      <View style={{ height: Spacing[4] }} />

      <Skeleton width={48} height={10} radius={3} style={{ marginBottom: 8 }} />

      <View style={[styles.itemsCard, cardStyle]}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.lineItem,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.lineItemLeft}>
              <Skeleton width="74%" height={14} radius={3} />
              <Skeleton width="44%" height={11} radius={3} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={92} height={14} radius={3} />
          </View>
        ))}
      </View>

      <View style={{ height: Spacing[4] }} />

      <View style={[styles.totalsCard, cardStyle]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.totalsRow}>
            <Skeleton width={i === 0 ? 68 : i === 1 ? 88 : 76} height={13} radius={3} />
            <Skeleton width={i === 0 ? 92 : i === 1 ? 76 : 88} height={13} radius={3} />
          </View>
        ))}
        <View style={[styles.totalsDivider, { backgroundColor: colors.border }]} />
        <View style={styles.grandTotalRow}>
          <Skeleton width={102} height={FontSize.md} radius={4} />
          <Skeleton width={132} height={22} radius={5} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
  },

  heroCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing[4],
    marginBottom: Spacing[4],
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLeftCol: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing[3] },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing[3],
  },

  partyCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing[4],
  },

  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },

  itemsCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing[4],
  },
  lineItemLeft: { flex: 1, paddingRight: Spacing[3] },

  totalsCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing[4],
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  totalsDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing[2] },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 4,
  },
});
