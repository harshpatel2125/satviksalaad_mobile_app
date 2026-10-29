import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import type { DietMark } from '@/lib/cafe-order';
import type { DietMarks } from '@/components/screens/cafe/types';

export function MarkBadge({ mark, dietMarks }: { mark: DietMark; dietMarks: DietMarks }) {
  const { colors, fonts } = useTheme();
  const info = dietMarks[mark];
  if (!info) return null;
  return (
    <View accessible accessibilityLabel={info.label} style={[s.badge, { backgroundColor: colors.primaryBg }]}>
      <Text style={[s.badgeText, { color: colors.onPrimaryBg, fontFamily: fonts.bodyBold }]}>{info.letter}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 9.5, lineHeight: 12 },
});
