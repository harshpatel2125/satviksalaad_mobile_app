import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius, Spacing } from '@/constants/theme';

export function MenuSkeleton() {
  return (
    <View style={s.root}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width="100%" height={220} radius={Radius['2xl']} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: Spacing[5], paddingTop: Spacing[5], paddingHorizontal: Spacing[5], paddingBottom: Spacing[5] },
});
