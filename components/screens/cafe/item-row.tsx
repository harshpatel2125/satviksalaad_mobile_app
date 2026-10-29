import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addOnOrderable, itemOrderables, rupees, type CafeItem, type CafeSection } from '@/lib/cafe-order';
import { MarkBadge } from '@/components/screens/cafe/mark-badge';
import { QtyStepper } from '@/components/screens/cafe/qty-stepper';
import type { DietMarks, SetQuantity } from '@/components/screens/cafe/types';

export function ItemRow({
  sectionId,
  item,
  first,
  dietMarks,
  quantities,
  onChange,
  onChooseSize,
}: {
  sectionId: string;
  item: CafeItem;
  first: boolean;
  dietMarks: DietMarks;
  quantities: Record<string, number>;
  onChange: SetQuantity;
  onChooseSize: () => void;
}) {
  const { colors, fonts } = useTheme();
  const orderables = itemOrderables(sectionId, item);
  const sized = orderables.length > 1;
  const inCart = orderables.reduce((sum, orderable) => sum + (quantities[orderable.key] ?? 0), 0);
  const prices = orderables.flatMap((orderable) => (orderable.unitPrice === null ? [] : [orderable.unitPrice]));
  const price = prices.length === 0 ? 'MRP' : sized ? `from ${rupees(Math.min(...prices))}` : rupees(prices[0]);
  const nutrition = [item.kcal && `${item.kcal} kcal`, item.proteinG && `${item.proteinG} g protein`]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[s.itemRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <View style={s.itemInfo}>
        <View style={s.nameRow}>
          <Text style={[s.itemName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{item.name}</Text>
          {item.marks?.map((mark) => <MarkBadge key={mark} mark={mark} dietMarks={dietMarks} />)}
        </View>
        <Text style={[s.price, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          {price}
          {sized ? (
            <Text style={{ color: colors.textMuted, fontFamily: fonts.body }}> · {orderables.length} sizes</Text>
          ) : null}
        </Text>
        {nutrition ? (
          <Text style={[s.nutrition, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>{nutrition}</Text>
        ) : null}
        {item.ingredients ? (
          <Text style={[s.ingredients, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={2}>
            {item.ingredients}
          </Text>
        ) : null}
      </View>
      <View style={s.itemAction}>
        {sized ? (
          <>
            <TouchableOpacity
              onPress={onChooseSize}
              activeOpacity={0.8}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Choose a size of ${item.name}`}
              style={[
                s.addBtn,
                inCart > 0
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surface, borderColor: colors.primary },
              ]}
            >
              <Text
                style={[s.addText, { color: inCart > 0 ? colors.textOnPrimary : colors.primary, fontFamily: fonts.bodyBold }]}
              >
                {inCart > 0 ? `${inCart} ADDED` : 'ADD'}
              </Text>
              <Ionicons name="chevron-down" size={13} color={inCart > 0 ? colors.textOnPrimary : colors.primary} />
            </TouchableOpacity>
            <Text style={[s.actionHint, { color: colors.textMuted, fontFamily: fonts.body }]}>Choose size</Text>
          </>
        ) : (
          <QtyStepper
            label={orderables[0].name}
            quantity={quantities[orderables[0].key] ?? 0}
            onChange={(quantity) => onChange(orderables[0], quantity)}
          />
        )}
      </View>
    </View>
  );
}

export function AddOns({
  section,
  quantities,
  onChange,
}: {
  section: CafeSection;
  quantities: Record<string, number>;
  onChange: SetQuantity;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[s.addOns, { backgroundColor: colors.primaryTint }]}>
      <Text style={[s.addOnsTitle, { color: colors.onPrimaryBg, fontFamily: fonts.bodySemibold }]}>
        ADD-ONS FOR {section.title.toUpperCase()}
      </Text>
      {(section.addOns ?? []).map((addOn) => {
        const orderable = addOnOrderable(section, addOn);
        return (
          <View key={orderable.key} style={s.addOnRow}>
            <Text style={[s.addOnName, { color: colors.text, fontFamily: fonts.body }]}>{addOn.name}</Text>
            <Text style={[s.addOnPrice, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{rupees(addOn.price)}</Text>
            <QtyStepper
              label={orderable.name}
              quantity={quantities[orderable.key] ?? 0}
              onChange={(quantity) => onChange(orderable, quantity)}
            />
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  itemRow: { flexDirection: 'row', gap: Spacing[3], paddingHorizontal: Spacing[3.5], paddingVertical: Spacing[3.5] },
  itemInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  itemName: { flexShrink: 1, fontSize: FontSize.base },
  price: { fontSize: FontSize.sm },
  nutrition: { fontSize: FontSize.xs },
  ingredients: { fontSize: FontSize.xs, lineHeight: FontSize.xs * LineHeight.normal },
  itemAction: { alignItems: 'center', gap: 4, paddingTop: 2 },
  actionHint: { fontSize: 10 },

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
  addOns: { margin: Spacing[2.5], marginTop: 0, borderRadius: Radius.md, padding: Spacing[3], gap: Spacing[2] },
  addOnsTitle: { fontSize: 10.5, letterSpacing: 0.8 },
  addOnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  addOnName: { flex: 1, fontSize: FontSize.sm },
  addOnPrice: { fontSize: FontSize.sm },

});
