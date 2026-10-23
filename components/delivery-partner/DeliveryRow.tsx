import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { StatusPill } from '@/components/ui/status-pill';
import { useAlert } from '@/context/alert';
import { CardEdge, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deliveryPartnerApi } from '@/lib/api';
import { callNumber, openMap } from '@/lib/contact-actions';
import { slotColor, slotLabelPlain, useSlots } from '@/lib/slots';
import type { PartnerDeliveryItem } from '@/types/delivery-partner';

interface DeliveryRowProps {
  item: PartnerDeliveryItem;
  dietaryLabelByKey: ReadonlyMap<string, string>;
  /** Re-reads the list quietly once the server has the change. */
  onStatusChanged: () => void;
  /** Shows a status on this card straight away, before the server answers. */
  onStatusApplied: (id: string, status: string) => void;
  /** Collapses the row to the customer name and up/down arrows. */
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function DeliveryRow({
  item,
  dietaryLabelByKey,
  onStatusChanged,
  onStatusApplied,
  reorderMode = false,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: DeliveryRowProps) {
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const slots = useSlots();

  const [busy, setBusy] = useState(false);
  const [showRemark, setShowRemark] = useState(false);
  const [remark, setRemark] = useState('');

  const name = item.profiles?.full_name ?? (item.visible_to_partner ? 'Unknown customer' : "Another partner's delivery");

  if (reorderMode) {
    return (
      <View
        style={[
          styles.row,
          styles.reorderRow,
          { backgroundColor: colors.surface, borderWidth: 0 },
          CardEdge,
          Shadows.xs,
        ]}
      >
        <Text
          style={[styles.name, styles.reorderName, { color: colors.text, fontFamily: fonts.bodySemibold }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={styles.reorderArrows}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onMoveUp}
            disabled={!canMoveUp}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.arrowBtn, { backgroundColor: colors.surface2 }]}
          >
            <Ionicons name="chevron-up" size={18} color={canMoveUp ? colors.text : colors.textDisabled} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onMoveDown}
            disabled={!canMoveDown}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.arrowBtn, { backgroundColor: colors.surface2 }]}
          >
            <Ionicons name="chevron-down" size={18} color={canMoveDown ? colors.text : colors.textDisabled} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const phone = item.profiles?.phone ?? null;
  const address = item.profiles?.delivery_addresses?.full_address ?? item.area;
  // A pinned link, then coordinates, then a search on the address text, so
  // navigation works even for addresses nobody pinned.
  const gmapUrl = item.profiles?.delivery_addresses?.gmap_url ?? null;
  const lat = item.profiles?.delivery_addresses?.lat ?? null;
  const lng = item.profiles?.delivery_addresses?.lng ?? null;
  const canNavigate = !!gmapUrl || (lat !== null && lng !== null) || !!address;
  const isFutureStop = item.delivery_date > new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { fg: slotFg, bg: slotBg } = slotColor(item.delivery_slot, colors);

  // A customer with no dietary flags still gets an explicit "Regular" pill, so
  // an empty line is never ambiguous.
  const dietaryLabels = item.dietary_preferences.map((key) => dietaryLabelByKey.get(key) ?? key);
  // Today's note for this delivery often carries rider instructions (gate
  // codes, "call before arriving"), so it leads the line.
  const todaysNote = item.kitchen_note?.trim() || null;
  const hasCookingNote =
    dietaryLabels.length > 0 || !!item.special_instructions || !!todaysNote;
  const cookingNoteText = hasCookingNote
    ? [todaysNote, ...dietaryLabels, item.special_instructions].filter(Boolean).join(' · ')
    : 'Regular';

  async function callCustomer() {
    if (!phone) return;
    if (!(await callNumber(phone))) {
      showAlert('Unable to call', 'Your device could not open the dialer.');
    }
  }

