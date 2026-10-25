import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/skeleton';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { Brand, CardEdge, FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, cafeApi } from '@/lib/api';
import {
  addOnOrderable,
  buildOrderMessage,
  cartLines,
  formatClock,
  istClock,
  itemOrderables,
  itemsTotal,
  lineTotal,
  MAX_QUANTITY,
  onlinePaymentBlock,
  openStatus,
  parseCart,
  pickupTimeError,
  rupees,
  toMinutes,
  validateOrder,
  whatsappOrderUrl,
  type CafeItem,
  type CafeMenuData,
  type CafeSection,
  type CartLine,
  type DietMark,
  type OpeningHours,
  type Orderable,
  type OrderDetails,
  type OrderField,
  type PaidCafeOrder,
  type PickupPayment,
} from '@/lib/cafe-order';
import { toWhatsAppNumber } from '@/lib/contact-actions';
import { addGst, formatGstRate, rupeesFromPaise } from '@/lib/gst';
import { readAddressesCache } from '@/lib/home-cache';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import { storage } from '@/lib/storage';
import { useSupportContact } from '@/lib/support-contact';

type DietMarks = CafeMenuData['dietMarks'];
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type SetQuantity = (orderable: Orderable, quantity: number) => void;

const CART_KEY = 'ss-cafe-cart';
const FALLBACK_WHATSAPP = '919316102899';
const MARKS: DietMark[] = ['glutenFree', 'jain', 'vegan'];
const FIELD_ORDER: OrderField[] = ['name', 'phone', 'address', 'time'];
const SLOT_MINUTES = 30;

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

/** Half-hourly times within opening hours; on an open day, only those still ahead (all of them once it has closed). */
function timeSlots(hours: OpeningHours, now: Date): string[] {
  const slots: string[] = [];
  for (let m = toMinutes(hours.opens); m <= toMinutes(hours.closes); m += SLOT_MINUTES) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  const { day, minute } = istClock(now);
  const ahead = hours.openDays.includes(day) ? slots.filter((slot) => toMinutes(slot) > minute) : slots;
  return ahead.length > 0 ? ahead : slots;
}

