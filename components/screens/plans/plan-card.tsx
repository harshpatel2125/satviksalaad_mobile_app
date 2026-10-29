import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Brand, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_UNITS, countOf } from '@/lib/subscription-view';
import type { Plan } from '@/types/api';

// ─── Shared helpers (exported for use in main screen) ────────────────────────

/** The label the admin set on the plan, as on the website; an offer stands out in gold. */
export function planBadge(plan: Plan): { label: string; tone: 'gold' | 'green' } | null {
  if (!plan.badge) return null;
  return { label: plan.badge, tone: plan.is_trial || /offer/i.test(plan.badge) ? 'gold' : 'green' };
}

function PlanBadge({ plan, onDark = false }: { plan: Plan; onDark?: boolean }) {
  const { colors, fonts } = useTheme();
  const badge = planBadge(plan);
  if (!badge) return null;
  const gold = badge.tone === 'gold';
  return (
    <View
      style={[
        badgeStyles.badge,
        { backgroundColor: gold ? colors.accent : onDark ? colors.primaryBg : colors.primary },
      ]}
    >
      <Text
        style={[
          badgeStyles.text,
          { color: gold ? colors.onAccent : onDark ? colors.onPrimaryBg : colors.textOnPrimary, fontFamily: fonts.bodyBold },
        ]}
      >
        {badge.label.toUpperCase()}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 10, letterSpacing: 0.8 },
});

export function pricePerBowl(plan: Plan): number {
  return plan.price_per_bowl_paise ?? Math.round(plan.price_paise / Math.max(1, plan.bowls_count));
}

/** "6 bowls · ₹230/bowl" in the plan's own unit words. */
function countAndPrice(plan: Plan): string {
  const unit = plan.unit ?? DEFAULT_UNITS;
  return `${countOf(plan.bowls_count, unit)} · ₹${Math.round(pricePerBowl(plan) / 100)}/${unit.singular}`;
}

const FALLBACK_FEATURES = ['Fresh daily', '100% pure veg', 'Skip any day before its cutoff'];

