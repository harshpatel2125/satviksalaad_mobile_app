import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';

export function VideosSkeleton() {
  return (
    <View style={s.root}>
      <Skeleton width="100%" height={200} radius={Radius['2xl']} />
      {[0, 1].map((i) => (
        <View key={i} style={s.card}>
          <Skeleton width="100%" height={180} radius={Radius.xl} />
          <Skeleton width={70} height={10} radius={4} />
          <Skeleton width="85%" height={16} radius={4} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: Spacing[5], paddingTop: Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[5] },
  card: { gap: 8 },
});
