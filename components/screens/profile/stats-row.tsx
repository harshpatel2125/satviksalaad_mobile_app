import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StatTile {
  value: number | string;
  label: string;
  onPress?: () => void;
}

/** A row of compact figures; tiles share the width equally. */
export function StatsRow({ tiles, loading = false }: { tiles: StatTile[]; loading?: boolean }) {
  const { colors, fonts } = useTheme();

  return (
    <View style={s.row}>
      {tiles.map((tile) => (
        <TouchableOpacity
          key={tile.label}
          onPress={tile.onPress}
          disabled={!tile.onPress}
          activeOpacity={0.75}
          style={[s.tile, CardEdge, { backgroundColor: colors.surface }]}
        >
          <View style={s.valueSlot}>
            {loading ? (
              <Skeleton width={34} height={24} radius={6} />
            ) : (
              <Text style={[s.value, { color: colors.primary, fontFamily: fonts.display }]}>{tile.value}</Text>
            )}
          </View>
          <Text style={[s.label, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>
            {tile.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row:       { flexDirection: 'row', gap: Spacing[2.5] },
  tile:      { flex: 1, borderRadius: Radius.xl, paddingVertical: Spacing[3.5], alignItems: 'center', gap: 2 },
  valueSlot: { height: 30, justifyContent: 'center' },
  value:     { fontSize: FontSize['2xl'] },
  label:     { fontSize: FontSize.xs },
});
