import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useTopInset } from '@/hooks/use-top-inset';

import { Skeleton } from '@/components/skeleton';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { cafeApi } from '@/lib/api';
import {
  cartLines,
  itemsTotal,
  MAX_QUANTITY,
  openStatus,
  parseCart,
  rupees,
  type CafeItem,
  type CafeSection,
  type DietMark,
  type Orderable,
  type OrderDetails,
  type PaidCafeOrder,
  type PickupPayment,
} from '@/lib/cafe-order';
import { toWhatsAppNumber } from '@/lib/contact-actions';
import { formatGstRate } from '@/lib/gst';
import { readAddressesCache } from '@/lib/home-cache';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import { storage } from '@/lib/storage';
import { useSupportContact } from '@/lib/support-contact';
import { useWhatsAppOrdering } from '@/lib/whatsapp-ordering';
import { CheckoutSheet } from '@/components/screens/cafe/checkout-sheet';
import { AddOns, ItemRow } from '@/components/screens/cafe/item-row';
import { MarkBadge } from '@/components/screens/cafe/mark-badge';
import { SizeSheet } from '@/components/screens/cafe/size-sheet';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const CART_KEY = 'ss-cafe-cart';

const FALLBACK_WHATSAPP = '919316102899';

const MARKS: DietMark[] = ['glutenFree', 'jain', 'vegan'];

