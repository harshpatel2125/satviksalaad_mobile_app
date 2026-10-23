import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CheckoutFooterProps {
  selectedMealCount: number;
  selectedDaysCount: number;
  totalRs: number;
  canCheckout: boolean;
  onCheckout: () => void;
  style?: ViewStyle;
}

export function CheckoutFooter({
  selectedMealCount,
  selectedDaysCount,
  totalRs,
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
          {selectedMealCount} meals · {selectedDaysCount}×/week
        </Text>
        <Text
          style={[
            footerStyles.price,
            { color: colors.text, fontFamily: fonts.display },
          ]}
        >
          ₹{totalRs}
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
  },
  leftCol: { gap: 2 },
  detail: { fontSize: FontSize.xs },
  price: { fontSize: FontSize["2xl"], letterSpacing: -0.5 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3.25],
    borderRadius: Radius.full,
  },
  btnText: { fontSize: FontSize.base },
});
