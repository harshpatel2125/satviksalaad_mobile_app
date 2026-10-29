import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CheckoutFooterProps {
  /** "6 bowls" in the plan's own unit words. */
  count: string;
  selectedDaysCount: number;
  totalRs: number;
  /** "+ 5% GST" when GST is added at checkout. */
  gstNote?: string | null;
  canCheckout: boolean;
  onCheckout: () => void;
  style?: ViewStyle;
}

export function CheckoutFooter({
  count,
  selectedDaysCount,
  totalRs,
  gstNote,
  canCheckout,
  onCheckout,
  style,
}: CheckoutFooterProps) {
  const { colors, fonts } = useTheme();

  return (
    <View style={[footerStyles.inner, style]}>
      <View style={footerStyles.leftCol}>
        <Text
          style={[
            footerStyles.detail,
            { color: colors.textMuted, fontFamily: fonts.body },
          ]}
        >
          {count} · {selectedDaysCount}×/week
        </Text>
        <Text
          style={[
            footerStyles.price,
            { color: colors.text, fontFamily: fonts.display },
          ]}
        >
          ₹{totalRs.toLocaleString('en-IN')}
          {gstNote ? (
            <Text style={[footerStyles.detail, { color: colors.textMuted, fontFamily: fonts.body }]}> {gstNote}</Text>
          ) : null}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          footerStyles.btn,
          { backgroundColor: canCheckout ? colors.primary : colors.surface2 },
        ]}
        onPress={onCheckout}
        disabled={!canCheckout}
        activeOpacity={0.85}
      >
        <Text
          style={[
            footerStyles.btnText,
            {
              fontFamily: fonts.bodySemibold,
              color: canCheckout ? "#fff" : colors.textMuted,
            },
          ]}
        >
          Review Order
        </Text>
        <Ionicons
          name="arrow-forward"
          size={16}
          color={canCheckout ? "#fff" : colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing[3],
  },
  leftCol: { gap: 2, flexShrink: 1 },
  detail: { fontSize: FontSize.xs },
  price: { fontSize: FontSize["2xl"], letterSpacing: -0.5 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3.25],
    minHeight: 48,
    borderRadius: Radius.full,
  },
  btnText: { fontSize: FontSize.base },
});