export default function CafeMenuScreen() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { phone: supportPhone } = useSupportContact();
  const whatsappNumber = toWhatsAppNumber(supportPhone) ?? FALLBACK_WHATSAPP;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cafe-menu'],
    queryFn: () => cafeApi.menu(),
    staleTime: CACHE_TTL.menu,
    persister: asyncPersister.persisterFn,
  });
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

  const scrollRef = useRef<ScrollView>(null);
  const tabsRef = useRef<ScrollView>(null);
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

  const status = menu ? openStatus(new Date(), menu.outlet.hours) : null;
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
    setCheckoutOpen(true);
  }

  const storeFacts: { icon: IconName; text: string }[] = [
    { icon: 'bag-handle-outline', text: 'Pickup or delivery' },
    { icon: 'card-outline', text: 'Paid in advance' },
    ...(gstRateBps > 0 ? [{ icon: 'receipt-outline' as IconName, text: `Prices + ${formatGstRate(gstRateBps)} GST` }] : []),
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Café menu" onBack={() => router.back()} />

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
            contentContainerStyle={{ paddingBottom: count > 0 ? Spacing[6] : insets.bottom + Spacing[6] }}
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
            onlinePayment={onlinePayment}
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

function MarkBadge({ mark, dietMarks }: { mark: DietMark; dietMarks: DietMarks }) {
  const { colors, fonts } = useTheme();
  const info = dietMarks[mark];
  if (!info) return null;
  return (
    <View accessible accessibilityLabel={info.label} style={[s.badge, { backgroundColor: colors.primaryBg }]}>
      <Text style={[s.badgeText, { color: colors.onPrimaryBg, fontFamily: fonts.bodyBold }]}>{info.letter}</Text>
    </View>
  );
}

function QtyStepper({ label, quantity, onChange }: { label: string; quantity: number; onChange: (quantity: number) => void }) {
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

function ItemRow({
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

function AddOns({
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

/** Picks the size of an item sold in sizes before it goes into the order. */
function SizeSheet({
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
        <View style={[s.sizeSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing[4] }]}>
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

function Choice({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[
        s.choice,
        disabled && { opacity: 0.5 },
        selected
          ? { backgroundColor: colors.primaryBg, borderColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text
        style={[
          s.choiceText,
          { color: selected ? colors.onPrimaryBg : colors.text, fontFamily: selected ? fonts.bodySemibold : fonts.body },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  error,
  onLayout,
  style,
  children,
}: {
  label: string;
  error?: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View onLayout={onLayout} style={[s.field, style]}>
      <Text style={[s.fieldLabel, { color: error ? colors.error : colors.textMuted, fontFamily: fonts.bodyMedium }]}>
        {label}
      </Text>
      {children}
      {error ? <Text style={[s.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{error}</Text> : null}
    </View>
  );
}

interface CheckoutSheetProps {
  visible: boolean;
  onClose: () => void;
  lines: CartLine[];
  total: number;
  summary: string;
  onQuantity: SetQuantity;
  onClear: () => void;
  details: OrderDetails;
  onDetails: (patch: Partial<OrderDetails>) => void;
  hours: OpeningHours;
  pickupAddress: string;
  openedAt: Date;
  whatsappNumber: string;
  sent: boolean;
  onSent: () => void;
  quantities: Record<string, number>;
  gstRateBps: number;
  onlinePayment: boolean;
  payment: PickupPayment;
  onPayment: (payment: PickupPayment) => void;
  paid: PaidCafeOrder | null;
  onPaid: (order: PaidCafeOrder) => void;
  onNewOrder: () => void;
}

function CheckoutSheet({
  visible,
  onClose,
  lines,
  total,
  summary,
  onQuantity,
  onClear,
  details,
  onDetails,
  hours,
  pickupAddress,
  openedAt,
  whatsappNumber,
  sent,
  onSent,
  quantities,
  gstRateBps,
  onlinePayment,
  payment,
  onPayment,
  paid,
  onPaid,
  onNewOrder,
}: CheckoutSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [errors, setErrors] = useState<Partial<Record<OrderField, string>>>({});
  const [attempted, setAttempted] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<OrderField, number>>>({});
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const delivery = details.fulfilment === 'delivery';
  const hasMrp = lines.some((line) => line.unitPrice === null);
  const pickupOnline = onlinePayment && !delivery;
  const onlineBlock = pickupOnline ? onlinePaymentBlock(lines, openedAt, hours) : null;
  const payOnline = pickupOnline && payment === 'online' && !onlineBlock;
  const gst = addGst(total * 100, gstRateBps);
  const slots = useMemo(() => timeSlots(hours, openedAt), [hours, openedAt]);
  const inputStyle = [
    s.input,
    { backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.body },
  ];
  const borderFor = (field: OrderField) => ({ borderColor: errors[field] ? colors.error : colors.border });
  const trackY = (field: OrderField) => (e: LayoutChangeEvent) => {
    fieldY.current[field] = e.nativeEvent.layout.y;
  };

  function update(patch: Partial<OrderDetails>) {
    onDetails(patch);
    if (attempted) setErrors(validateOrder({ ...details, ...patch }, hours));
  }

  async function payNow() {
    setPaying(true);
    let started: Awaited<ReturnType<typeof cafeApi.startPayment>>['data'];
    try {
      started = (
        await cafeApi.startPayment({
          cart: quantities,
          name: details.name,
          phone: details.phone,
          time: details.time,
          notes: details.notes,
        })
      ).data;
    } catch (err) {
      const fields = err instanceof ApiError ? (err.body.fields as Partial<Record<OrderField, string>> | undefined) : undefined;
      if (fields) setErrors(fields);
      setOpenError(err instanceof ApiError ? err.message : "We couldn't start the payment. Check your connection and try again.");
      setPaying(false);
      return;
    }

    let response: { razorpay_payment_id: string; razorpay_signature?: string };
    try {
      response = await RazorpayCheckout.open({
        key: started.keyId,
        amount: started.amountPaise,
        currency: 'INR',
        name: 'Satvik Salaad',
        description: `Café order ${started.orderNumber}`,
        order_id: started.razorpayOrderId,
        prefill: { name: details.name, contact: details.phone },
        theme: { color: Brand.forest },
        modal: { handleback: true },
      });
    } catch (err) {
      // Closing the payment sheet rejects too; either way nothing was charged.
      cafeApi.cancel(started.orderId, started.razorpayOrderId).catch(() => {});
      const description = (err as { code?: number; description?: string }).description ?? '';
      const cancelled = (err as { code?: number }).code === 2 || /cancel|dismiss/i.test(description);
      if (!cancelled) setOpenError(description || 'Payment failed. Please try again.');
      setPaying(false);
      return;
    }

    try {
      const { data } = await cafeApi.verify({
        orderId: started.orderId,
        razorpayOrderId: started.razorpayOrderId,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature ?? '',
      });
      onPaid(data);
    } catch (err) {
      setOpenError(
        err instanceof ApiError ? err.message : "We couldn't confirm your payment. Please call us; nothing is lost.",
      );
    } finally {
      setPaying(false);
    }
  }

  async function send() {
    const found = validateOrder(details, hours);
    const late = payOnline && !found.time ? pickupTimeError(details.time, new Date()) : null;
    if (late) found.time = late;
    setErrors(found);
    setAttempted(true);
    setOpenError(null);
    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      scrollRef.current?.scrollTo({ y: Math.max(0, (fieldY.current[firstInvalid] ?? 0) - Spacing[3]) });
      const inputs: Partial<Record<OrderField, React.RefObject<TextInput | null>>> = {
        name: nameRef,
        phone: phoneRef,
        address: addressRef,
      };
      inputs[firstInvalid]?.current?.focus();
      return;
    }
    if (payOnline) {
      await payNow();
      return;
    }
    try {
      await Linking.openURL(whatsappOrderUrl(whatsappNumber, buildOrderMessage(lines, details, gstRateBps)));
      onSent();
    } catch {
      setOpenError("WhatsApp didn't open. Install WhatsApp, or call the café to place your order.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[s.sheet, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Only iOS presents this as a card; Android shows it full screen. */}
        {Platform.OS === 'ios' ? <View style={[s.grabber, { backgroundColor: colors.border }]} /> : null}
        <View style={[s.sheetHeader, { paddingTop: Platform.OS === 'ios' ? Spacing[2] : insets.top + Spacing[2] }]}>
          <View style={s.sheetHeading}>
            <Text style={[s.sheetTitle, { color: colors.text, fontFamily: fonts.display }]}>Your order</Text>
            {lines.length > 0 ? (
              <Text style={[s.sheetSummary, { color: colors.textMuted, fontFamily: fonts.body }]}>{summary}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.6}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {paid ? (
          <ScrollView contentContainerStyle={[s.sheetBody, { paddingBottom: insets.bottom + Spacing[6] }]}>
            <View accessibilityLiveRegion="polite" style={[s.paidBox, { backgroundColor: colors.primaryBg }]}>
              <View style={s.paidHead}>
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                <Text style={[s.paidTitle, { color: colors.onPrimaryBg, fontFamily: fonts.bodySemibold }]}>
                  Paid {rupeesFromPaise(paid.amountPaise)}. Thank you!
                </Text>
              </View>
              <Text style={[s.paidText, { color: colors.onPrimaryBg, fontFamily: fonts.body }]}>
                Your order number is{' '}
                <Text style={{ fontFamily: fonts.bodySemibold }}>{paid.orderNumber}</Text>. Show it at the counter when
                you pick up.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => void Linking.openURL(whatsappOrderUrl(whatsappNumber, paid.message)).catch(() => {})}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={[s.sendBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={colors.textOnPrimary} />
              <Text style={[s.sendText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                Send it to the café on WhatsApp
              </Text>
            </TouchableOpacity>
            <Text style={[s.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
              So the kitchen can start on it right away.
            </Text>
            <TouchableOpacity onPress={onNewOrder} hitSlop={8} accessibilityRole="button" style={s.clearBtn}>
              <Text style={[s.clearText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Start a new order</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : lines.length === 0 ? (
          <EmptyState
            icon="bag-outline"
            title="Your order is empty"
            body="Tap Add on anything in the menu, then send the order on WhatsApp."
            actionLabel="Back to the menu"
            onAction={onClose}
          />
        ) : (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.sheetBody, { paddingBottom: insets.bottom + Spacing[6] }]}
          >
            <View style={[s.linesCard, { backgroundColor: colors.surface }, CardEdge]}>
              {lines.map((line, index) => {
                const amount = lineTotal(line);
                return (
                  <View
                    key={line.key}
                    style={[s.line, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  >
                    <View style={s.lineInfo}>
                      <Text style={[s.lineName, { color: colors.text, fontFamily: fonts.bodyMedium }]}>{line.name}</Text>
                      <Text style={[s.lineEach, { color: colors.textMuted, fontFamily: fonts.body }]}>
                        {line.unitPrice === null ? 'MRP' : `${rupees(line.unitPrice)} each`}
                      </Text>
                    </View>
                    <View style={s.lineEnd}>
                      <QtyStepper
                        label={line.name}
                        quantity={line.quantity}
                        onChange={(quantity) => onQuantity(line, quantity)}
                      />
                      <Text style={[s.lineAmount, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                        {amount === null ? 'MRP' : rupees(amount)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <View style={[s.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[s.totalLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Items total</Text>
                <View style={s.totalValue}>
                  <Text style={[s.totalLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{rupees(total)}</Text>
                  {hasMrp ? (
                    <Text style={[s.lineEach, { color: colors.textMuted, fontFamily: fonts.body }]}>+ MRP items</Text>
                  ) : null}
                  {gstRateBps > 0 && !payOnline ? (
                    <Text style={[s.lineEach, { color: colors.textMuted, fontFamily: fonts.body }]}>
                      + {formatGstRate(gstRateBps)} GST
                    </Text>
                  ) : null}
                </View>
              </View>
              {payOnline && gst.taxPaise > 0 ? (
                <>
                  <View style={s.gstRow}>
                    <Text style={[s.lineEach, { color: colors.textMuted, fontFamily: fonts.body }]}>
                      GST ({formatGstRate(gstRateBps)})
                    </Text>
                    <Text style={[s.lineEach, { color: colors.text, fontFamily: fonts.body }]}>{rupeesFromPaise(gst.taxPaise)}</Text>
                  </View>
                  <View style={s.gstRow}>
                    <Text style={[s.totalLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>To pay</Text>
                    <Text style={[s.totalLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                      {rupeesFromPaise(gst.totalPaise)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityRole="button" style={s.clearBtn}>
              <Text style={[s.clearText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>Clear cart</Text>
            </TouchableOpacity>

            <View
              style={s.pairRow}
              onLayout={(e) => {
                trackY('name')(e);
                trackY('phone')(e);
              }}
            >
              <Field label="Name" error={errors.name} style={s.half}>
                <TextInput
                  ref={nameRef}
                  value={details.name}
                  onChangeText={(name) => update({ name })}
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                  autoComplete="name"
                  textContentType="name"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  submitBehavior="submit"
                  style={[inputStyle, borderFor('name')]}
                />
              </Field>

              <Field label="Mobile" error={errors.phone} style={s.half}>
                <TextInput
                  ref={phoneRef}
                  value={details.phone}
                  onChangeText={(phone) => update({ phone })}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  style={[inputStyle, borderFor('phone')]}
                />
              </Field>
            </View>

            <Field label="Delivery or pickup">
              <View style={s.choiceRow}>
                <Choice label="Delivery" selected={delivery} onPress={() => update({ fulfilment: 'delivery' })} />
                <Choice label="Pickup at café" selected={!delivery} onPress={() => update({ fulfilment: 'pickup' })} />
              </View>
              {!delivery ? (
                <Text style={[s.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  Collect it from {pickupAddress}.
                </Text>
              ) : null}
            </Field>

            {pickupOnline ? (
              <Field label="Payment">
                <View style={s.choiceRow}>
                  <Choice
                    label="Pay online now"
                    selected={payOnline}
                    disabled={!!onlineBlock}
                    onPress={() => onPayment('online')}
                  />
                  <Choice label="Order on WhatsApp" selected={!payOnline} onPress={() => onPayment('whatsapp')} />
                </View>
              </Field>
            ) : null}
            <Text style={[s.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
              {delivery
                ? 'Delivery orders are paid in advance: we confirm your order and the delivery charge on WhatsApp and share the payment details.'
                : payOnline
                  ? "Paid online in advance: UPI, cards or net banking, through Razorpay. You'll get an order number to show at the counter."
                  : `${onlineBlock ? `${onlineBlock} ` : ''}We confirm your order on WhatsApp and share the payment details. Please pay in advance, before you collect.`}
            </Text>

            {delivery ? (
              <Field label="Full delivery address" error={errors.address} onLayout={trackY('address')}>
                <TextInput
                  ref={addressRef}
                  value={details.address}
                  onChangeText={(address) => update({ address })}
                  placeholder="Flat, building, street, area, landmark"
                  placeholderTextColor={colors.textMuted}
                  autoComplete="street-address"
                  textContentType="fullStreetAddress"
                  multiline
                  textAlignVertical="top"
                  style={[inputStyle, s.multiline, borderFor('address')]}
                />
              </Field>
            ) : null}

            <Field label="Preferred time" error={errors.time} onLayout={trackY('time')}>
              <View style={s.choiceRow}>
                <Choice label="As soon as possible" selected={details.time === null} onPress={() => update({ time: null })} />
                <Choice
                  label="At a time"
                  selected={details.time !== null}
                  onPress={() => {
                    if (details.time === null) update({ time: '' });
                  }}
                />
              </View>
              {details.time !== null ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.slotRow}>
                  {slots.map((slot) => {
                    const picked = details.time === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        onPress={() => update({ time: slot })}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: picked }}
                        style={[
                          s.slot,
                          picked
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            s.slotText,
                            { color: picked ? colors.textOnPrimary : colors.text, fontFamily: fonts.bodyMedium },
                          ]}
                        >
                          {formatClock(slot)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
            </Field>

            <Field label="Notes (optional)">
              <TextInput
                value={details.notes}
                onChangeText={(notes) => update({ notes })}
                placeholder="Less spicy, no onion, which bowl the add-on goes with…"
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                multiline
                textAlignVertical="top"
                style={[inputStyle, s.multiline, { borderColor: colors.border }]}
              />
            </Field>

            <TouchableOpacity
              onPress={() => void send()}
              disabled={paying}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: paying, busy: paying }}
              style={[s.sendBtn, { backgroundColor: colors.primary, opacity: paying ? 0.7 : 1 }]}
            >
              {paying ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Ionicons name={payOnline ? 'card-outline' : 'logo-whatsapp'} size={18} color={colors.textOnPrimary} />
              )}
              <Text style={[s.sendText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                {payOnline ? (paying ? 'Opening payment…' : `Pay ${rupeesFromPaise(gst.totalPaise)} now`) : 'Send order on WhatsApp'}
              </Text>
            </TouchableOpacity>
            {openError ? (
              <Text style={[s.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{openError}</Text>
            ) : null}

            <View style={s.notes}>
              {delivery ? (
                <Text style={[s.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  Delivery is free within 3 km of our Prahladnagar café; further away, we&apos;ll share the Porter charge.
                </Text>
              ) : null}
              <Text style={[s.hint, { color: colors.text, fontFamily: fonts.bodyMedium }]}>
                {onlinePayment
                  ? 'All café orders are paid in advance: pickup online here or on WhatsApp, delivery on WhatsApp.'
                  : 'All café orders are paid in advance: we share the payment details on WhatsApp.'}
              </Text>
            </View>

            {sent ? (
              <View accessibilityLiveRegion="polite" style={[s.sentBox, { backgroundColor: colors.primaryBg }]}>
                <Text style={[s.hint, { color: colors.onPrimaryBg, fontFamily: fonts.bodySemibold }]}>
                  WhatsApp opened with your order. Press Send there to place it.
                </Text>
                <Text style={[s.hint, { color: colors.onPrimaryBg, fontFamily: fonts.body }]}>
                  All done?{' '}
                  <Text onPress={onClear} style={{ color: colors.primary, fontFamily: fonts.bodySemibold }}>
                    Clear cart
                  </Text>
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
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

  itemRow: { flexDirection: 'row', gap: Spacing[3], paddingHorizontal: Spacing[3.5], paddingVertical: Spacing[3.5] },
  itemInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  itemName: { flexShrink: 1, fontSize: FontSize.base },
  badge: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 9.5, lineHeight: 12 },
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

  addOns: { margin: Spacing[2.5], marginTop: 0, borderRadius: Radius.md, padding: Spacing[3], gap: Spacing[2] },
  addOnsTitle: { fontSize: 10.5, letterSpacing: 0.8 },
  addOnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  addOnName: { flex: 1, fontSize: FontSize.sm },
  addOnPrice: { fontSize: FontSize.sm },

  bar: { paddingTop: Spacing[3] },
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

  sheet: { flex: 1 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: Spacing[2] },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  sheetHeading: { flex: 1, gap: 1 },
  sheetTitle: { fontSize: FontSize.xl },
  sheetSummary: { fontSize: FontSize.xs },
  sheetBody: { paddingHorizontal: Spacing[5], paddingTop: Spacing[1], gap: Spacing[4] },

  linesCard: { borderRadius: Radius.lg, paddingHorizontal: Spacing[3.5] },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], paddingVertical: Spacing[3] },
  lineInfo: { flex: 1, gap: 2 },
  lineName: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.snug },
  lineEach: { fontSize: FontSize.xs },
  lineEnd: { alignItems: 'flex-end', gap: 4 },
  lineAmount: { fontSize: FontSize.sm },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: FontSize.base },
  totalValue: { alignItems: 'flex-end' },
  clearBtn: { alignSelf: 'flex-start', marginTop: -Spacing[2] },
  clearText: { fontSize: FontSize.xs, textDecorationLine: 'underline' },

  field: { gap: 6 },
  pairRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  half: { flex: 1 },
  fieldLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldError: { fontSize: FontSize.xs },
  input: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, fontSize: FontSize.base },
  multiline: { minHeight: 84, paddingTop: 12, paddingBottom: 12 },
  choiceRow: { flexDirection: 'row', gap: Spacing[2] },
  choice: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { fontSize: FontSize.sm, textAlign: 'center' },
  slotRow: { gap: 6, paddingTop: 4 },
  slot: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  slotText: { fontSize: FontSize.sm },
  hint: { fontSize: FontSize.xs, lineHeight: FontSize.xs * LineHeight.normal },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 50,
    borderRadius: Radius.full,
    marginTop: Spacing[1],
  },
  sendText: { fontSize: FontSize.base },
  notes: { gap: 6 },
  sentBox: { borderRadius: Radius.md, padding: Spacing[3], gap: 4 },
  gstRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: Spacing[2] },
  paidBox: { borderRadius: Radius.md, padding: Spacing[4], gap: Spacing[2] },
  paidHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  paidTitle: { fontSize: FontSize.base },
  paidText: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.normal },
});
