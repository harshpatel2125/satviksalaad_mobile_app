import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Vegan, Jain, Gluten free and other tags as small pills. */
export function DietBadges({ labels }: { labels: readonly string[] | undefined }) {
  const { colors, fonts } = useTheme();
  if (!labels?.length) return null;

  const tone = (label: string) => {
    if (label === 'Vegan') return { bg: colors.primaryBg, fg: colors.onPrimaryBg };
    if (label === 'Jain') return { bg: colors.accentBg, fg: colors.text };
    return { bg: colors.surface2, fg: colors.text };
  };

  return (
    <View style={s.row} accessibilityLabel={`Dietary information: ${labels.join(', ')}`}>
      {labels.map((label) => {
        const { bg, fg } = tone(label);
        return (
          <View key={label} style={[s.pill, { backgroundColor: bg }]}>
            <Text style={[s.text, { color: fg, fontFamily: fonts.bodySemibold }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 10.5, letterSpacing: 0.2 },
});
