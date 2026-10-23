import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Mirrors the invoice list rows so nothing shifts when data lands; change the two together. */
export function InvoicesSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <Skeleton width={40} height={40} radius={10} />
          <View style={styles.rowLeft}>
            <Skeleton width={132} height={12} radius={3} />
            <Skeleton width="76%" height={14} radius={3} style={{ marginTop: 3 }} />
            <View style={styles.metaRow}>
              <Skeleton width={84} height={11} radius={3} />
              <Skeleton width={52} height={14} radius={999} />
            </View>
          </View>
          <View style={styles.rowRight}>
            <Skeleton width={70} height={15} radius={3} />
            <Skeleton width={14} height={14} radius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: {
    marginHorizontal: Spacing[5],
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  rowLeft: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
});
