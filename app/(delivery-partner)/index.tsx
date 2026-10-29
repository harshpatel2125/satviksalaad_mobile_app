import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import DeliveryListSkeleton from '@/components/delivery-partner/DeliveryListSkeleton';
import DeliveryRow from '@/components/delivery-partner/DeliveryRow';
import FilterSheet from '@/components/delivery-partner/FilterSheet';
import { useAlert } from '@/context/alert';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { deliveryPartnerApi } from '@/lib/api';
import { useDietaryOptions } from '@/lib/dietary-options';
import { slotLabelPlain, useSlots } from '@/lib/slots';
import type { PartnerDeliveryItem } from '@/types/delivery-partner';

// Statuses the partner still needs to act on; resolved stops sink below them.
const ACTIVE_STATUSES = new Set(['scheduled', 'out_for_delivery']);

// Skipped, missed and cancelled stops stay hidden until the partner opts in via Filters.
const DEFAULT_VISIBLE_STATUSES = new Set(['scheduled', 'out_for_delivery', 'delivered']);

// The API serves yesterday to tomorrow only.
const MIN_DATE_OFFSET = -1;
const MAX_DATE_OFFSET = 1;

function slotChipColor(slotId: string, colors: ReturnType<typeof useTheme>['colors']): string {
  if (slotId === 'noon') return colors.orange;
  if (slotId === 'evening') return colors.purple;
  return colors.blue;
}

function todayISTStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Anchored at IST noon so the result is the right IST date in any device timezone.
function addDaysIST(dateStr: string, days: number): string {
  const base = new Date(dateStr + 'T12:00:00+05:30');
  base.setUTCDate(base.getUTCDate() + days);
  return base.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function todayISTString(offsetDays = 0): string {
  return addDaysIST(todayISTStr(), offsetDays);
}

function displayDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function DeliveryPartnerHomeScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const slots = useSlots();
  const { showAlert } = useAlert();
  const dietaryOptions = useDietaryOptions();
  const dietaryLabelByKey = useMemo(() => new Map(dietaryOptions.map((o) => [o.key, o.label])), [dietaryOptions]);

  const [dateOffset, setDateOffset] = useState(0);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState<PartnerDeliveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetched separately so a zone with no stops today is still selectable.
  // Falls back to the zones in `items` if the fetch fails.
  const [zoneOptions, setZoneOptions] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    deliveryPartnerApi.zones()
      .then((res) => { if (!cancelled && res.success) setZoneOptions(res.data); })
      .catch(() => { /* fall back to items-derived zones below */ });
    return () => { cancelled = true; };
  }, []);

  // Reorder mode collapses every row in the same list to name + arrows, so a
  // long route stays scrollable while reordering.
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const date = todayISTString(dateOffset);

  function changeDateOffset(next: number) {
    const clamped = Math.min(MAX_DATE_OFFSET, Math.max(MIN_DATE_OFFSET, next));
    if (clamped === dateOffset) return;
    setItems([]);
    setDateOffset(clamped);
  }

  // Only the newest request may write: quick date taps can return out of order
  // and show one day's stops under another day's heading.
  const requestSeq = useRef(0);

  // `silent` refreshes behind what is on screen, with no spinner — for the
  // re-read after a status change.
  const load = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const res = await deliveryPartnerApi.list({ date, scope });
      if (seq !== requestSeq.current) return;
      if (res.success) setItems(res.data);
    } catch (err) {
      if (seq !== requestSeq.current || silent) return;
      // Keep whatever was already on screen — only surface the error state
      // when there's nothing else to show (see the render below).
      setLoadError(err instanceof Error ? err.message : 'Could not load deliveries. Try again.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [date, scope]);

  const applyStatus = useCallback((id: string, status: string) => {
    setItems((prev) => prev.map((i) => (i.id === id
      ? { ...i, status, delivered_at: status === 'delivered' ? new Date().toISOString() : i.delivered_at }
      : i)));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const itemsDerivedZones = [...new Set(items.map((i) => i.area).filter((a): a is string => a !== null))].sort();
  const zones = zoneOptions ?? itemsDerivedZones;
  const slotIds = slots.map((s) => s.id);

  const activeFilterCount = (selectedZones.length > 0 ? 1 : 0) + (selectedSlots.length > 0 ? 1 : 0) + (search ? 1 : 0) + (showAllStatuses ? 1 : 0);

  function toggleZone(z: string) {
    setSelectedZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  }

  function toggleSlot(s: string) {
    setSelectedSlots((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  const slotOrder = useMemo(() => new Map(slots.map((s, i) => [s.id, i])), [slots]);

  const searchTerm = search.trim().toLowerCase();

  // Filtered on the client so toggling filters needs no round trip. The sort
  // is stable, so ties keep the server's route order.
  const sortedItems = useMemo(() => {
    let visible = showAllStatuses ? items : items.filter((i) => DEFAULT_VISIBLE_STATUSES.has(i.status));
    if (selectedZones.length > 0) {
      visible = visible.filter((i) => i.area !== null && selectedZones.includes(i.area));
    }
    if (selectedSlots.length > 0) {
      visible = visible.filter((i) => selectedSlots.includes(i.delivery_slot));
    }
    if (searchTerm) {
      visible = visible.filter((item) => {
        const name = item.profiles?.full_name?.toLowerCase() ?? '';
        const phone = item.profiles?.phone?.toLowerCase() ?? '';
        const address = item.profiles?.delivery_addresses?.full_address.toLowerCase() ?? '';
        return name.includes(searchTerm) || phone.includes(searchTerm) || address.includes(searchTerm);
      });
    }
    return [...visible].sort((a, b) => {
      const slotA = slotOrder.get(a.delivery_slot) ?? 99;
      const slotB = slotOrder.get(b.delivery_slot) ?? 99;
      if (slotA !== slotB) return slotA - slotB;
      const activeA = ACTIVE_STATUSES.has(a.status) ? 0 : 1;
      const activeB = ACTIVE_STATUSES.has(b.status) ? 0 : 1;
      return activeA - activeB;
    });
  }, [items, showAllStatuses, slotOrder, searchTerm, selectedZones, selectedSlots]);

  const itemsById = useMemo(() => new Map(sortedItems.map((i) => [i.id, i])), [sortedItems]);

  const displayItems = reordering
    ? order.map((id) => itemsById.get(id)).filter((i): i is PartnerDeliveryItem => !!i)
    : sortedItems;

  // A saved order renumbers exactly the stops listed, so it must be the
  // partner's own, unfiltered route.
  const canSort = scope === 'mine' && activeFilterCount === 0 && sortedItems.length > 0;

  function enterReorderMode() {
    setOrder(sortedItems.map((i) => i.id));
    setReordering(true);
  }

  function cancelReorderMode() {
    if (savingOrder) return;
    setReordering(false);
    setOrder([]);
  }

  function moveItem(id: string, direction: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  async function persistOrder() {
    if (savingOrder) return;
    const currentIds = new Set(items.map((i) => i.id));
    const isStale = order.some((id) => !currentIds.has(id));
    if (isStale) {
      showAlert(
        'Order out of date',
        'The delivery list changed while you were reordering, so this order can no longer be saved safely. Cancel and start again.',
      );
      return;
    }

    setSavingOrder(true);
    try {
      await deliveryPartnerApi.reorder(order);
      setReordering(false);
      setOrder([]);
      await load();
    } catch (err) {
      showAlert('Update failed', err instanceof Error ? err.message : 'Could not save the new order. Try again.');
    } finally {
      setSavingOrder(false);
    }
  }

  function saveOrderWithConfirm() {
    showAlert(
      'Save new order?',
      'This changes the delivery order for everyone, including the admin view.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: persistOrder },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, column(), { backgroundColor: colors.background, paddingTop: insets.top + Spacing[3] }]}
    >
      {/* Covers the header only: wrapping the FlatList in a tap-to-dismiss view
          competes with its scroll gesture and stalls scrolling. */}
      <Pressable onPress={Keyboard.dismiss}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>
        Deliveries
      </Text>

      {/* Date nav */}
      <View style={styles.dateNav}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => changeDateOffset(dateOffset - 1)}
          disabled={reordering || dateOffset <= MIN_DATE_OFFSET}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.dateBtn, (reordering || dateOffset <= MIN_DATE_OFFSET) && styles.controlDisabled]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={[styles.dateLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            {displayDate(date)}
          </Text>
          {dateOffset !== 0 && (
            <TouchableOpacity activeOpacity={0.7} onPress={() => changeDateOffset(0)} hitSlop={8}>
              <Text style={[styles.todayLink, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
                Jump to Today
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => changeDateOffset(dateOffset + 1)}
          disabled={reordering || dateOffset >= MAX_DATE_OFFSET}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.dateBtn, (reordering || dateOffset >= MAX_DATE_OFFSET) && styles.controlDisabled]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>
        {!reordering && (
          <View style={[styles.scopeToggle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            {(['mine', 'all'] as const).map((s) => {
              const active = scope === s;
              return (
                <TouchableOpacity
                  key={s}
                  activeOpacity={0.7}
                  onPress={() => setScope(s)}
                  style={[styles.scopeSegment, active && { backgroundColor: colors.primary }]}
                >
                  <Text
                    style={[
                      styles.scopeSegmentText,
                      { color: active ? colors.textOnPrimary : colors.textMuted, fontFamily: fonts.bodyMedium },
                    ]}
                  >
                    {s === 'mine' ? 'Mine' : 'All'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!reordering && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFiltersOpen(true)}
            style={[
              styles.filtersBtn,
              {
                backgroundColor: colors.surface,
                borderColor: activeFilterCount > 0 ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="options-outline" size={16} color={activeFilterCount > 0 ? colors.primary : colors.textMuted} />
            <Text
              style={[
                styles.filtersBtnText,
                { color: activeFilterCount > 0 ? colors.primary : colors.text, fontFamily: fonts.bodyMedium },
              ]}
            >
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View style={[styles.filtersBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.filtersBadgeText, { fontFamily: fonts.bodySemibold }]}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {!reordering ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={enterReorderMode}
            disabled={!canSort}
            style={[
              styles.orderBtn,
              { backgroundColor: colors.primaryBg, borderColor: colors.primary },
              !canSort && styles.controlDisabled,
            ]}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.primary} />
            <Text style={[styles.orderBtnText, { color: colors.primary, fontFamily: fonts.bodySemibold }]} numberOfLines={1}>
              Sort
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.reorderActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={cancelReorderMode}
              disabled={savingOrder}
              style={[styles.cancelBtn, { borderColor: colors.border }, savingOrder && styles.controlDisabled]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={saveOrderWithConfirm}
              disabled={savingOrder}
              style={[styles.saveBtn, { backgroundColor: colors.primary }, savingOrder && styles.controlDisabled]}
            >
              {savingOrder ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                  Save Sequence
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!reordering && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, phone, or address"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.body }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
      </Pressable>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        search={search}
        onClearAll={() => { setSearch(''); setSelectedZones([]); setSelectedSlots([]); setShowAllStatuses(false); }}
        zoneChips={zones.map((z) => ({ key: `zone:${z}`, label: z, active: selectedZones.includes(z), onPress: () => toggleZone(z) }))}
        slotChips={slotIds.map((s) => ({
          key: `slot:${s}`,
          label: slotLabelPlain(s, slots),
          active: selectedSlots.includes(s),
          onPress: () => toggleSlot(s),
          activeColor: slotChipColor(s, colors),
        }))}
        statusChips={[{ key: 'all-statuses', label: 'Show skipped, missed & cancelled', active: showAllStatuses, onPress: () => setShowAllStatuses((v) => !v) }]}
      />

      {loading && items.length === 0 ? (
        <DeliveryListSkeleton />
      ) : loadError && items.length === 0 ? (
        <View style={styles.errorState}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
          <Text style={[styles.errorTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            Couldn&apos;t load deliveries
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => void load()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(i) => i.id}
          renderItem={({ item, index }) => (
            <DeliveryRow
              item={item}
              dietaryLabelByKey={dietaryLabelByKey}
              onStatusChanged={() => void load(true)}
              onStatusApplied={applyStatus}
              reorderMode={reordering}
              onMoveUp={() => moveItem(item.id, -1)}
              onMoveDown={() => moveItem(item.id, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < displayItems.length - 1}
            />
          )}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            displayItems.length === 0 && styles.listContentEmpty,
            { paddingBottom: Spacing[5] },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={reordering ? undefined : load}
              enabled={!reordering}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted, fontFamily: fonts.body }]}>
              No deliveries for this filter.
            </Text>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing[5] },
  controlDisabled: { opacity: 0.5 },
  title: { fontSize: FontSize['1.5xl'], letterSpacing: -0.5, marginBottom: Spacing[3] },

  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  dateBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: { alignItems: 'center' },
  dateLabel: { fontSize: FontSize.md },
  todayLink: { fontSize: FontSize.xs, marginTop: 2 },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },

  scopeToggle: {
    flex: 4,
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    height: 38,
  },
  scopeSegment: {
    flex: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeSegmentText: { fontSize: FontSize.sm },

  filtersBtn: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    height: 38,
  },
  filtersBtnText: { fontSize: FontSize.sm },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filtersBadgeText: { fontSize: 10, color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3.5],
    height: 44,
    marginBottom: Spacing[3],
  },
  searchInput: { flex: 1, fontSize: FontSize.base, padding: 0 },

  orderBtn: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    height: 38,
  },
  orderBtnText: { fontSize: FontSize.sm },

  // The scope toggle is hidden while reordering, so these take the full row.
  reorderActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: FontSize.sm },
  saveBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: FontSize.sm },

  list: { flex: 1 },
  listContent: { paddingTop: Spacing[1] },
  // Applied only when empty; on a short list flexGrow would leave a blank gap.
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: FontSize.sm },

  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[6],
  },
  errorTitle: { fontSize: FontSize.md, marginTop: Spacing[2] },
  errorSubtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: Spacing[3],
    height: 40,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: FontSize.sm },
});
