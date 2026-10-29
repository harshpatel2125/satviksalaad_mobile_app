import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontSize, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_QUANTITY } from '@/lib/cafe-order';

export function QtyStepper({ label, quantity, onChange }: { label: string; quantity: number; onChange: (quantity: number) => void }) {
  const { colors, fonts } = useTheme();

  if (quantity === 0) {
    return (
      <TouchableOpacity
        onPress={() => onChange(1)}
        activeOpacity={0.8}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        style={[s.addBtn, { backgroundColor: colors.surface, borderColor: colors.primary }]}
      >
        <Text style={[s.addText, { color: colors.primary, fontFamily: fonts.bodyBold }]}>ADD</Text>
        <Ionicons name="add" size={14} color={colors.primary} />
      </TouchableOpacity>
    );
  }

  const atMax = quantity >= MAX_QUANTITY;
  return (
    <View style={[s.stepper, { backgroundColor: colors.primary }]}>
      <TouchableOpacity
        onPress={() => onChange(quantity - 1)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`One less ${label}`}
        style={s.stepBtn}
      >
        <Ionicons name="remove" size={15} color={colors.textOnPrimary} />
      </TouchableOpacity>
      <Text style={[s.stepQty, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>{quantity}</Text>
      <TouchableOpacity
        onPress={() => onChange(quantity + 1)}
        disabled={atMax}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`One more ${label}`}
        accessibilityState={{ disabled: atMax }}
        style={[s.stepBtn, atMax && s.dimmed]}
      >
        <Ionicons name="add" size={15} color={colors.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 86,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  addText: { fontSize: FontSize.sm, letterSpacing: 0.4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 86,
    height: 34,
    borderRadius: Radius.md,
  },
  stepBtn: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepQty: { minWidth: 18, textAlign: 'center', fontSize: FontSize.sm },
  dimmed: { opacity: 0.4 },

});
