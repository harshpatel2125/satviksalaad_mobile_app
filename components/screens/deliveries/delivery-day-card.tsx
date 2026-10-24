import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { canChangeDelivery } from '@/lib/delivery-rules';
import { optimizedImageSource } from '@/lib/image-url';
import { slotLabel } from '@/lib/slots';
import { changesClosedText, countOf, dayActions, formatDay, unitIcon, type DayItemView } from '@/lib/subscription-view';
import type { TimeSlot } from '@/types/api';

import { useSkip } from './use-skip';

const UNIT_ICONS = { bowl: 'bowl-mix-outline', cup: 'cup-outline', leaf: 'leaf' } as const;

/** The item's photo, else its category's, else a bowl, a cup or a leaf by the word it counts in. */
export function ItemThumb({ item, size = 48 }: { item: Pick<DayItemView, 'image_url' | 'categoryImageUrl' | 'unit'>; size?: number }) {
  const { colors } = useTheme();
  const source = optimizedImageSource(item.image_url ?? item.categoryImageUrl);
  const box = { width: size, height: size, borderRadius: Radius.md, backgroundColor: colors.primaryBg };
  if (source) {
    return <Image source={source} style={box} contentFit="cover" cachePolicy="memory-disk" transition={150} />;
  }
  return (
    <View style={[box, s.thumbIcon]}>
      <MaterialCommunityIcons name={UNIT_ICONS[unitIcon(item.unit.singular)]} size={size / 2} color={colors.primary} />
    </View>
  );
}

interface DeliveryDayCardProps {
  date: string;
  items: DayItemView[];
  slots: TimeSlot[];
  today: string;
  tomorrow: string;
  /** Name each item's category; for a customer with more than one. */
  showCategory: boolean;
  onOpenItem: (item: DayItemView) => void;
}

/**
 * One delivery day: every item in it, one big button to skip or bring back the
 * whole day, and a small button per item only when the day has several.
 */
export function DeliveryDayCard({ date, items, slots, today, tomorrow, showCategory, onOpenItem }: DeliveryDayCardProps) {
  const { colors, fonts } = useTheme();
  const { busy, run } = useSkip();
  const actions = dayActions(items);
  const oneSlot = new Set(items.map((i) => i.delivery_slot)).size === 1;
  const relative = date === today ? 'Today' : date === tomorrow ? 'Tomorrow' : null;

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
      <View style={s.head}>
        <Text style={[s.date, { color: colors.text, fontFamily: fonts.display }]}>
          {formatDay(date)}
          {relative ? <Text style={[s.relative, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>{`  ${relative}`}</Text> : null}
        </Text>
        {oneSlot ? (
          <Text style={[s.slot, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {slotLabel(items[0].delivery_slot, slots)}
          </Text>
        ) : null}
      </View>

      {items.map((item, i) => {
        const open = canChangeDelivery(item.delivery_date, item.delivery_slot);
        const canSkip = actions.perItem && open && item.status === 'scheduled';
        const canUndo = actions.perItem && open && item.status === 'skipped';
        const skipped = item.status === 'skipped';
        const meta = [
          showCategory ? item.categoryName : null,
          countOf(item.quantity, item.unit),
          oneSlot ? null : slotLabel(item.delivery_slot, slots),
        ].filter(Boolean);
        return (
          <View
            key={item.id}
            style={[s.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
          >
            <TouchableOpacity
              style={s.itemMain}
              onPress={() => onOpenItem(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${meta.join(', ')}`}
            >
              <ItemThumb item={item} />
              <View style={s.itemText}>
                <Text
                  style={[
                    s.itemName,
                    {
                      color: skipped ? colors.textMuted : colors.text,
                      fontFamily: fonts.bodySemibold,
                      textDecorationLine: skipped ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={[s.itemMeta, { color: colors.textMuted, fontFamily: fonts.body }]}>{meta.join(' · ')}</Text>
                {item.status !== 'scheduled' ? (
                  <View style={s.pillRow}>
                    <StatusPill status={item.status} />
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
            {canSkip || canUndo ? (
              <TouchableOpacity
                style={[
                  s.itemBtn,
                  canSkip
                    ? { borderColor: colors.border, backgroundColor: colors.surface }
                    : { borderColor: colors.warning, backgroundColor: colors.warningBg },
                ]}
                onPress={() => void run(item.id, { action: canSkip ? 'skip' : 'unskip', logId: item.id })}
                disabled={busy !== null}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={canSkip ? `Skip ${item.name}` : `Bring back ${item.name}`}
              >
                {busy === item.id ? (
                  <ActivityIndicator size="small" color={canSkip ? colors.text : colors.warning} />
                ) : (
                  <Text style={[s.itemBtnText, { color: canSkip ? colors.text : colors.warning, fontFamily: fonts.bodySemibold }]}>
                    {canSkip ? 'Skip' : 'Undo'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      {actions.canSkipDay ? (
        <TouchableOpacity
          style={[s.dayBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
          onPress={() => void run('day', { action: 'skip', date })}
          disabled={busy !== null}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {busy === 'day' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="close-circle-outline" size={20} color={colors.primary} />
          )}
          <Text style={[s.dayBtnText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Skip this day</Text>
        </TouchableOpacity>
      ) : null}
      {actions.canUndoDay ? (
        <TouchableOpacity
          style={[s.dayBtn, { borderColor: colors.warning, backgroundColor: colors.warningBg }]}
          onPress={() => void run('day', { action: 'unskip', date })}
          disabled={busy !== null}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {busy === 'day' ? (
            <ActivityIndicator size="small" color={colors.warning} />
          ) : (
            <Ionicons name="arrow-undo-outline" size={20} color={colors.warning} />
          )}
          <Text style={[s.dayBtnText, { color: colors.warning, fontFamily: fonts.bodySemibold }]}>Undo skip</Text>
        </TouchableOpacity>
      ) : null}
      {actions.closedSlot ? (
        <View style={s.closed}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={s.closedIcon} />
          <Text style={[s.closedText, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {changesClosedText(actions.closedSlot)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing[4] },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: Spacing[3], rowGap: 2 },
  date: { fontSize: FontSize.lg },
  relative: { fontSize: FontSize.sm },
  slot: { fontSize: FontSize.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[2.5] },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing[3], minHeight: 48 },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: FontSize.md },
  itemMeta: { fontSize: FontSize.sm },
  pillRow: { flexDirection: 'row', marginTop: 2 },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  itemBtn: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBtnText: { fontSize: FontSize.base },
  dayBtn: {
    marginTop: Spacing[3],
    minHeight: 48,
    paddingVertical: Spacing[2.5],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.full,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  dayBtnText: { fontSize: FontSize.md },
  closed: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2], marginTop: Spacing[3] },
  closedIcon: { marginTop: 2 },
  closedText: { flex: 1, fontSize: FontSize.sm, lineHeight: 19 },
});
