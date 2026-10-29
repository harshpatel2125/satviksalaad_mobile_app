import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { column, SHEET_WIDTH } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { itemOrderables, rupees, type CafeItem } from '@/lib/cafe-order';
import { MarkBadge } from '@/components/screens/cafe/mark-badge';
import { QtyStepper } from '@/components/screens/cafe/qty-stepper';
import type { DietMarks, SetQuantity } from '@/components/screens/cafe/types';

/** Picks the size of an item sold in sizes before it goes into the order. */
export function SizeSheet({
  choice,
  dietMarks,
  quantities,
  onChange,
  onClose,
}: {
  choice: { sectionId: string; item: CafeItem } | null;
  dietMarks: DietMarks;
  quantities: Record<string, number>;
  onChange: SetQuantity;
  onClose: () => void;
}) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const orderables = choice ? itemOrderables(choice.sectionId, choice.item) : [];

  return (
    <Modal visible={!!choice} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {choice ? (
        <View style={[s.sizeSheet, column(SHEET_WIDTH), { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing[4] }]}>
          <View style={[s.grabber, { backgroundColor: colors.border }]} />
          <View style={s.nameRow}>
            <Text style={[s.sizeTitle, { color: colors.text, fontFamily: fonts.display }]}>{choice.item.name}</Text>
            {choice.item.marks?.map((mark) => <MarkBadge key={mark} mark={mark} dietMarks={dietMarks} />)}
          </View>
          {choice.item.ingredients ? (
            <Text style={[s.ingredients, { color: colors.textMuted, fontFamily: fonts.body }]}>{choice.item.ingredients}</Text>
          ) : null}
          <Text style={[s.sizeLabel, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>CHOOSE A SIZE</Text>
          {orderables.map((orderable) => (
            <View key={orderable.key} style={[s.sizeRow, { borderColor: colors.border }]}>
              <Text style={[s.sizeName, { color: colors.text, fontFamily: fonts.bodyMedium }]}>{orderable.variant}</Text>
              <Text style={[s.sizePrice, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                {orderable.unitPrice === null ? 'MRP' : rupees(orderable.unitPrice)}
              </Text>
              <QtyStepper
                label={orderable.name}
                quantity={quantities[orderable.key] ?? 0}
                onChange={(quantity) => onChange(orderable, quantity)}
              />
            </View>
          ))}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[s.doneBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[s.doneText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Modal>
  );
}

const s = StyleSheet.create({
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  ingredients: { fontSize: FontSize.xs, lineHeight: FontSize.xs * LineHeight.normal },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sizeSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing[5],
    gap: Spacing[2],
  },
  sizeTitle: { fontSize: FontSize.xl, flexShrink: 1 },
  sizeLabel: { fontSize: 11, letterSpacing: 0.8, marginTop: Spacing[2] },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2.5],
  },
  sizeName: { flex: 1, fontSize: FontSize.base },
  sizePrice: { fontSize: FontSize.base },
  doneBtn: { height: 46, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: Spacing[2] },
  doneText: { fontSize: FontSize.base },

  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: Spacing[2] },
});
