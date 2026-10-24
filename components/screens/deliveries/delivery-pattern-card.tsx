import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { errorText } from '@/components/screens/subscriptions/subscription-info';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/alert';
import { useTheme } from '@/hooks/use-theme';
import { trackDeliverySlotUpdated, trackPreferredDaysUpdated } from '@/lib/analytics';
import { ApiError, schedulesApi } from '@/lib/api';
import { CHANGE_CUTOFFS_NOTE, DELIVERY_DAYS, SUNDAY_DELIVERY_NOTE } from '@/lib/delivery-rules';
import { formatTimeRange, slotLabel } from '@/lib/slots';
import { daysText, formatDay } from '@/lib/subscription-view';
import type { DeliveryAddress, TimeSlot } from '@/types/api';

function addressLabel(a: DeliveryAddress): string {
  return a.label || a.area || 'Address';
}

export function addressLine(a: DeliveryAddress): string {
  return [a.full_address, a.area, a.city, a.pincode].filter(Boolean).join(', ');
}

const sameDays = (a: readonly string[], b: readonly string[]) => [...a].sort().join() === [...b].sort().join();

interface DeliveryPatternCardProps {
  scheduleId: string;
  days: string[];
  slot: string;
  addressId: string | null;
  slots: TimeSlot[];
  addresses: DeliveryAddress[];
  /** Runs after a change was saved, to load the deliveries it moved. */
  onSaved: () => Promise<unknown>;
}

/**
 * The customer's delivery days, time and address, shared by every
 * subscription, shown in plain words and changed in one place.
 */
