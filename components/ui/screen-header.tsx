import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A bare arrow: no box or outline, with a generous hit area instead. */
export function BackButton({ onPress, color }: { onPress: () => void; color?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={24}
        color={color ?? colors.text}
      />
    </TouchableOpacity>
  );
}

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** Optional subtitle rendered below the title (e.g. "3 unread"). */
  subtitle?: string;
  /** Optional element shown on the right side (e.g. a date pill). */
  right?: React.ReactNode;
}

export function ScreenHeader({
  title,
  onBack,
  subtitle,
  right,
}: ScreenHeaderProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + (Platform.OS === "android" ? 12 : 0),
          backgroundColor: colors.background,
        },
      ]}
    >
      <BackButton onPress={onBack} />

      <View style={styles.titleWrap}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right != null ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  title: {
    fontSize: FontSize["1.5xl"],
    letterSpacing: -0.4,
  },
  titleWrap: { flex: 1, gap: 1 },
  subtitle: { fontSize: FontSize.xs },
  right: { alignItems: "flex-end", flexShrink: 0 },
});