const EMPTY_DETAILS: OrderDetails = {
  name: '',
  phone: '',
  fulfilment: 'delivery',
  address: '',
  locationUrl: null,
  time: null,
  notes: '',
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function readStoredCart(menu: CafeSection[]): Record<string, number> {
  try {
    const raw = storage.getString(CART_KEY);
    return raw ? parseCart(raw, menu) : {};
  } catch {
    return {};
  }
}

function writeStoredCart(quantities: Record<string, number>) {
  try {
    storage.set(CART_KEY, JSON.stringify(quantities));
  } catch {}
}

function defaultAddressText(userId: string | undefined): string {
  const address = userId ? readAddressesCache(userId)?.find((a) => a.is_default) : undefined;
  if (!address) return '';
  return [address.full_address, address.landmark, [address.city, address.pincode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

export default function CafeScreen() {
  const { colors, fonts } = useTheme();
  const topInset = useTopInset();
  const { session, profile } = useAuth();
  const whatsappOrdering = useWhatsAppOrdering();
  const { phone: supportPhone } = useSupportContact();
  const whatsappNumber = toWhatsAppNumber(supportPhone) ?? FALLBACK_WHATSAPP;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cafe-menu'],
    queryFn: () => cafeApi.menu(),
    staleTime: CACHE_TTL.menu,
    persister: asyncPersister.persisterFn,
  });
  useQueryFocusRefetch(['cafe-menu']);
  const menu = data?.data;

  // Null until the first change: the stored cart can only be validated once the menu it refers to has loaded.
  const [edited, setEdited] = useState<Record<string, number> | null>(null);
  const quantities = useMemo(
    () => edited ?? (menu ? readStoredCart(menu.sections) : {}),
    [edited, menu],
  );
  useEffect(() => {
    if (edited) writeStoredCart(edited);
  }, [edited]);

  const lines = useMemo(() => (menu ? cartLines(quantities, menu.sections) : []), [quantities, menu]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = itemsTotal(lines);
  const summary = `${plural(count, 'item')} · ${rupees(total)}`;

  const [search, setSearch] = useState('');
  const [only, setOnly] = useState<DietMark[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sizing, setSizing] = useState<{ sectionId: string; item: CafeItem } | null>(null);
  const [details, setDetails] = useState<OrderDetails>(EMPTY_DETAILS);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(() => new Date());
  const [sent, setSent] = useState(false);
  const [payment, setPayment] = useState<PickupPayment>('online');
  const [paid, setPaid] = useState<PaidCafeOrder | null>(null);
  const [now, setNow] = useState(() => new Date());

  // The tab stays mounted between visits, so each visit re-reads the clock and forgets a sent order.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      return () => setSent(false);
    }, []),
  );

  const scrollRef = useRef<ScrollViewInstance>(null);
  const tabsRef = useRef<ScrollViewInstance>(null);
  const listTop = useRef(0);
  const navHeight = useRef(0);
  const sectionTops = useRef<Record<string, number>>({});
  const tabSpots = useRef<Record<string, number>>({});
  // While a tapped tab scrolls the list, the scroll must not move the highlight back.
  const jumping = useRef(false);

  const query = search.trim().toLowerCase();
  const sections = useMemo(
    () =>
      (menu?.sections ?? [])
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              only.every((mark) => item.marks?.includes(mark)) &&
              (!query || item.name.toLowerCase().includes(query) || !!item.ingredients?.toLowerCase().includes(query)),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [menu, only, query],
  );
  const current = sections.some((section) => section.id === activeId) ? activeId : (sections[0]?.id ?? null);

  const status = menu ? openStatus(now, menu.outlet.hours) : null;
  const gstRateBps = menu?.gstRateBps ?? 0;
  const onlinePayment = menu?.onlinePayment ?? false;

  function setQuantity(orderable: Orderable, quantity: number) {
    const next = Math.max(0, Math.min(MAX_QUANTITY, quantity));
    if (next > (quantities[orderable.key] ?? 0)) void Haptics.selectionAsync().catch(() => {});
    setEdited((existing) => {
      const { [orderable.key]: _previous, ...rest } = existing ?? quantities;
      return next > 0 ? { ...rest, [orderable.key]: next } : rest;
    });
  }

  function clearCart() {
    setEdited({});
    setSent(false);
  }

  function toggleMark(mark: DietMark) {
    setOnly((marks) => (marks.includes(mark) ? marks.filter((m) => m !== mark) : [...marks, mark]));
  }

  function highlight(id: string) {
    if (id === current) return;
    setActiveId(id);
    const x = tabSpots.current[id];
    if (x !== undefined) tabsRef.current?.scrollTo({ x: Math.max(0, x - Spacing[5]), animated: true });
  }

  function trackSection(y: number) {
    if (jumping.current) return;
    const line = y + navHeight.current + Spacing[3];
    let id = sections[0]?.id;
    for (const section of sections) {
      const top = sectionTops.current[section.id];
      if (top !== undefined && listTop.current + top <= line) id = section.id;
    }
    if (id) highlight(id);
  }

  function jumpTo(id: string) {
    const top = sectionTops.current[id];
    if (top === undefined) return;
    highlight(id);
    jumping.current = true;
    scrollRef.current?.scrollTo({ y: listTop.current + top - navHeight.current, animated: true });
    setTimeout(() => {
      jumping.current = false;
    }, 500);
  }

  function openCheckout() {
    setDetails((existing) => ({
      ...existing,
      name: existing.name || profile?.full_name?.trim() || '',
      phone: existing.phone || profile?.phone || '',
      address: existing.address || defaultAddressText(session?.user?.id),
    }));
    setOpenedAt(new Date());
    setPaid(null);
    setCheckoutOpen(true);
  }

  const storeFacts: { icon: IconName; text: string }[] = [
    { icon: 'bag-handle-outline', text: 'Pickup or delivery' },
    ...(whatsappOrdering ? [] : [{ icon: 'card-outline' as IconName, text: 'Paid in advance' }]),
    ...(gstRateBps > 0 ? [{ icon: 'receipt-outline' as IconName, text: `Prices + ${formatGstRate(gstRateBps)} GST` }] : []),
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.pageHeader, column(), { paddingTop: topInset + (Platform.OS === 'android' ? 12 : 0) }]}>
        <Text style={[s.pageEyebrow, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Pickup or delivery</Text>
        <Text style={[s.pageTitle, { color: colors.text, fontFamily: fonts.display }]}>Our Café</Text>
      </View>

      {!menu ? (
        isLoading ? (
          <View style={s.skeleton}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={128} radius={Radius.lg} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="cafe-outline"
            title="The menu didn't load"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        )
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            stickyHeaderIndices={[1]}
            onScroll={(e) => trackSection(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[column(), { paddingBottom: Spacing[6] }]}
          >
            <View style={s.top}>
              <View style={[s.store, { backgroundColor: colors.surface }, CardEdge]}>
                <View style={s.storeHead}>
                  <View style={[s.statusPill, { backgroundColor: status?.isOpen ? colors.successBg : colors.surface2 }]}>
                    <View style={[s.statusDot, { backgroundColor: status?.isOpen ? colors.success : colors.textMuted }]} />
                    <Text
                      style={[
                        s.statusText,
                        { color: status?.isOpen ? colors.success : colors.textMuted, fontFamily: fonts.bodySemibold },
                      ]}
                    >
                      {status?.isOpen ? 'Open now' : 'Closed'}
                    </Text>
                  </View>
                  {status?.detail ? (
                    <Text style={[s.storeDetail, { color: colors.textMuted, fontFamily: fonts.body }]}>{status.detail}</Text>
                  ) : null}
                </View>
                <Text style={[s.storeName, { color: colors.text, fontFamily: fonts.display }]}>Prahladnagar café</Text>
                <View style={s.storeFacts}>
                  {storeFacts.map((fact) => (
                    <View key={fact.text} style={s.storeFact}>
                      <Ionicons name={fact.icon} size={13} color={colors.primary} />
                      <Text style={[s.storeFactText, { color: colors.textSecondary, fontFamily: fonts.body }]}>{fact.text}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[s.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={17} color={colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search dishes or ingredients"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  autoCorrect={false}
                  style={[s.searchInput, { color: colors.text, fontFamily: fonts.body }]}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dietRow}>
                {MARKS.map((mark) => {
                  const on = only.includes(mark);
                  return (
                    <TouchableOpacity
                      key={mark}
                      onPress={() => toggleMark(mark)}
                      activeOpacity={0.8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[
                        s.dietChip,
                        on
                          ? { backgroundColor: colors.primaryBg, borderColor: colors.primary }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <MarkBadge mark={mark} dietMarks={menu.dietMarks} />
                      <Text
                        style={[s.dietChipText, { color: on ? colors.onPrimaryBg : colors.text, fontFamily: fonts.bodyMedium }]}
                      >
                        {menu.dietMarks[mark]?.label}
                      </Text>
                      {on ? <Ionicons name="checkmark" size={13} color={colors.onPrimaryBg} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View
              style={[s.nav, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
              onLayout={(e) => {
                navHeight.current = e.nativeEvent.layout.height;
              }}
            >
              <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
                {sections.map((section) => {
                  const active = current === section.id;
                  return (
                    <TouchableOpacity
                      key={section.id}
                      onLayout={(e) => {
                        tabSpots.current[section.id] = e.nativeEvent.layout.x;
                      }}
                      onPress={() => jumpTo(section.id)}
                      activeOpacity={0.8}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={[
                        s.tab,
                        active
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          s.tabText,
                          {
                            color: active ? colors.textOnPrimary : colors.text,
                            fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium,
                          },
                        ]}
                      >
                        {section.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View
              style={s.list}
              onLayout={(e) => {
                listTop.current = e.nativeEvent.layout.y;
              }}
            >
              {sections.length === 0 ? (
                <View style={[s.noMatch, { borderColor: colors.border }]}>
                  <Ionicons name="search-outline" size={22} color={colors.textMuted} />
                  <Text style={[s.noMatchText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    {query ? `Nothing on the menu matches “${search.trim()}”.` : 'Nothing on the menu carries all of those marks.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSearch('');
                      setOnly([]);
                    }}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={[s.noMatchText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                      Show everything
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                sections.map((section) => (
                  <View
                    key={section.id}
                    style={s.section}
                    onLayout={(e) => {
                      sectionTops.current[section.id] = e.nativeEvent.layout.y;
                    }}
                  >
                    <View style={s.sectionHead}>
                      <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.display }]}>{section.title}</Text>
                      <Text style={[s.sectionCount, { color: colors.textMuted, fontFamily: fonts.body }]}>
                        {plural(section.items.length, 'item')}
                      </Text>
                    </View>
                    <View style={[s.sectionCard, { backgroundColor: colors.surface }, CardEdge]}>
                      {section.items.map((item, index) => (
                        <ItemRow
                          key={item.name}
                          sectionId={section.id}
                          item={item}
                          first={index === 0}
                          dietMarks={menu.dietMarks}
                          quantities={quantities}
                          onChange={setQuantity}
                          onChooseSize={() => setSizing({ sectionId: section.id, item })}
                        />
                      ))}
                      {section.addOns?.length && !query ? (
                        <AddOns section={section} quantities={quantities} onChange={setQuantity} />
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {count > 0 ? (
            <BottomActionBar flexible style={s.bar}>
              <View style={s.barRow}>
                <View style={s.barText}>
                  <Text style={[s.barSummary, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{summary}</Text>
                  {gstRateBps > 0 ? (
                    <Text style={[s.barLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>
                      + {formatGstRate(gstRateBps)} GST
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={openCheckout}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  style={[s.reviewBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[s.reviewText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                    View order
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </View>
            </BottomActionBar>
          ) : null}

          <SizeSheet
            choice={sizing}
            dietMarks={menu.dietMarks}
            quantities={quantities}
            onChange={setQuantity}
            onClose={() => setSizing(null)}
          />

          <CheckoutSheet
            visible={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            lines={lines}
            total={total}
            summary={summary}
            onQuantity={setQuantity}
            onClear={clearCart}
            details={details}
            onDetails={(patch) => setDetails((existing) => ({ ...existing, ...patch }))}
            hours={menu.outlet.hours}
            pickupAddress={menu.outlet.addressText}
            openedAt={openedAt}
            whatsappNumber={whatsappNumber}
            sent={sent}
            onSent={() => setSent(true)}
            quantities={quantities}
            gstRateBps={gstRateBps}
            onlinePayment={onlinePayment && !whatsappOrdering}
            askForPayment={!whatsappOrdering}
            payment={payment}
            onPayment={setPayment}
            paid={paid}
            onPaid={(order) => {
              setPaid(order);
              setEdited({});
            }}
            onNewOrder={() => setPaid(null)}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pageHeader: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3] },
  pageEyebrow: { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 3 },
  pageTitle: { fontSize: FontSize['1.5xl'], fontWeight: FontWeight.semibold as '600', letterSpacing: -0.5 },
  root: { flex: 1 },
  skeleton: { gap: Spacing[3], paddingHorizontal: Spacing[5], paddingTop: Spacing[3] },

  top: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3], gap: Spacing[3] },
  store: { borderRadius: Radius.lg, padding: Spacing[3.5], gap: 6 },
  storeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs },
  storeDetail: { fontSize: FontSize.xs },
  storeName: { fontSize: FontSize.lg },
  storeFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing[3], rowGap: 4 },
  storeFact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeFactText: { fontSize: FontSize.xs },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing[3.5],
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, paddingVertical: 0 },
  dietRow: { gap: 6 },
  dietChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 5,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dietChipText: { fontSize: FontSize.xs },

  nav: { paddingVertical: Spacing[2.5], borderBottomWidth: StyleSheet.hairlineWidth },
  tabRow: { paddingHorizontal: Spacing[5], gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  tabText: { fontSize: FontSize.sm },

  list: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[5] },
  noMatch: {
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[6],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noMatchText: { fontSize: FontSize.sm, textAlign: 'center' },

  section: { gap: Spacing[2] },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing[3] },
  sectionTitle: { fontSize: FontSize.xl },
  sectionCount: { fontSize: FontSize.xs },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },

  // A tab bar sits below, so the bar needs no room for the home indicator.
  bar: { paddingTop: Spacing[3], paddingBottom: Spacing[3] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  barText: { flex: 1 },
  barLabel: { fontSize: FontSize.xs },
  barSummary: { fontSize: FontSize.base },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: Spacing[5],
    borderRadius: Radius.full,
  },
  reviewText: { fontSize: FontSize.sm },

});