export function DeliveryPatternCard({ scheduleId, days, slot, addressId, slots, addresses, onSaved }: DeliveryPatternCardProps) {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<{ text: string; offerHelp: boolean } | null>(null);
  const [draftDays, setDraftDays] = React.useState(days);
  const [draftSlot, setDraftSlot] = React.useState(slot);
  const [draftAddress, setDraftAddress] = React.useState(addressId);

  const address = addresses.find((a) => a.id === addressId) ?? null;
  const dirty = !sameDays(draftDays, days) || draftSlot !== slot || draftAddress !== addressId;

  function startEditing() {
    setDraftDays(days);
    setDraftSlot(slot);
    setDraftAddress(addressId);
    setError(null);
    setEditing(true);
  }

  function toggleDay(day: string) {
    setError(null);
    setDraftDays((current) =>
      current.includes(day) ? (current.length > 1 ? current.filter((d) => d !== day) : current) : [...current, day],
    );
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const body: Parameters<typeof schedulesApi.update>[1] = {};
    if (!sameDays(draftDays, days)) body.preferred_days = DELIVERY_DAYS.filter((d) => draftDays.includes(d));
    if (draftSlot !== slot) body.delivery_slot = draftSlot;
    if (draftAddress !== addressId) body.delivery_address_id = draftAddress;
    try {
      const res = await schedulesApi.update(scheduleId, body);
      if (body.preferred_days) trackPreferredDaysUpdated(body.preferred_days);
      if (body.delivery_slot) trackDeliverySlotUpdated(body.delivery_slot);
      await onSaved();
      setEditing(false);
      showAlert(
        'Saved',
        res.applies_from ? `Your deliveries follow this from ${formatDay(res.applies_from)}.` : 'Your changes are saved.',
      );
    } catch (err) {
      setError({
        text: errorText(err, 'Could not save your changes. Please try again.'),
        offerHelp: err instanceof ApiError && err.code === 'past_last_date',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const rows: { icon: React.ComponentProps<typeof Ionicons>['name']; main: string; sub?: string }[] = [
      { icon: 'calendar-outline', main: daysText(days) },
      { icon: 'time-outline', main: slotLabel(slot, slots) },
      address
        ? { icon: 'location-outline', main: addressLabel(address), sub: addressLine(address) }
        : { icon: 'location-outline', main: 'No address chosen yet' },
    ];
    return (
      <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
        <View style={s.head}>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>Your days, time and address</Text>
          <TouchableOpacity
            style={[s.changeBtn, { borderColor: colors.border }]}
            onPress={startEditing}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Change your days, time or address"
          >
            <Text style={[s.changeText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Change</Text>
          </TouchableOpacity>
        </View>
        {rows.map((row) => (
          <View key={row.icon} style={s.row}>
            <Ionicons name={row.icon} size={18} color={colors.primary} style={s.rowIcon} />
            <View style={s.rowText}>
              <Text style={[s.rowMain, { color: colors.text, fontFamily: fonts.bodyMedium }]}>{row.main}</Text>
              {row.sub ? <Text style={[s.rowSub, { color: colors.textMuted, fontFamily: fonts.body }]}>{row.sub}</Text> : null}
            </View>
          </View>
        ))}
        <Text style={[s.note, { color: colors.textMuted, fontFamily: fonts.body }]}>
          These apply to everything you get from us.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.card, s.editing, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
      <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>Change your days, time or address</Text>

      <Text style={[s.label, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Days</Text>
      <View style={s.grid}>
        {DELIVERY_DAYS.map((day) => {
          const on = draftDays.includes(day);
          return (
            <TouchableOpacity
              key={day}
              style={[s.dayChip, on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface2, borderColor: colors.border }]}
              onPress={() => toggleDay(day)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={day}
            >
              <Text style={[s.chipText, { color: on ? colors.textOnPrimary : colors.text, fontFamily: fonts.bodySemibold }]}>
                {day.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {draftDays.includes('Sunday') ? (
        <Text style={[s.note, { color: colors.textMuted, fontFamily: fonts.body }]}>{SUNDAY_DELIVERY_NOTE}</Text>
      ) : null}

      <Text style={[s.label, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Time</Text>
      <View style={s.grid}>
        {slots.map((option) => {
          const on = draftSlot === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[s.slotChip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryBg : colors.surface }]}
              onPress={() => {
                setError(null);
                setDraftSlot(option.id);
              }}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.slotName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                {`${option.icon ? `${option.icon} ` : ''}${option.label}`}
              </Text>
              <Text style={[s.rowSub, { color: colors.textMuted, fontFamily: fonts.body }]}>{formatTimeRange(option.time_range)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.label, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Address</Text>
      <View style={s.addresses}>
        {addresses.map((a) => {
          const on = draftAddress === a.id;
          return (
            <TouchableOpacity
              key={a.id}
              style={[s.addressOption, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryBg : colors.surface }]}
              onPress={() => {
                setError(null);
                setDraftAddress(a.id);
              }}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <View style={s.rowText}>
                <Text style={[s.rowMain, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{addressLabel(a)}</Text>
                <Text style={[s.rowSub, { color: colors.textMuted, fontFamily: fonts.body }]}>{addressLine(a)}</Text>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/addresses')} activeOpacity={0.7} accessibilityRole="link">
          <Text style={[s.changeText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Add or edit addresses →</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.note, { color: colors.textMuted, fontFamily: fonts.body }]}>
        Changes start from the first day that can still change. {CHANGE_CUTOFFS_NOTE}
      </Text>
      {error ? (
        <View style={[s.error, { backgroundColor: colors.errorBg }]}>
          <Text style={[s.errorText, { color: colors.error, fontFamily: fonts.body }]}>{error.text}</Text>
          {error.offerHelp ? (
            <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/support')} activeOpacity={0.7}>
              <Text style={[s.changeText, { color: colors.error, fontFamily: fonts.bodySemibold }]}>Message us →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
          onPress={() => setEditing(false)}
          disabled={saving}
          activeOpacity={0.75}
        >
          <Text style={[s.actionText, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: dirty ? colors.primary : colors.surface2 }]}
          onPress={() => void save()}
          disabled={!dirty || saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : null}
          <Text style={[s.actionText, { color: dirty ? colors.textOnPrimary : colors.textMuted, fontFamily: fonts.bodySemibold }]}>
            Save changes
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing[4], gap: Spacing[2] },
  editing: { borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing[3] },
  title: { flex: 1, fontSize: FontSize.md },
  changeBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: { fontSize: FontSize.base },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2.5] },
  rowIcon: { marginTop: 1 },
  rowText: { flex: 1, gap: 1 },
  rowMain: { fontSize: FontSize.base },
  rowSub: { fontSize: FontSize.sm },
  note: { fontSize: FontSize.sm, lineHeight: 19 },
  label: { fontSize: FontSize.base, marginTop: Spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  dayChip: {
    minWidth: 64,
    minHeight: 44,
    flexGrow: 1,
    paddingHorizontal: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: FontSize.base },
  slotChip: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 56,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  slotName: { fontSize: FontSize.md },
  addresses: { gap: Spacing[2] },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    minHeight: 48,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2.5],
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  error: { borderRadius: Radius.md, padding: Spacing[3], gap: Spacing[1] },
  errorText: { fontSize: FontSize.base, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[2] },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  actionText: { fontSize: FontSize.md },
});
