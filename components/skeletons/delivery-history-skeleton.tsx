import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DeliveryHistorySkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      {/* List card with 4 rows */}
      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}
          >
            <Skeleton width={48} height={48} radius={10} />
            <View style={styles.textCol}>
              <Skeleton width="55%" height={13} radius={4} />
              <Skeleton width="40%" height={11} radius={4} style={{ marginTop: 5 }} />
              <Skeleton width="35%" height={11} radius={4} style={{ marginTop: 4 }} />
            </View>
            <Skeleton width={66} height={22} radius={Radius.full} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { gap: Spacing[2] },
  listCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[4], paddingVertical: 14 },
  textCol:  { flex: 1, gap: 0 },
});
