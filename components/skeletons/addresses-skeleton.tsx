import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AddressesSkeleton() {
  const { colors } = useTheme();
  return (
    <View>
      {[0].map((i) => (
        <View
          key={i}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.topRow}>
            <Skeleton width={32} height={32} radius={Radius.md} />

            <View style={styles.textCol}>
              <Skeleton width={88} height={15} radius={4} />
              <Skeleton width="90%" height={11} radius={4} />
              <Skeleton width="60%" height={11} radius={4} />
            </View>

            <View style={styles.menuIcon} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card:     { borderRadius: Radius.lg, borderWidth: 1, padding: 14, marginBottom: 10 },
  topRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  textCol:  { flex: 1, gap: 4 },
  menuIcon: { width: 18, height: 18 },
});
