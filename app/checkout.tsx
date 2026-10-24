import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/text';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { ScreenHeader } from '@/components/ui/screen-header';

import { Skeleton } from "@/components/skeleton";
import { Brand, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/alert';
import { useAuth } from '@/context/auth';
import { ApiError, addressesApi, authHeader, ordersApi, paymentsApi, plansApi, subscriptionsApi } from '@/lib/api';
import { readAddressesCache } from '@/lib/home-cache';
import { queryClient } from '@/lib/query-client';
import { trackCheckoutStarted, trackCouponApplied, trackCouponRemoved, trackPaymentInitiated, trackPaymentCancelled, trackPaymentFailed } from '@/lib/analytics';
import { useTheme } from '@/hooks/use-theme';
import { slotLabel, useSlots } from '@/lib/slots';
import { useDietaryOptions } from '@/lib/dietary-options';
import { ProfileCompletionSheet } from '@/components/screens/checkout/profile-completion-sheet';
import { refusalText } from '@/components/screens/subscriptions/subscription-info';
import { countOf, daysText, formatDay } from '@/lib/subscription-view';
import type { DeliveryAddress, Plan } from '@/types/api';
import { getAppConfig } from '@/lib/app-config';
import { isPhoneEmail, phoneFromEmail } from '@/lib/phone-email';
import { DEFAULT_DELIVERY_DAYS } from '@/lib/delivery-rules';
import { BASE_URL } from '@/lib/base-url';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  valid_until: string | null;
}