  async function navigateToStop() {
    if (!(await openMap({ gmapUrl, lat, lng, address, label: name }))) {
      showAlert('Unable to open maps', 'Your device could not open a maps app.');
    }
  }

  // The 403 means the stop was reassigned after the list loaded.
  function handleStatusUpdateError(err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'This delivery is not visible to you') {
      showAlert(
        'No longer assigned to you',
        'This delivery was just reassigned to another partner or zone. Refreshing your list.',
      );
      onStatusChanged();
      return;
    }
    // The server's message says what changed (skipped, cancelled).
    showAlert('Not updated', message || 'Could not update this delivery. Try again.');
    onStatusChanged();
  }

  // The card moves on the moment the rider taps; the buttons stay locked until
  // the server answers, so a second tap cannot race the first. A refusal puts
  // the card back and says why.
  async function markOutForDelivery() {
    if (busy) return;
    const before = item.status;
    setBusy(true);
    onStatusApplied(item.id, 'out_for_delivery');
    try {
      await deliveryPartnerApi.updateStatus(item.id, { status: 'out_for_delivery' });
      onStatusChanged();
    } catch (err) {
      onStatusApplied(item.id, before);
      handleStatusUpdateError(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelivered() {
    if (busy) return;
    const before = item.status;
    setBusy(true);
    onStatusApplied(item.id, 'delivered');
    try {
      await deliveryPartnerApi.updateStatus(item.id, {
        status: 'delivered',
        remark: remark.trim() || undefined,
      });
      setShowRemark(false);
      setRemark('');
      onStatusChanged();
    } catch (err) {
      onStatusApplied(item.id, before);
      handleStatusUpdateError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderWidth: 0 },
        CardEdge,
        Shadows.xs,
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.name, { color: colors.text, fontFamily: fonts.bodySemibold }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <StatusPill status={item.status} />
      </View>

      <View style={styles.details}>
        {address ? (
          <View style={[styles.iconRow, styles.iconRowTop]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="location-outline" size={13} color={colors.primary} />
            </View>
            {/* Never truncated: a clipped address sends the rider to the wrong door. */}
            <Text style={[styles.iconRowText, styles.addressText, { color: colors.text, fontFamily: fonts.body }]}>
              {address}
            </Text>
          </View>
        ) : null}

        {phone ? (
          <TouchableOpacity style={styles.iconRow} activeOpacity={0.7} onPress={callCustomer}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="call-outline" size={13} color={colors.primary} />
            </View>
            <Text style={[styles.iconRowText, { color: colors.blue, fontFamily: fonts.bodyMedium }]}>
              {phone}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaPill, { backgroundColor: colors.primaryBg }]}>
          <Ionicons name="restaurant" size={12} color={colors.primaryDark} />
          <Text style={[styles.metaText, { color: colors.primaryDark, fontFamily: fonts.bodySemibold }]}>
            {item.quantity} bowl{item.quantity !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={[styles.metaPill, { backgroundColor: slotBg }]}>
          <Ionicons name="time" size={12} color={slotFg} />
          <Text style={[styles.metaText, { color: slotFg, fontFamily: fonts.bodySemibold }]} numberOfLines={1}>
            {slotLabelPlain(item.delivery_slot, slots)}
          </Text>
        </View>

        <View
          style={[
            styles.metaPill,
            styles.notePill,
            hasCookingNote
              ? { backgroundColor: colors.accent }
              : { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={hasCookingNote ? 'alert-circle' : 'checkmark-circle-outline'}
            size={12}
            color={hasCookingNote ? '#FFFFFF' : colors.text}
            style={todaysNote ? styles.noteIcon : undefined}
          />
          {/* A typed note wraps instead of truncating: a cut-off instruction
              reads as complete. */}
          <Text
            style={[
              styles.metaText,
              styles.metaTextFlexible,
              { color: hasCookingNote ? '#FFFFFF' : colors.text, fontFamily: fonts.bodySemibold },
            ]}
            numberOfLines={todaysNote ? 3 : 1}
          >
            {cookingNoteText}
          </Text>
        </View>
      </View>

      {(item.status === 'scheduled' || (item.status === 'out_for_delivery' && !showRemark)) && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.mapBtn,
              { backgroundColor: colors.surface, borderColor: canNavigate ? colors.blue : colors.border },
              !canNavigate && styles.mapBtnDisabled,
            ]}
            activeOpacity={0.7}
            hitSlop={8}
            onPress={() => { void navigateToStop(); }}
            disabled={!canNavigate}
          >
            <Ionicons name="map-outline" size={16} color={canNavigate ? colors.blue : colors.textDisabled} />
          </TouchableOpacity>

          {isFutureStop ? null : !item.visible_to_partner ? (
            // Another partner's stop, seen under "All Deliveries"; the server
            // would refuse a status change.
            <View style={[styles.actionBtn, styles.actionBtnFlex, styles.notMineBtn, { borderColor: colors.border }]}>
              <Text style={[styles.actionText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                Assigned to another partner
              </Text>
            </View>
          ) : item.status === 'scheduled' ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnFlex, { backgroundColor: colors.blue }, busy && styles.actionBtnDisabled]}
              activeOpacity={0.8}
              onPress={markOutForDelivery}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.actionText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                  Mark Out for Delivery
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnFlex, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => setShowRemark(true)}
            >
              <Text style={[styles.actionText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                Mark Delivered
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showRemark && (
        <View style={styles.remarkBlock}>
          <TextInput
            value={remark}
            onChangeText={setRemark}
            placeholder="Optional remark (e.g. left at gate)"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.remarkInput,
              { borderColor: colors.border, color: colors.text, fontFamily: fonts.body },
            ]}
            editable={!busy}
          />
          <View style={styles.remarkActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.7}
              disabled={busy}
              onPress={() => {
                setShowRemark(false);
                setRemark('');
              }}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }, busy && styles.actionBtnDisabled]}
              activeOpacity={0.8}
              onPress={confirmDelivered}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.actionText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                  Confirm Delivered
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing[3.5],
    marginBottom: Spacing[2.5],
    gap: Spacing[2.5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  name: { fontSize: FontSize.md, flexShrink: 1 },

  // Reorder mode — collapsed card: name + up/down arrows only.
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  reorderName: { flex: 1 },
  reorderArrows: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  details: { gap: 6 },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconRowText: { fontSize: FontSize.sm, flexShrink: 1, lineHeight: 18 },
  // The address may run several lines, so its pin aligns to the first line
  // instead of floating in the middle of the block.
  iconRowTop: { alignItems: 'flex-start' },
  addressText: { flex: 1 },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing[2],
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[2.5],
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  notePill: {
    maxWidth: '100%',
  },
  metaText: { fontSize: FontSize.xs, letterSpacing: 0.1 },
  // Lets a long note wrap inside the pill instead of pushing past its edge.
  metaTextFlexible: { flexShrink: 1, lineHeight: 16 },
  // Keeps the icon on the first line of a wrapped note rather than floating in
  // the vertical middle of the block.
  noteIcon: { alignSelf: 'flex-start', marginTop: 1 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing[2],
  },
  actionBtn: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    height: 38,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFlex: { flex: 1, minWidth: 0 },
  actionBtnDisabled: { opacity: 0.6 },
  notMineBtn: { borderWidth: 1 },
  mapBtn: {
    width: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnDisabled: { opacity: 0.6 },
  actionText: { fontSize: FontSize.sm },
  remarkBlock: { gap: Spacing[2.5] },
  remarkInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3.5],
    paddingVertical: Spacing[3],
    fontSize: FontSize.sm,
  },
  remarkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  cancelBtn: { paddingVertical: Spacing[2], paddingHorizontal: Spacing[2] },
  cancelText: { fontSize: FontSize.sm },
});
