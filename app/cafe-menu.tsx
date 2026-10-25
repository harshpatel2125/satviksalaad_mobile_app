import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/skeleton';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
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
  openStatus,
  parseCart,
  rupees,
  toMinutes,
  validateOrder,
  whatsappOrderUrl,
  type CafeItem,
  type CafeMenuData,
  type CafeMenuResponse,
  type CafeSection,
  type CartLine,
  type DietMark,
  type OpeningHours,
  type Orderable,
  type OrderDetails,
  type OrderField,
} from '@/lib/cafe-order';
import { toWhatsAppNumber } from '@/lib/contact-actions';
import { readAddressesCache } from '@/lib/home-cache';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import { storage } from '@/lib/storage';
import { useSupportContact } from '@/lib/support-contact';

type DietMarks = CafeMenuData['dietMarks'];
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
    queryFn: () => apiFetch<CafeMenuResponse>('/api/v1/cafe/menu'),
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

  const [category, setCategory] = useState<string | null>(null);
  const [only, setOnly] = useState<DietMark[]>([]);
  const [details, setDetails] = useState<OrderDetails>(EMPTY_DETAILS);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(() => new Date());
  const [sent, setSent] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [filtersTop, setFiltersTop] = useState(0);

  const sections = (menu?.sections ?? [])
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => only.every((mark) => item.marks?.includes(mark))),
    }))
    .filter((section) => section.items.length > 0);
  const activeCategory = sections.some((section) => section.id === category) ? category : null;
  const shown = activeCategory ? sections.filter((section) => section.id === activeCategory) : sections;

  const status = menu ? openStatus(new Date(), menu.outlet.hours) : null;

  function setQuantity(orderable: Orderable, quantity: number) {
    const next = Math.max(0, Math.min(MAX_QUANTITY, quantity));
    setEdited((current) => {
      const { [orderable.key]: _previous, ...rest } = current ?? quantities;
      return next > 0 ? { ...rest, [orderable.key]: next } : rest;
    });
  }

  function clearCart() {
    setEdited({});
    setSent(false);
  }

  function pickCategory(id: string | null) {
    setCategory(id);
    if (scrollY.current > filtersTop) scrollRef.current?.scrollTo({ y: filtersTop, animated: false });
  }

  function toggleMark(mark: DietMark) {
    setOnly((current) => (current.includes(mark) ? current.filter((m) => m !== mark) : [...current, mark]));
  }

  function openCheckout() {
    setDetails((current) => ({
      ...current,
      name: current.name || profile?.full_name?.trim() || '',
      phone: current.phone || profile?.phone || '',
      address: current.address || defaultAddressText(session?.user?.id),
    }));
    setOpenedAt(new Date());
    setCheckoutOpen(true);
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Café menu"
        subtitle={status ? `${status.isOpen ? 'Open now' : 'Closed'}${status.detail ? ` · ${status.detail}` : ''}` : undefined}
        onBack={() => router.back()}
      />

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
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={32}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: count > 0 ? Spacing[6] : insets.bottom + Spacing[6] }}
          >
            <View style={s.intro} onLayout={(e) => setFiltersTop(e.nativeEvent.layout.height)}>
              <Text style={[s.introText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Add what you&apos;d like and send the order on WhatsApp for delivery or pickup. All orders are paid in
                advance: we confirm your order on WhatsApp and share the payment details.
              </Text>
              <View style={s.legend}>
                {MARKS.map((mark) => (
                  <View key={mark} style={s.legendItem}>
                    <MarkBadge mark={mark} dietMarks={menu.dietMarks} />
                    <Text style={[s.legendText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                      {menu.dietMarks[mark]?.label}
                    </Text>
                  </View>
                ))}
                <Text style={[s.legendText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  kcal and protein per serving where listed · prices in ₹
                </Text>
              </View>
            </View>

            <View style={[s.filters, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {[{ id: null, title: 'All' }, ...sections].map((section) => {
                  const active = activeCategory === section.id;
                  return (
                    <TouchableOpacity
                      key={section.id ?? 'all'}
                      onPress={() => pickCategory(section.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        s.chip,
                        active
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipText,
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
              <View style={s.dietRow}>
                <Text style={[s.dietLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>Show only</Text>
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
                      {on ? <Ionicons name="checkmark" size={12} color={colors.onPrimaryBg} /> : null}
                      <Text
                        style={[
                          s.dietChipText,
                          { color: on ? colors.onPrimaryBg : colors.text, fontFamily: fonts.bodySemibold },
                        ]}
                      >
                        {menu.dietMarks[mark]?.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.list}>
              {sections.length === 0 ? (
                <View style={[s.noMatch, { borderColor: colors.border }]}>
                  <Text style={[s.noMatchText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    Nothing on the menu carries all of those marks.
                  </Text>
                  <TouchableOpacity onPress={() => setOnly([])} accessibilityRole="button" hitSlop={8}>
                    <Text style={[s.noMatchText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                      Show everything
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                shown.map((section) => (
                  <View key={section.id} style={s.section}>
                    <View style={[s.sectionHead, { borderBottomColor: colors.border }]}>
                      <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.display }]}>
                        {section.title}
                      </Text>
                      <Text style={[s.sectionCount, { color: colors.textMuted, fontFamily: fonts.body }]}>
                        {plural(section.items.length, 'item')}
                      </Text>
                    </View>
                    {section.items.map((item) => (
                      <ItemCard
                        key={item.name}
                        sectionId={section.id}
                        item={item}
                        dietMarks={menu.dietMarks}
                        quantities={quantities}
                        onChange={setQuantity}
                      />
                    ))}
                    {section.addOns?.length ? (
                      <AddOns section={section} quantities={quantities} onChange={setQuantity} />
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {count > 0 ? (
            <BottomActionBar flexible style={s.bar}>
              <View style={s.barRow}>
                <View style={s.barText}>
                  <Text style={[s.barLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>Your order</Text>
                  <Text style={[s.barSummary, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{summary}</Text>
                </View>
                <TouchableOpacity
                  onPress={openCheckout}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  style={[s.reviewBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[s.reviewText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                    Review & send
                  </Text>
                </TouchableOpacity>
              </View>
            </BottomActionBar>
          ) : null}

          <CheckoutSheet
            visible={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            lines={lines}
            total={total}
            summary={summary}
            onQuantity={setQuantity}
            onClear={clearCart}
            details={details}
            onDetails={(patch) => setDetails((current) => ({ ...current, ...patch }))}
            hours={menu.outlet.hours}
            pickupAddress={menu.outlet.addressText}
            openedAt={openedAt}
            whatsappNumber={whatsappNumber}
            sent={sent}
            onSent={() => setSent(true)}
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
        <Ionicons name="add" size={15} color={colors.primary} />
        <Text style={[s.addText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Add</Text>
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

function ItemCard({
  sectionId,
  item,
  dietMarks,
  quantities,
  onChange,
}: {
  sectionId: string;
  item: CafeItem;
  dietMarks: DietMarks;
  quantities: Record<string, number>;
  onChange: SetQuantity;
}) {
  const { colors, fonts } = useTheme();
  const nutrition = [item.kcal && `${item.kcal} kcal`, item.proteinG && `${item.proteinG} g protein`]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
      <View style={s.nameRow}>
        <Text style={[s.itemName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{item.name}</Text>
        {item.marks?.map((mark) => <MarkBadge key={mark} mark={mark} dietMarks={dietMarks} />)}
      </View>
      {nutrition ? (
        <Text style={[s.nutrition, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>{nutrition}</Text>
      ) : null}
      {item.ingredients ? (
        <Text style={[s.ingredients, { color: colors.textMuted, fontFamily: fonts.body }]}>{item.ingredients}</Text>
      ) : null}
      <View style={s.priceRows}>
        {itemOrderables(sectionId, item).map((orderable) => (
          <View key={orderable.key} style={s.priceRow}>
            <View style={s.priceWrap}>
              {orderable.variant ? (
                <Text style={[s.variant, { color: colors.textMuted, fontFamily: fonts.body }]}>{orderable.variant}</Text>
              ) : null}
              <Text style={[s.price, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                {orderable.unitPrice === null ? 'MRP' : rupees(orderable.unitPrice)}
              </Text>
            </View>
            <QtyStepper
              label={orderable.name}
              quantity={quantities[orderable.key] ?? 0}
              onChange={(quantity) => onChange(orderable, quantity)}
            />
          </View>
        ))}
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
      <Text style={[s.addOnsTitle, { color: colors.onPrimaryBg, fontFamily: fonts.bodySemibold }]}>Add on</Text>
      {(section.addOns ?? []).map((addOn) => {
        const orderable = addOnOrderable(section, addOn);
        return (
          <View key={orderable.key} style={[s.addOnRow, { backgroundColor: colors.surface }]}>
            <Text style={[s.addOnName, { color: colors.text, fontFamily: fonts.body }]}>
              {addOn.name}{' '}
              <Text style={{ color: colors.primary, fontFamily: fonts.bodySemibold }}>{rupees(addOn.price)}</Text>
            </Text>
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

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[
        s.choice,
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
  children,
}: {
  label: string;
  error?: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View onLayout={onLayout} style={s.field}>
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
}: CheckoutSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [errors, setErrors] = useState<Partial<Record<OrderField, string>>>({});
  const [attempted, setAttempted] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<OrderField, number>>>({});
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const delivery = details.fulfilment === 'delivery';
  const hasMrp = lines.some((line) => line.unitPrice === null);
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

  async function send() {
    const found = validateOrder(details, hours);
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
    try {
      await Linking.openURL(whatsappOrderUrl(whatsappNumber, buildOrderMessage(lines, details)));
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

        {lines.length === 0 ? (
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
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityRole="button" style={s.clearBtn}>
              <Text style={[s.clearText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>Clear cart</Text>
            </TouchableOpacity>

            <Field label="Name" error={errors.name} onLayout={trackY('name')}>
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

            <Field label="Mobile number" error={errors.phone} onLayout={trackY('phone')}>
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
              activeOpacity={0.85}
              accessibilityRole="button"
              style={[s.sendBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={colors.textOnPrimary} />
              <Text style={[s.sendText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                Send order on WhatsApp
              </Text>
            </TouchableOpacity>
            {openError ? (
              <Text style={[s.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{openError}</Text>
            ) : null}

            <View style={s.notes}>
              <Text style={[s.hint, { color: colors.textMuted, fontFamily: fonts.body }]}>
                We confirm your order, and the delivery range for deliveries, on WhatsApp. Delivery is free within 3 km of
                our Prahladnagar café; further away, we&apos;ll share the Porter charge.
              </Text>
              <Text style={[s.hint, { color: colors.text, fontFamily: fonts.bodyMedium }]}>
                All café orders are paid in advance, once we confirm them on WhatsApp.
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

  intro: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[3], gap: Spacing[2.5] },
  introText: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.normal },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing[3], rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: FontSize.xs },

  filters: { paddingVertical: Spacing[2.5], gap: Spacing[2], borderBottomWidth: StyleSheet.hairlineWidth },
  chipRow: { paddingHorizontal: Spacing[5], gap: 6 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { fontSize: FontSize.sm },
  dietRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: Spacing[5] },
  dietLabel: { fontSize: FontSize.xs, marginRight: 2 },
  dietChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dietChipText: { fontSize: FontSize.xs },

  list: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[6] },
  noMatch: {
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[6],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noMatchText: { fontSize: FontSize.sm, textAlign: 'center' },

  section: { gap: Spacing[2.5] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing[3],
    paddingBottom: Spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: FontSize.xl },
  sectionCount: { fontSize: FontSize.xs },

  card: { borderRadius: Radius.lg, padding: Spacing[3.5], gap: 4 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  itemName: { flexShrink: 1, fontSize: FontSize.md },
  badge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12 },
  nutrition: { fontSize: FontSize.xs },
  ingredients: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.snug },
  priceRows: { gap: 6, marginTop: Spacing[2] },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[2] },
  priceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  variant: { fontSize: FontSize.xs },
  price: { fontSize: FontSize.md },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  addText: { fontSize: FontSize.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: Radius.full },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepQty: { minWidth: 18, textAlign: 'center', fontSize: FontSize.sm },
  dimmed: { opacity: 0.4 },

  addOns: { borderRadius: Radius.md, padding: Spacing[3], gap: Spacing[2] },
  addOnsTitle: { fontSize: FontSize.sm },
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingLeft: Spacing[3],
    paddingRight: 6,
  },
  addOnName: { flexShrink: 1, fontSize: FontSize.sm },

  bar: { paddingTop: Spacing[3] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  barText: { flex: 1 },
  barLabel: { fontSize: FontSize.xs },
  barSummary: { fontSize: FontSize.base },
  reviewBtn: { height: 42, paddingHorizontal: Spacing[5], borderRadius: Radius.full, justifyContent: 'center' },
  reviewText: { fontSize: FontSize.sm },

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
});
