import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DeliveriesSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={s.root}>
      <View style={[s.card, { backgroundColor: colors.primaryTint, borderColor: 'transparent' }]}>
        <Skeleton width={140} height={16} radius={4} />
        <Skeleton width={220} height={14} radius={4} style={{ marginTop: 6 }} />
      </View>

      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.rowBetween}>
          <Skeleton width={190} height={18} radius={4} />
          <Skeleton width={84} height={44} radius={Radius.md} />
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.line}>
            <Skeleton width={18} height={18} radius={9} />
            <Skeleton width={i === 2 ? '70%' : '50%'} height={14} radius={4} />
          </View>
        ))}
      </View>

      <Skeleton width={120} height={20} radius={4} style={{ marginTop: Spacing[2] }} />

      {[0, 1].map((day) => (
        <View key={day} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width={110} height={18} radius={4} />
          <View style={s.item}>
            <Skeleton width={48} height={48} radius={Radius.md} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={15} radius={4} />
              <Skeleton width="40%" height={13} radius={4} />
            </View>
          </View>
          <Skeleton width="100%" height={48} radius={Radius.full} style={{ marginTop: Spacing[3] }} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing[4] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2.5], marginTop: Spacing[2.5] },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginTop: Spacing[3] },
});
