import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface StatsStripProps {
  delivered: number;
  upcoming: number;
  skipped: number;
  loading?: boolean;
}

function StatCard({
  value,
  label,
  numColor,
  bg,
  loading,
}: {
  value: number;
  label: string;
  numColor: string;
  bg: string;
  loading: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[s.card, { backgroundColor: bg }]}>
      {/* Fixed-height slot — skeleton matches the number height exactly, no layout shift */}
      <View style={s.numSlot}>
        {loading ? (
          <Skeleton width={36} height={32} radius={6} />
        ) : (
          <Text style={[s.num, { color: numColor, fontFamily: fonts.display }]}>
            {value}
          </Text>
        )}
      </View>
      <Text style={[s.label, { color: colors.textMuted, fontFamily: fonts.body }]}>
        {label}
      </Text>
    </View>
  );
}

export function StatsStrip({ delivered, upcoming, skipped, loading = false }: StatsStripProps) {
  const { colors } = useTheme();

  return (
    <View style={s.row}>
      <StatCard
        value={delivered}
        label="Delivered"
        numColor={colors.success}
        bg={colors.successBg}
        loading={loading}
      />
      <StatCard
        value={upcoming}
        label="Upcoming"
        numColor={colors.primary}
        bg={colors.primaryBg}
        loading={loading}
      />
      <StatCard
        value={skipped}
        label="Skipped"
        numColor={colors.textMuted}
        bg={colors.surface2}
        loading={loading}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
    gap: 6,
  },
  /* Fixed height prevents layout shift between skeleton and real number */
  numSlot: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  num: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: FontSize.xs,
    letterSpacing: 0.1,
  },
});