interface CouponState {
  code: string;
  discountPaise: number;
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Dietary options that set the plan's style; "Regular" is having neither.
const STYLE_KEYS = ['high_protein', 'disease_friendly'] as const;
type PlanStyle = 'regular' | (typeof STYLE_KEYS)[number];

function isStyleKey(key: string): key is (typeof STYLE_KEYS)[number] {
  return (STYLE_KEYS as readonly string[]).includes(key);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const { colors, fonts } = useTheme();
  const slots = useSlots();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { profile, user, session, refreshProfile } = useAuth();
  const userId = session?.user?.id ?? null;

  const {
    planId,
    days: daysParam,
    slot: slotParam,
  } = useLocalSearchParams<{
    planId: string;
    days: string;
    slot: string;
  }>();

  const preferredDays = daysParam ? daysParam.split(',') : [...DEFAULT_DELIVERY_DAYS];
  const deliverySlot = slotParam ?? 'noon';

  const [plan, setPlan] = useState<Plan | null>(null);
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [loading, setLoading] = useState(true);

  const [couponInput, setCouponInput] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponState | null>(null);

  const [paying, setPaying] = useState(false);
  const [publicCoupons, setPublicCoupons] = useState<PublicCoupon[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const dietaryOptions = useDietaryOptions();
  const styleOptions = dietaryOptions.flatMap((o) => (isStyleKey(o.key) ? [{ key: o.key as PlanStyle, label: o.label }] : []));
  // Only a plan that sells the choice offers it; a high-protein plan shows its one style.
  const styleChoices: { key: PlanStyle; label: string }[] = plan?.style_choice
    ? styleOptions
    : plan?.is_high_protein
      ? styleOptions.filter((o) => o.key === 'high_protein')
      : [];
  const cookingOptions = dietaryOptions.filter((o) => !isStyleKey(o.key));
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedDietaryKeys, setSelectedDietaryKeys] = useState<string[]>([]);
  const [chosenStyle, setChosenStyle] = useState<PlanStyle>('regular');
  const toggleDietaryKey = (key: string) =>
    setSelectedDietaryKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  const planStyle: PlanStyle = plan?.style_choice
    ? chosenStyle === 'regular' ? 'high_protein' : chosenStyle
    : plan?.is_high_protein ? 'high_protein' : 'regular';

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['subscription-preview', planId, preferredDays.join(','), deliverySlot],
    queryFn: () => subscriptionsApi.preview({ planId, preferredDays, timeSlotId: deliverySlot }),
    enabled: !!planId,
    staleTime: 60 * 1000,
    retry: false,
  });
  const refusal = preview && !preview.can_buy ? refusalText(preview) : null;
  // A customer who already holds a subscription keeps their days, time and
  // address for every new one; the server ignores the ones sent.
  const shared = preview?.your_schedule ?? null;
  const shownDays = shared?.preferred_days.length ? shared.preferred_days : preferredDays;
  const shownSlot = shared?.delivery_slot ?? deliverySlot;

  const isPhoneUser = isPhoneEmail(user?.email);
  const derivedPhone = isPhoneUser
    ? phoneFromEmail(user?.email)
    : null;
  const effectivePhone = profile?.phone ?? derivedPhone ?? null;
  const needsPhone = !effectivePhone;
  const needsName  = !profile?.full_name;
  const profileComplete = !needsPhone && !needsName;

  const trackedCheckout = useRef(false);
  useEffect(() => {
    if (!plan || trackedCheckout.current) return;
    trackedCheckout.current = true;
    trackCheckoutStarted(plan.id, plan.bowls_count, Math.round(plan.price_paise / 100));
  }, [plan]);

  useEffect(() => {
    async function load() {
      try {
        const [plansRes, addrsRes] = await Promise.all([
          plansApi.list(),
          addressesApi.list().catch(() => null),
        ]);

        const found = plansRes.data.find((p) => p.id === planId);
        setPlan(found ?? null);

        if (addrsRes?.data) {
          const def = addrsRes.data.find((a) => a.is_default) ?? addrsRes.data[0] ?? null;
          setAddress(def);
        }

        const offersRes = await fetch(`${BASE_URL}/api/v1/coupons/public`, { credentials: 'omit' })
          .then((r) => r.json() as Promise<{ success: boolean; data?: PublicCoupon[] }>)
          .catch(() => null);
        if (offersRes?.success && offersRes.data) setPublicCoupons(offersRes.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [planId]);

  // On focus: re-sync address from MMKV so changes made in select-mode address list reflect instantly
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      const cached = readAddressesCache(userId);
      if (cached && cached.length > 0) {
        const def = cached.find((a) => a.is_default) ?? cached[0];
        setAddress(def ?? null);
      }
    }, [userId]),
  );

  const baseTotalPaise = plan?.price_paise ?? 0;
  const discount = appliedCoupon?.discountPaise ?? 0;
  const finalPaise = Math.max(0, baseTotalPaise - discount);
  const baseRs = Math.round(baseTotalPaise / 100);
  const discountRs = Math.round(discount / 100);
  const finalRs = Math.round(finalPaise / 100);

  // ── Coupon ────────────────────────────────────────────────────────────────

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          ...(await authHeader()),
        },
        body: JSON.stringify({ code, amountPaise: baseTotalPaise, planId }),
      });
      const json = await res.json();
      if (json.success) {
        setAppliedCoupon({
          code: json.code,
          discountPaise: json.discountPaise,
          description: json.description ?? `${json.code} applied`,
        });
        trackCouponApplied(json.code as string, Math.round((json.discountPaise as number) / 100));
      } else {
        setCouponError(json.error ?? 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError('Could not validate coupon. Try again.');
    } finally {
      setValidatingCoupon(false);
    }
  }

  function removeCoupon() {
    if (appliedCoupon) trackCouponRemoved(appliedCoupon.code);
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  }

  // ── Pay ───────────────────────────────────────────────────────────────────

  async function handlePay() {
    if (!plan) return;
    const name = profile?.full_name ?? '';
    const phone = effectivePhone ?? '';
    if (!name || !phone) {
      setSheetVisible(true);
      return;
    }
    if (!address) {
      showAlert(
        'Delivery address required',
        'Please add a delivery address before placing your order.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add address', onPress: () => router.push('/add-address') },
        ],
      );
      return;
    }

    setPaying(true);
    let orderId = '';
    let finalAmountPaise = 0;
    const dietaryPreferences = [
      ...(plan.style_choice && planStyle !== 'regular' ? [planStyle] : []),
      ...selectedDietaryKeys,
    ];
    try {
      // Sent for a renewal too: if the running subscription closes before the
      // payment lands, this one starts as the head and books on these.
      const orderRes = await ordersApi.create({
        planId: plan.id,
        timeSlotId: deliverySlot,
        name,
        mobile: phone,
        area: address.area,
        address: address.full_address,
        preferredDays: preferredDays.length ? preferredDays : [...DEFAULT_DELIVERY_DAYS],
        specialInstructions: specialInstructions.trim() || undefined,
        dietaryPreferences: dietaryPreferences.length ? dietaryPreferences : undefined,
      });
      orderId = orderRes.orderId;
      const successParams = (amountRs: number, dates: { starts_on: string; ends_on: string }) => ({
        orderId: orderRes.orderId,
        planName: plan.name,
        amountRs: String(amountRs),
        startsOn: dates.starts_on,
        endsOn: dates.ends_on,
        renewal: orderRes.renewal ? 'true' : 'false',
        unit: plan.unit?.singular ?? 'bowl',
      });

      const payRes = await paymentsApi.createRazorpayOrder(
        orderRes.orderId,
        appliedCoupon?.code,
      );

      const { razorpayOrderId, finalAmountPaise: resolvedPaise } = payRes.data;
      finalAmountPaise = resolvedPaise;
      trackPaymentInitiated(plan.id, Math.round(finalAmountPaise / 100));

      if (finalAmountPaise === 0) {
        router.push({ pathname: '/payment-success', params: successParams(0, orderRes) });
        return;
      }

      const paymentData = await RazorpayCheckout.open({
        key: getAppConfig().razorpayKeyId,
        amount: finalAmountPaise,
        currency: 'INR',
        name: 'Satvik Salaad',
        description: plan.name,
        order_id: razorpayOrderId,
        prefill: { name, contact: phone },
        theme: { color: Brand.forest },
        modal: { handleback: true },
      });

      let verified: Awaited<ReturnType<typeof paymentsApi.verify>>;
      try {
        verified = await paymentsApi.verify({
          razorpayOrderId,
          razorpayPaymentId: paymentData.razorpay_payment_id,
          razorpaySignature: paymentData.razorpay_signature ?? '',
          orderId: orderRes.orderId,
        });
      } catch {
        // Razorpay has already taken the money; its webhook still activates the subscription.
        void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        void queryClient.invalidateQueries({ queryKey: ['home'] });
        showAlert(
          'Payment received, confirming…',
          'Your subscription will show in a few minutes. No need to pay again.',
          [{ text: 'View my subscription', onPress: () => router.replace('/subscriptions') }],
        );
        return;
      }
      router.push({
        pathname: '/payment-success',
        params: successParams(Math.round(finalAmountPaise / 100), verified.subscription ?? orderRes),
      });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'trial_used' || err.code === 'renewal_exists')) {
        void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        void queryClient.invalidateQueries({ queryKey: ['subscription-preview'] });
        showAlert("Can't buy this plan", err.message, [{ text: 'See plans', onPress: () => router.back() }]);
        return;
      }
      // Razorpay SDK rejects with { code, description } on cancel (code 2) or failure.
      // Don't show an error alert when the user deliberately closes the payment sheet.
      const razorpayErr = err as { code?: number; description?: string };
      const isCancelled = razorpayErr.code === 2 ||
        razorpayErr.description?.toLowerCase().includes('cancel') ||
        razorpayErr.description?.toLowerCase().includes('dismissed');
      if (isCancelled) {
        trackPaymentCancelled(plan.id, Math.round(finalAmountPaise / 100));
        if (orderId) paymentsApi.cancelOrder(orderId).catch(() => {});
      } else {
        const reason = razorpayErr.description ?? (err instanceof Error ? err.message : 'unknown');
        trackPaymentFailed(plan.id, Math.round(finalAmountPaise / 100), reason);
        showAlert('Payment failed', razorpayErr.description ?? (err instanceof Error ? err.message : 'Payment failed. Please try again.'));
      }
    } finally {
      setPaying(false);
    }
  }

  function couponChipLabel(c: PublicCoupon): string {
    if (c.discount_type === 'percentage') return `${c.discount_value}% OFF`;
    return `₹${Math.round(c.discount_value / 100)} OFF`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const planEmoji = plan?.category === 'fruit' ? '🍎' : '🥗';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Review Order" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Spacing[4], paddingBottom: Spacing[5] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Plan banner card ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.planBanner,
            { backgroundColor: colors.primary, marginHorizontal: Spacing[5] },
            Shadows.sm,
          ]}
        >
          <View
            style={[
              styles.planBannerOverlay,
              { backgroundColor: "rgba(0,0,0,0.08)" },
            ]}
          />
          <View style={styles.planBannerContent}>
            <View style={styles.planBannerLeft}>
              <Text style={styles.planBannerEmoji}>{planEmoji}</Text>
              <View style={{ gap: 4 }}>
                {loading ? (
                  <Skeleton
                    width={120}
                    height={18}
                    radius={5}
                    baseColor="rgba(255,255,255,0.20)"
                    shimmerColor="rgba(255,255,255,0.38)"
                  />
                ) : (
                  <Text
                    style={[
                      styles.planBannerName,
                      { fontFamily: fonts.display },
                    ]}
                  >
                    {plan?.name ?? "—"}
                  </Text>
                )}
                <Text
                  style={[styles.planBannerMeta, { fontFamily: fonts.body }]}
                >
                  {plan ? countOf(plan.bowls_count, plan.unit) : ' '}
                </Text>
              </View>
            </View>
            <View style={styles.planBannerRight}>
              {loading ? (
                <Skeleton
                  width={56}
                  height={22}
                  radius={5}
                  baseColor="rgba(255,255,255,0.20)"
                  shimmerColor="rgba(255,255,255,0.38)"
                />
              ) : (
                <Text
                  style={[
                    styles.planBannerPrice,
                    { fontFamily: fonts.display },
                  ]}
                >
                  ₹{baseRs}
                </Text>
              )}
              <Text
                style={[styles.planBannerPriceSub, { fontFamily: fonts.body }]}
              >
                base price
              </Text>
            </View>
          </View>
        </View>

        {/* ── Delivery details ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              marginHorizontal: Spacing[5],
            },
          ]}
        >
          <Text
            style={[
              styles.cardLabel,
              { color: colors.textMuted, fontFamily: fonts.bodySemibold },
            ]}
          >
            DELIVERING TO
          </Text>
          <View style={styles.infoGrid}>
            {[
              {
                icon: "person-outline",
                label: "Name",
                value: profile?.full_name ?? "—",
              },
              ...(effectivePhone
                ? [
                    {
                      icon: "call-outline",
                      label: "Mobile",
                      value: effectivePhone,
                    },
                  ]
                : []),
              {
                icon: "time-outline",
                label: "Slot",
                value: slotLabel(shownSlot, slots),
              },
              {
                icon: "calendar-outline",
                label: "Days",
                value: daysText(shownDays),
              },
            ].map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    { backgroundColor: colors.surface2 },
                  ]}
                >
                  <Ionicons
                    name={row.icon as never}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.infoLabel,
                      { color: colors.textMuted, fontFamily: fonts.body },
                    ]}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: colors.text, fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {shared ? (
            <Text style={[styles.cardNote, { color: colors.textMuted, fontFamily: fonts.body }]}>
              Everything comes on the same days, time and address. Change them in Deliveries.
            </Text>
          ) : null}
        </View>

        {previewLoading || preview ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: refusal ? colors.errorBg : colors.surface,
                borderWidth: 1,
                borderColor: refusal ? colors.error + "30" : colors.border,
                marginHorizontal: Spacing[5],
              },
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>
              YOUR SUBSCRIPTION
            </Text>
            {previewLoading ? (
              <View style={styles.infoGrid}>
                <Skeleton width={180} height={13} radius={4} />
                <Skeleton width={150} height={13} radius={4} />
              </View>
            ) : refusal ? (
              <View style={styles.refusalRow}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={[styles.refusalText, { color: colors.error, fontFamily: fonts.body }]}>
                  {refusal}
                </Text>
              </View>
            ) : preview ? (
              <>
                <View style={styles.infoGrid}>
                  {[
                    { icon: "play-circle-outline", label: "Starts", value: formatDay(preview.starts_on) },
                    { icon: "calendar-outline", label: "Valid till", value: formatDay(preview.ends_on) },
                    { icon: "hourglass-outline", label: "If you skip, it may run until", value: formatDay(preview.last_allowed_on) },
                  ].map((row) => (
                    <View key={row.label} style={styles.infoRow}>
                      <View style={[styles.infoIcon, { backgroundColor: colors.surface2 }]}>
                        <Ionicons name={row.icon as never} size={14} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>
                          {row.label}
                        </Text>
                        <Text style={[styles.infoValue, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                          {row.value}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                {preview.after ? (
                  <Text style={[styles.cardNote, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    Starts after your {preview.after.plan_name} ends on {formatDay(preview.after.ends_on)}.
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {/* ── Phone required card (shown first) ────────────────────────────── */}
        {needsPhone && (
          <TouchableOpacity
            style={[
              styles.card,
              styles.phoneCard,
              {
                backgroundColor: colors.primaryBg,
                borderColor: colors.primary + "30",
                marginHorizontal: Spacing[5],
                padding: Spacing[3],
              },
            ]}
            onPress={() => setSheetVisible(true)}
            activeOpacity={0.82}
          >
            <View
              style={[
                styles.phoneCardIcon,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Ionicons name="call-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[
                  styles.phoneCardTitle,
                  { color: colors.text, fontFamily: fonts.bodySemibold },
                ]}
              >
                Add your mobile number
              </Text>
              <Text
                style={[
                  styles.phoneCardSub,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {"Our agent calls if they can't find you - plus live updates on WhatsApp."}
              </Text>
            </View>
            <View
              style={[styles.phoneCardBtn, { backgroundColor: colors.primary }]}
            >
              <Text
                style={[
                  styles.phoneCardBtnText,
                  { fontFamily: fonts.bodySemibold },
                ]}
              >
                Add
              </Text>
              <Ionicons name="arrow-forward" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Delivery address card (shown second) ─────────────────────────── */}
        {address ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                marginHorizontal: Spacing[5],
              },
            ]}
          >
            <View style={styles.addressCardRow}>
              <View style={styles.addressCardLeft}>
                <Text style={[styles.cardLabel, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>
                  DELIVERY ADDRESS
                </Text>
                <Text
                  style={[styles.addrMain, { color: colors.text, fontFamily: fonts.bodySemibold }]}
                  numberOfLines={3}
                >
                  {shared?.address ?? address.full_address}
                </Text>
                {!shared && (address.label || address.city || address.pincode) ? (
                  <Text style={[styles.addrSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    {[address.label, address.city, address.pincode].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {!shared && address.landmark ? (
                  <Text style={[styles.addrSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    Near {address.landmark}
                  </Text>
                ) : null}
              </View>
              {shared ? null : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.addrChangeBtn}
                  onPress={() => router.push({ pathname: '/addresses', params: { selectMode: 'true' } })}
                >
                  <Ionicons name="pencil-outline" size={12} color={colors.primary} />
                  <Text style={[styles.addrChangeBtnText, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
                    Change
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.card,
              styles.phoneCard,
              {
                backgroundColor: colors.primaryBg,
                borderColor: colors.primary + "30",
                marginHorizontal: Spacing[5],
                padding: Spacing[3],
              },
            ]}
            onPress={() => router.push('/add-address')}
            activeOpacity={0.82}
          >
            <View style={[styles.phoneCardIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.phoneCardTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                Add delivery address
              </Text>
              <Text style={[styles.phoneCardSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
                Required to complete your order
              </Text>
            </View>
            <View style={[styles.phoneCardBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.phoneCardBtnText, { fontFamily: fonts.bodySemibold }]}>Add</Text>
              <Ionicons name="arrow-forward" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Promo code ────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              marginHorizontal: Spacing[5],
            },
          ]}
        >
          <Text
            style={[
              styles.cardLabel,
              { color: colors.textMuted, fontFamily: fonts.bodySemibold },
            ]}
          >
            PROMO CODE
          </Text>

          {/* Available public offers */}
          {publicCoupons.length > 0 && !appliedCoupon && (
            <View style={{ marginBottom: Spacing[3] }}>
              <Text
                style={{
                  fontSize: FontSize.xs,
                  color: colors.textMuted,
                  marginBottom: Spacing[2],
                  fontFamily: fonts.bodyMedium,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Available Offers
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {publicCoupons.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setCouponInput(c.code);
                      setCouponError("");
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: Radius.full,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      backgroundColor: colors.primaryTint,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="pricetag-outline"
                      size={12}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        fontSize: FontSize.xs,
                        fontFamily: fonts.bodySemibold,
                        color: colors.primary,
                      }}
                    >
                      {c.code}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: fonts.body,
                        color: colors.textMuted,
                      }}
                    >
                      {couponChipLabel(c)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {appliedCoupon ? (
            <View
              style={[
                styles.couponApplied,
                {
                  backgroundColor: colors.successBg,
                  borderColor: colors.success + "40",
                },
              ]}
            >
              <View style={styles.couponAppliedLeft}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.success}
                />
                <View>
                  <Text
                    style={[
                      styles.couponCode,
                      { color: colors.text, fontFamily: fonts.bodySemibold },
                    ]}
                  >
                    {appliedCoupon.code}
                  </Text>
                  <Text
                    style={[
                      styles.couponSaving,
                      { color: colors.success, fontFamily: fonts.body },
                    ]}
                  >
                    You save ₹{discountRs}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={removeCoupon} activeOpacity={0.7}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.couponRow}>
                <View
                  style={[
                    styles.couponInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: couponError ? colors.error : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={15}
                    color={colors.textMuted}
                  />
                  <TextInput
                    style={[
                      styles.couponTextInput,
                      { color: colors.text, fontFamily: fonts.body },
                    ]}
                    value={couponInput}
                    onChangeText={(t) => {
                      setCouponInput(t.toUpperCase());
                      setCouponError("");
                    }}
                    placeholder="Enter code"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleApplyCoupon}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.applyBtn,
                    {
                      backgroundColor: couponInput.trim()
                        ? colors.primary
                        : colors.surface2,
                      opacity: validatingCoupon ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleApplyCoupon}
                  disabled={!couponInput.trim() || validatingCoupon}
                  activeOpacity={0.8}
                >
                  {validatingCoupon ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      style={[
                        styles.applyBtnText,
                        {
                          color: couponInput.trim() ? "#fff" : colors.textMuted,
                          fontFamily: fonts.bodySemibold,
                        },
                      ]}
                    >
                      Apply
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {couponError ? (
                <Text
                  style={[
                    styles.couponErr,
                    { color: colors.error, fontFamily: fonts.body },
                  ]}
                >
                  {couponError}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {styleChoices.length > 0 && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                marginHorizontal: Spacing[5],
              },
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>
              PLAN STYLE
            </Text>
            <View style={styles.dietaryRow}>
              {styleChoices.map((opt) => {
                const active = planStyle === opt.key;
                const locked = !plan?.style_choice && !active;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.dietaryChip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surface2, borderColor: 'transparent' },
                      locked && { opacity: 0.45 },
                    ]}
                    onPress={() => setChosenStyle(opt.key)}
                    disabled={!plan?.style_choice}
                    hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={14}
                      color={active ? '#fff' : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.dietaryChipText,
                        {
                          color: active ? '#fff' : colors.textMuted,
                          fontFamily: active ? fonts.bodySemibold : fonts.body,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.cardNote, { color: colors.textMuted, fontFamily: fonts.body }]}>
              {plan?.is_high_protein
                ? 'Every bowl in this plan is high-protein.'
                : 'Our dietitian plans your bowls around this.'}
            </Text>
          </View>
        )}

        {/* ── Cooking notes ─────────────────────────────────────────────────── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              marginHorizontal: Spacing[5],
            },
          ]}
        >
          <Text
            style={[
              styles.cardLabel,
              { color: colors.textMuted, fontFamily: fonts.bodySemibold },
            ]}
          >
            COOKING NOTES (OPTIONAL)
          </Text>

          {cookingOptions.length > 0 && (
            <View style={styles.dietaryRow}>
              {cookingOptions.map((opt) => {
                const active = selectedDietaryKeys.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.dietaryChip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surface2, borderColor: 'transparent' },
                    ]}
                    onPress={() => toggleDietaryKey(opt.key)}
                    hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={active ? '#fff' : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.dietaryChipText,
                        {
                          color: active ? '#fff' : colors.textMuted,
                          fontFamily: active ? fonts.bodySemibold : fonts.body,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TextInput
            style={[
              styles.notesTextArea,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.border,
                color: colors.text,
                fontFamily: fonts.body,
              },
            ]}
            multiline
            maxLength={300}
            placeholder="Anything you'd like the kitchen to know..."
            placeholderTextColor={colors.textMuted}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            textAlignVertical="top"
          />
        </View>

        {/* ── Price breakdown ───────────────────────────────────────────────── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              marginHorizontal: Spacing[5],
            },
          ]}
        >
          <Text
            style={[
              styles.cardLabel,
              { color: colors.textMuted, fontFamily: fonts.bodySemibold },
            ]}
          >
            ORDER SUMMARY
          </Text>

          <View style={styles.breakdownRows}>
            {loading ? (
              <>
                <View style={styles.skeletonPriceRow}>
                  <Skeleton width={160} height={13} radius={4} />
                  <Skeleton width={48} height={13} radius={4} />
                </View>
                <View style={styles.skeletonPriceRow}>
                  <Skeleton width={72} height={13} radius={4} />
                  <Skeleton width={36} height={13} radius={4} />
                </View>
              </>
            ) : (
              <>
                <PriceRow
                  label={`${plan?.name ?? "Plan"} (${countOf(plan?.bowls_count ?? 0, plan?.unit)})`}
                  value={`₹${Math.round((plan?.price_paise ?? 0) / 100)}`}
                  colors={colors}
                  fonts={fonts}
                />
                <PriceRow
                  label="Delivery"
                  value="Free within 10 km"
                  valueColor={colors.primary}
                  colors={colors}
                  fonts={fonts}
                />
                {discount > 0 && (
                  <PriceRow
                    label={`Coupon (${appliedCoupon?.code})`}
                    value={`−₹${discountRs}`}
                    valueColor={colors.success}
                    colors={colors}
                    fonts={fonts}
                  />
                )}
              </>
            )}
          </View>

          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text
              style={[
                styles.totalLabel,
                { color: colors.text, fontFamily: fonts.bodySemibold },
              ]}
            >
              Total
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              {loading ? (
                <Skeleton width={64} height={24} radius={5} />
              ) : (
                <>
                  {discount > 0 && (
                    <Text
                      style={[
                        styles.totalStrike,
                        { color: colors.textMuted, fontFamily: fonts.body },
                      ]}
                    >
                      ₹{baseRs}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.totalAmount,
                      { color: colors.text, fontFamily: fonts.display },
                    ]}
                  >
                    ₹{finalRs}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky pay bar ────────────────────────────────────────────────── */}
      <BottomActionBar>
        <View style={styles.payBarInner}>
          <View>
            <Text
              style={[
                styles.payBarLabel,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              Total due today
            </Text>
            {loading ? (
              <Skeleton
                width={72}
                height={28}
                radius={6}
                style={{ marginTop: 2 }}
              />
            ) : (
              <Text
                style={[
                  styles.payBarAmount,
                  { color: colors.text, fontFamily: fonts.display },
                ]}
              >
                ₹{finalRs}
              </Text>
            )}
          </View>
          {!profileComplete ? (
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.primary }]}
              onPress={() => setSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={14} color="#fff" />
              <Text
                style={[styles.payBtnText, { fontFamily: fonts.bodySemibold }]}
              >
                {needsPhone ? "Add mobile to continue" : "Add name to continue"}
              </Text>
            </TouchableOpacity>
          ) : !address ? (
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/add-address')}
              activeOpacity={0.85}
            >
              <Ionicons name="location-outline" size={14} color="#fff" />
              <Text style={[styles.payBtnText, { fontFamily: fonts.bodySemibold }]}>
                Add address to continue
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.payBtn,
                {
                  backgroundColor:
                    loading || paying || refusal ? colors.textMuted : colors.primary,
                },
              ]}
              onPress={handlePay}
              disabled={loading || paying || !!refusal}
              activeOpacity={0.85}
            >
              {paying && (
                <ActivityIndicator size="small" color="#fff" style={StyleSheet.absoluteFill} />
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2], opacity: paying ? 0 : 1 }}>
                <Ionicons name="lock-closed" size={14} color="#fff" />
                <Text style={[styles.payBtnText, { fontFamily: fonts.bodySemibold }]}>
                  Pay ₹{finalRs}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </BottomActionBar>

      <ProfileCompletionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onComplete={async () => {
          setSheetVisible(false);
          await refreshProfile();
        }}
        needsPhone={needsPhone}
        needsName={needsName}
      />
    </View>
  );
}

// ─── Price row sub-component ──────────────────────────────────────────────────

function PriceRow({
  label,
  value,
  valueColor,
  colors,
  fonts,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof import('@/hooks/use-theme').useTheme>['colors'];
  fonts: ReturnType<typeof import('@/hooks/use-theme').useTheme>['fonts'];
}) {
  return (
    <View style={priceRowStyles.row}>
      <Text style={[priceRowStyles.label, { color: colors.textMuted, fontFamily: fonts.body }]}>
        {label}
      </Text>
      <Text style={[priceRowStyles.value, { color: valueColor ?? colors.text, fontFamily: fonts.bodyMedium }]}>
        {value}
      </Text>
    </View>
  );
}

const priceRowStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  label:     { fontSize: FontSize.sm, flex: 1 },
  value:     { fontSize: FontSize.sm },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { gap: Spacing[4] },

  // Plan banner
  planBanner: { borderRadius: Radius.xl, overflow: "hidden" },
  planBannerOverlay: { ...StyleSheet.absoluteFillObject },
  planBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing[5],
  },
  planBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    flex: 1,
  },
  planBannerEmoji: { fontSize: 36 },
  planBannerName: { fontSize: FontSize.lg, color: "#fff", letterSpacing: -0.3 },
  planBannerMeta: {
    fontSize: FontSize.xs,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  planBannerRight: { alignItems: "flex-end", flexShrink: 0 },
  planBannerPrice: {
    fontSize: FontSize["2xl"],
    color: "#fff",
    letterSpacing: -0.5,
  },
  planBannerPriceSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },

  // Card
  card: {
    borderRadius: Radius.xl,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  cardLabel: { fontSize: 11, letterSpacing: 0.6 },
  cardNote: { fontSize: FontSize.xs, lineHeight: FontSize.xs * 1.5 },
  refusalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2] },
  refusalText: { flex: 1, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.5 },

  // Cooking notes
  dietaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  dietaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dietaryChipText: { fontSize: FontSize.xs },
  notesTextArea: {
    height: 72,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing[3],
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.55,
  },

  // Phone required card
  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    borderWidth: 1,
  },
  phoneCardIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  phoneCardTitle: { fontSize: FontSize.sm },
  phoneCardSub: { fontSize: FontSize.xs, lineHeight: 15 },
  phoneCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  phoneCardBtnText: { fontSize: FontSize.xs, color: "#fff" },

  // Delivery info
  infoGrid: { gap: Spacing[3] },
  infoRow: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoLabel: { fontSize: 10, marginBottom: 1 },
  infoValue: { fontSize: FontSize.sm },

  // Address card
  addressCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  addressCardLeft: { flex: 1, gap: 3 },
  addrMain: { fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.45 },
  addrSub: { fontSize: FontSize.xs, lineHeight: FontSize.xs * 1.4 },
  addrChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: 'transparent' },
  addrChangeBtnText: { fontSize: FontSize.xs },

  // Coupon
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing[3],
    gap: Spacing[2],
  },
  couponAppliedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    flex: 1,
  },
  couponCode: { fontSize: FontSize.sm },
  couponSaving: { fontSize: FontSize.xs, marginTop: 1 },
  couponRow: { flexDirection: "row", gap: Spacing[2] },
  couponInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
  },
  couponTextInput: {
    flex: 1,
    fontSize: FontSize.sm,
    padding: 0,
    letterSpacing: 1,
  },
  applyBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.md,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { fontSize: FontSize.sm },
  couponErr: { fontSize: FontSize.xs, marginTop: Spacing[1] },

  // Price breakdown
  breakdownRows: { gap: 0 },
  skeletonPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing[3],
    marginTop: Spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: FontSize.base },
  totalStrike: {
    fontSize: FontSize.xs,
    textDecorationLine: "line-through",
    marginBottom: 1,
  },
  totalAmount: { fontSize: FontSize["2xl"], letterSpacing: -0.5 },


  payBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payBarLabel: { fontSize: FontSize.xs, marginBottom: 2 },
  payBarAmount: { fontSize: FontSize["2xl"], letterSpacing: -0.5 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3.25],
    borderRadius: Radius.full,
  },
  payBtnText: { fontSize: FontSize.base, color: "#fff" },
});