function UnavailableNote({ text, onDark = false }: { text: string; onDark?: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={unavailableStyles.row}>
      <Ionicons name="lock-closed-outline" size={12} color={onDark ? 'rgba(255,255,255,0.85)' : colors.textMuted} />
      <Text
        style={[
          unavailableStyles.text,
          { color: onDark ? 'rgba(255,255,255,0.85)' : colors.textMuted, fontFamily: fonts.bodyMedium },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const unavailableStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  text: { fontSize: FontSize.xs, flexShrink: 1 },
});

// ─── Animated Press Card wrapper ─────────────────────────────────────────────

export function AnimatedCard({
  onPress,
  style,
  children,
  enterDelay = 0,
  disabled = false,
}: {
  onPress: () => void;
  style?: ViewStyle;
  children: React.ReactNode;
  enterDelay?: number;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).springify().damping(14).stiffness(120)}
      style={style}>
      <Animated.View style={animStyle}>
        <TouchableOpacity
          onPressIn={() => { scale.value = withSpring(0.975, { damping: 20, stiffness: 300 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
          onPress={onPress}
          disabled={disabled}
          style={disabled ? { opacity: 0.55 } : undefined}
          activeOpacity={1}>
          {children}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Hero Plan Card ──────────────────────────────────────────────────────────

const BRAND_HERO = Brand.forest;

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  onSelect: (p: Plan) => void;
  /** Why the plan cannot be chosen now; the card is then disabled. */
  unavailable?: string | null;
  enterDelay: number;
  /** "+ 5% GST" when GST is added at checkout. */
  gstNote?: string | null;
  /** "Save ₹600 vs Weekly Salad", when it is cheaper per item than a smaller plan. */
  savings?: string | null;
}

export function HeroPlanCard({ plan, isSelected, onSelect, unavailable, enterDelay, gstNote, savings }: PlanCardProps) {
  const { fonts } = useTheme();
  const planRs    = Math.round(plan.price_paise / 100);
  const perBowlRs = Math.round(pricePerBowl(plan) / 100);

  const borderOpacity = useSharedValue(isSelected ? 1 : 0);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: withTiming(isSelected ? 0.08 : 0.03, { duration: 250 }),
    shadowRadius:  withTiming(isSelected ? 10 : 4,     { duration: 250 }),
  }));

  useEffect(() => {
    borderOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, borderOpacity]);

  return (
    <AnimatedCard onPress={() => onSelect(plan)} enterDelay={enterDelay} disabled={!!unavailable}>
      <Animated.View style={[heroStyles.card, glowStyle, Shadows.sm]}>
        {/* Decorative blobs */}
        <View style={heroStyles.blob1} />
        <View style={heroStyles.blob2} />
        <View style={heroStyles.blob3} />

        {/* Top badges row */}
        <View style={heroStyles.badgesRow}>
          {planBadge(plan) ? <PlanBadge plan={plan} onDark /> : <View />}
          {isSelected ? (
            <View style={heroStyles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#fff" />
              <Text style={[heroStyles.selectedText, { fontFamily: fonts.bodySemibold }]}>
                Selected
              </Text>
            </View>
          ) : (
            <View style={heroStyles.unselectedBadge}>
              <View style={heroStyles.radioOuter}>
                <View style={heroStyles.radioInnerEmpty} />
              </View>
            </View>
          )}
        </View>

        {/* Plan name */}
        <Text style={[heroStyles.planName, { fontFamily: fonts.display }]}>
          {plan.name}
        </Text>
        {plan.description ? (
          <Text style={[heroStyles.planDesc, { fontFamily: fonts.body }]}>
            {plan.description}
          </Text>
        ) : (
          <Text style={[heroStyles.planDesc, { fontFamily: fonts.body }]}>
            Chef-crafted bowls · Always fresh · 100% Pure Veg
          </Text>
        )}

        {/* Price display */}
        <View style={heroStyles.priceRow}>
          <Text style={[heroStyles.priceMain, { fontFamily: fonts.display }]}>
            ₹{planRs.toLocaleString('en-IN')}
          </Text>
          <View style={heroStyles.priceRight}>
            <Text style={[heroStyles.priceLabel, { fontFamily: fonts.bodyMedium }]}>
              {gstNote ?? 'total'}
            </Text>
            <Text style={[heroStyles.perBowl, { fontFamily: fonts.body }]}>
              ₹{perBowlRs}/{(plan.unit ?? DEFAULT_UNITS).singular}
            </Text>
          </View>
        </View>
        {savings ? (
          <View style={heroStyles.savingsPill}>
            <Ionicons name="pricetag-outline" size={12} color={Brand.forest} />
            <Text style={[heroStyles.savingsText, { fontFamily: fonts.bodySemibold }]}>{savings}</Text>
          </View>
        ) : null}

        {/* Features */}
        <View style={heroStyles.featuresGrid}>
          {(plan.features?.length ? plan.features : FALLBACK_FEATURES).slice(0, 3).map((f, i) => (
            <View key={i} style={heroStyles.featureItem}>
              <View style={heroStyles.featureCheck}>
                <Ionicons name="checkmark" size={10} color={Brand.forest} />
              </View>
              <Text style={[heroStyles.featureText, { fontFamily: fonts.body }]}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={heroStyles.bottomRow}>
          <View style={heroStyles.bowlCountPill}>
            <Ionicons name="restaurant-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={[heroStyles.bowlCountText, { fontFamily: fonts.bodyMedium }]}>
              {countOf(plan.bowls_count, plan.unit)}
            </Text>
          </View>
        </View>
        {unavailable ? <UnavailableNote text={unavailable} onDark /> : null}
      </Animated.View>
    </AnimatedCard>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    backgroundColor: BRAND_HERO,
    padding: Spacing[5],
    overflow: 'hidden',
    shadowColor: BRAND_HERO,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  blob1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -50, right: -40,
  },
  blob2: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, right: 60,
  },
  blob3: {
    position: 'absolute', width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.04)', top: 30, left: -20,
  },
  badgesRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing[3],
  },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  selectedText: { fontSize: 11, color: '#fff' },
  unselectedBadge: { padding: 4 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioInnerEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },
  planName: {
    fontSize: FontSize['3xl'], color: '#fff', letterSpacing: -0.6, lineHeight: 34,
    marginBottom: 4,
  },
  planDesc: {
    fontSize: FontSize.xs, color: 'rgba(255,255,255,0.72)', lineHeight: 18,
    marginBottom: Spacing[4],
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  priceMain: {
    fontSize: FontSize['5xl'], color: '#fff', lineHeight: 44, letterSpacing: -1.5,
  },
  priceRight: { paddingBottom: 4, gap: 2 },
  priceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  perBowl:    { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)' },
  savingsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginBottom: Spacing[2],
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  savingsText: { fontSize: FontSize.xs, color: Brand.forest },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginBottom: Spacing[4] },
  featureItem:  { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  featureCheck: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.9)', flex: 1 },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 2,
  },
  bowlCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  bowlCountText: { fontSize: FontSize.sm, color: '#fff' },
});

// ─── Standard Plan Card ──────────────────────────────────────────────────────

export function StandardPlanCard({ plan, isSelected, onSelect, unavailable, enterDelay, gstNote, savings }: PlanCardProps) {
  const { colors, fonts } = useTheme();
  const planRs    = Math.round(plan.price_paise / 100);
  const units = ['meals?', 'salads?', 'bowls?', plan.unit?.singular, plan.unit?.plural].filter(Boolean).join('|');
  // The meta line already gives the count, so a feature that only restates it is skipped.
  const highlight = plan.features?.find((f) => !new RegExp(`^\\d+\\s+(${units})$`, 'i').test(f.trim())) ?? null;

  return (
    <AnimatedCard onPress={() => onSelect(plan)} enterDelay={enterDelay} disabled={!!unavailable}>
      <View style={[
        stdStyles.card,
        { backgroundColor: isSelected ? colors.primaryBg : colors.surface, borderWidth: 1, borderColor: isSelected ? colors.primary : colors.border },
      ]}>
        {/* Top row */}
        <View style={stdStyles.topRow}>
          <View style={[stdStyles.radioOuter, { borderColor: isSelected ? colors.primary : colors.border }]}>
            {isSelected && <View style={[stdStyles.radioInner, { backgroundColor: colors.primary }]} />}
          </View>
          <View style={stdStyles.planInfo}>
            <PlanBadge plan={plan} />
            <Text style={[stdStyles.planName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
              {plan.name}
            </Text>
            <Text style={[stdStyles.planMeta, { color: colors.textMuted, fontFamily: fonts.body }]}>
              {countAndPrice(plan)}
            </Text>
            {savings ? (
              <Text style={[stdStyles.planMeta, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>{savings}</Text>
            ) : null}
            {highlight ? (
              <Text style={[stdStyles.planFeature, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {highlight}
              </Text>
            ) : null}
            {unavailable ? <UnavailableNote text={unavailable} /> : null}
          </View>
          <View style={stdStyles.priceCol}>
            <Text style={[stdStyles.price, { color: isSelected ? colors.primaryDark : colors.text, fontFamily: fonts.display }]}>
              ₹{planRs.toLocaleString('en-IN')}
            </Text>
            <Text style={[stdStyles.priceSub, { color: colors.textMuted, fontFamily: fonts.body }]}>{gstNote ?? 'total'}</Text>
          </View>
        </View>

      </View>
    </AnimatedCard>
  );
}

const stdStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl, borderWidth: 1.5, overflow: 'hidden',
  },
  cardSelected: {},
  topRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[4],
  },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  radioInner: { width: 11, height: 11, borderRadius: 6 },
  planInfo: { flex: 1, gap: 3 },
  planName: { fontSize: FontSize.md },
  planMeta: { fontSize: FontSize.xs },
  planFeature: { fontSize: FontSize.xs, marginTop: 1 },
  priceCol: { alignItems: 'flex-end', flexShrink: 0 },
  price:    { fontSize: FontSize.xl, letterSpacing: -0.5 },
  priceSub: { fontSize: 10, marginTop: 2 },
});

// ─── Fruit Plan Card ──────────────────────────────────────────────────────────

export function FruitPlanCard({ plan, isSelected, onSelect, unavailable, enterDelay, gstNote, savings }: PlanCardProps) {
  const { fonts, isDark } = useTheme();
  const planRs    = Math.round(plan.price_paise / 100);

  const amber       = '#F59E0B';
  const amberBg     = isDark
    ? (isSelected ? '#211800' : '#1A1300')
    : (isSelected ? '#FEF3C7' : '#FFFBEB');
  const amberBorder = isDark
    ? (isSelected ? '#C97A0A' : '#3A2800')
    : (isSelected ? '#F59E0B' : '#FDE68A');
  const amberDark   = isDark ? '#FCD34D' : '#92400E';
  const amberMeta   = isDark ? '#D97706' : '#B45309';

  return (
    <AnimatedCard onPress={() => onSelect(plan)} enterDelay={enterDelay} disabled={!!unavailable}>
      <View style={[
        fruitStyles.card,
        { backgroundColor: amberBg, borderColor: amberBorder },
        isSelected && fruitStyles.cardSelected,
      ]}>
        {/* Decorative element */}
        <View style={[fruitStyles.deco, { backgroundColor: 'rgba(245,158,11,0.08)' }]} />

        <View style={fruitStyles.topRow}>
          {/* Radio */}
          <View style={[fruitStyles.radioOuter, { borderColor: isSelected ? amber : '#FCD34D' }]}>
            {isSelected && <View style={[fruitStyles.radioInner, { backgroundColor: amber }]} />}
          </View>
          <View style={fruitStyles.info}>
            <View style={fruitStyles.nameRow}>
              <Text style={[fruitStyles.planName, { color: amberDark, fontFamily: fonts.bodySemibold }]}>
                {plan.name}
              </Text>
              {plan.badge ? (
                <View style={[fruitStyles.badge, { backgroundColor: amber }]}>
                  <Text style={[fruitStyles.badgeText, { fontFamily: fonts.bodySemibold }]}>{plan.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[fruitStyles.meta, { color: amberMeta, fontFamily: fonts.body }]}>
              {countAndPrice(plan)}
            </Text>
            {savings ? (
              <Text style={[fruitStyles.meta, { color: amberMeta, fontFamily: fonts.bodySemibold }]}>{savings}</Text>
            ) : null}
            {plan.features?.[0] && (
              <Text style={[fruitStyles.feature, { color: amberMeta, fontFamily: fonts.body }]}>
                {plan.features[0]}
              </Text>
            )}
            {unavailable ? <UnavailableNote text={unavailable} /> : null}
          </View>
          <View style={fruitStyles.priceCol}>
            <Text style={[fruitStyles.price, { color: amberDark, fontFamily: fonts.display }]}>
              ₹{planRs.toLocaleString('en-IN')}
            </Text>
            <Text style={[fruitStyles.priceSub, { color: amberMeta, fontFamily: fonts.body }]}>{gstNote ?? 'total'}</Text>
          </View>
        </View>
      </View>
    </AnimatedCard>
  );
}

const fruitStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl, borderWidth: 1.5, overflow: 'hidden',
  },
  cardSelected: {
    shadowColor: Brand.forest, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6,
    elevation: 1,
  },
  deco: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    top: -30, right: -20,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[4],
  },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  radioInner: { width: 11, height: 11, borderRadius: 6 },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planName: { fontSize: FontSize.base },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: '#fff' },
  meta:    { fontSize: FontSize.xs },
  feature: { fontSize: FontSize.xs, marginTop: 1 },
  priceCol: { alignItems: 'flex-end', flexShrink: 0 },
  price:    { fontSize: FontSize.xl, letterSpacing: -0.5 },
  priceSub: { fontSize: 10, marginTop: 2 },
});
