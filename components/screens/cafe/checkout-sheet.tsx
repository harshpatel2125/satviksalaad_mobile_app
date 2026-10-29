import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  type ViewStyle,
} from 'react-native';
import type { ScrollViewInstance, TextInputInstance } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Brand, CardEdge, FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, cafeApi } from '@/lib/api';
import { readRazorpayError } from '@/lib/razorpay-error';
import {
  buildOrderMessage,
  formatClock,
  istClock,
  lineTotal,
  onlinePaymentBlock,
  pickupTimeError,
  rupees,
  toMinutes,
  validateOrder,
  whatsappOrderUrl,
  type CartLine,
  type OpeningHours,
  type OrderDetails,
  type OrderField,
  type PaidCafeOrder,
  type PickupPayment,
} from '@/lib/cafe-order';
import { addGst, formatGstRate, rupeesFromPaise } from '@/lib/gst';
import { QtyStepper } from '@/components/screens/cafe/qty-stepper';
import type { SetQuantity } from '@/components/screens/cafe/types';

const FIELD_ORDER: OrderField[] = ['name', 'phone', 'address', 'time'];

const SLOT_MINUTES = 30;

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
  /** Off for people who order on WhatsApp without paying in the app: no payment wording at all. */
  askForPayment: boolean;
  payment: PickupPayment;
  onPayment: (payment: PickupPayment) => void;
  paid: PaidCafeOrder | null;
  onPaid: (order: PaidCafeOrder) => void;
  onNewOrder: () => void;
}

export function CheckoutSheet({
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
  askForPayment,
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

  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldY = useRef<Partial<Record<OrderField, number>>>({});
  const nameRef = useRef<TextInputInstance>(null);
  const phoneRef = useRef<TextInputInstance>(null);
  const addressRef = useRef<TextInputInstance>(null);

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
      const failure = readRazorpayError(err);
      if (!failure.cancelled) setOpenError(failure.message);
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
      const inputs: Partial<Record<OrderField, React.RefObject<TextInputInstance | null>>> = {
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
      await Linking.openURL(whatsappOrderUrl(whatsappNumber, buildOrderMessage(lines, details, gstRateBps, askForPayment)));
      onSent();
    } catch {
      setOpenError("WhatsApp didn't open. Install WhatsApp, or call the café to place your order.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[s.sheet, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              {!askForPayment
                ? 'We confirm your order on WhatsApp.'
                : delivery
                ? 'Delivery orders are paid in advance: we confirm your order and the delivery charge on WhatsApp and share the payment details.'
                : payOnline
                  ? "Paid online in advance: UPI, cards or net banking, through Razorpay. You'll get an order number to show at the counter."
                  : `${onlineBlock ? `${onlineBlock} ` : ''}We confirm your order on WhatsApp and share the payment details. We get your order ready once the payment is done.`}
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
              {askForPayment ? (
                <Text style={[s.hint, { color: colors.text, fontFamily: fonts.bodyMedium }]}>
                  {onlinePayment
                    ? 'All café orders are paid in advance: pickup online here or on WhatsApp, delivery on WhatsApp.'
                    : 'All café orders are paid in advance: we share the payment details on WhatsApp.'}
                </Text>
              ) : null}
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
