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
import type { Plan } from '@/types/api';

// ─── Shared helpers (exported for use in main screen) ────────────────────────

/** Same rule as the website: the trial is the launch offer, the popular plan the best value. */
export function planBadge(plan: Plan): { label: string; tone: 'gold' | 'green' } | null {
  if (/trial/i.test(plan.slug ?? plan.name)) return { label: 'Launch offer', tone: 'gold' };
  if (plan.is_popular) return { label: 'Best value', tone: 'green' };
  return null;
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


export function pricePerMeal(plan: Plan): number {
  return plan.price_per_meal_paise ?? Math.round(plan.price_paise / plan.total_meals);
}

// The server refuses an order with more extra meals than this.
const MAX_EXTRA_MEALS = 20;

function canAddMeal(plan: Plan, mealCount: number): boolean {
  return mealCount < plan.total_meals + MAX_EXTRA_MEALS;
}

export function totalFor(plan: Plan, mealCount: number): number {
  const extra = Math.max(0, mealCount - plan.total_meals);
  return plan.price_paise + extra * pricePerMeal(plan);
}

// ─── Animated Press Card wrapper ─────────────────────────────────────────────

export function AnimatedCard({
  onPress,
  style,
  children,
  enterDelay = 0,
}: {
  onPress: () => void;
  style?: ViewStyle;
  children: React.ReactNode;
  enterDelay?: number;
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
          activeOpacity={1}>
          {children}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Hero Plan Card (Monthly Salad) ──────────────────────────────────────────

const BRAND_HERO = Brand.forest;

export function HeroPlanCard({
  plan,
  isSelected,
  mealCount,
  onSelect,
  onMealCountChange,
  enterDelay,
}: {
  plan: Plan;
  isSelected: boolean;
  mealCount: number;
  onSelect: (p: Plan) => void;
  onMealCountChange: (n: number) => void;
  enterDelay: number;
}) {
  const { fonts } = useTheme();
  const planRs    = Math.round(plan.price_paise / 100);
  const perMealRs = Math.round(pricePerMeal(plan) / 100);

  const borderOpacity = useSharedValue(isSelected ? 1 : 0);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: withTiming(isSelected ? 0.08 : 0.03, { duration: 250 }),
    shadowRadius:  withTiming(isSelected ? 10 : 4,     { duration: 250 }),
  }));

  useEffect(() => {
    borderOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, borderOpacity]);

  return (
    <AnimatedCard onPress={() => onSelect(plan)} enterDelay={enterDelay}>
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
            ₹{planRs}
          </Text>
          <View style={heroStyles.priceRight}>
            <Text style={[heroStyles.priceLabel, { fontFamily: fonts.bodyMedium }]}>
              total
            </Text>
            <Text style={[heroStyles.perMeal, { fontFamily: fonts.body }]}>
              ₹{perMealRs}/meal
            </Text>
          </View>
        </View>

        {/* Features */}
        <View style={heroStyles.featuresGrid}>
          {(plan.features?.length ? plan.features : ['Fresh daily', 'Never expires', 'Free within 5 km']).slice(0, 3).map((f, i) => (
            <View key={i} style={heroStyles.featureItem}>
              <View style={heroStyles.featureCheck}>
                <Ionicons name="checkmark" size={10} color={Brand.forest} />
              </View>
              <Text style={[heroStyles.featureText, { fontFamily: fonts.body }]}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Bottom row: meal count + stepper */}
        <View style={heroStyles.bottomRow}>
          <View style={heroStyles.mealCountPill}>
            <Ionicons name="restaurant-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={[heroStyles.mealCountText, { fontFamily: fonts.bodyMedium }]}>
              {plan.total_meals} meals
            </Text>
          </View>
          {isSelected && plan.duration !== 'trial' && (
            <Animated.View
              entering={FadeInDown.delay(50).springify()}
              style={heroStyles.stepper}>
              <TouchableOpacity
                style={[heroStyles.stepBtn, mealCount <= plan.total_meals && heroStyles.stepBtnDisabled]}
                onPress={() => onMealCountChange(Math.max(plan.total_meals, mealCount - 1))}
                disabled={mealCount <= plan.total_meals}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="remove" size={15} color={mealCount > plan.total_meals ? '#fff' : 'rgba(255,255,255,0.35)'} />
              </TouchableOpacity>
              <Text style={[heroStyles.stepCount, { fontFamily: fonts.display }]}>
                {mealCount}
              </Text>
              <TouchableOpacity
                style={[heroStyles.stepBtn, !canAddMeal(plan, mealCount) && heroStyles.stepBtnDisabled]}
                onPress={() => onMealCountChange(mealCount + 1)}
                disabled={!canAddMeal(plan, mealCount)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add" size={15} color={canAddMeal(plan, mealCount) ? '#fff' : 'rgba(255,255,255,0.35)'} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
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
  perMeal:    { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)' },
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
  mealCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  mealCountText: { fontSize: FontSize.sm, color: '#fff' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  stepBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  stepCount: { fontSize: FontSize.base, color: '#fff', minWidth: 24, textAlign: 'center' },
});

// ─── Standard Plan Card (Weekly Salad) ───────────────────────────────────────

export function StandardPlanCard({
  plan,
  isSelected,
  mealCount,
  onSelect,
  onMealCountChange,
  enterDelay,
}: {
  plan: Plan;
  isSelected: boolean;
  mealCount: number;
  onSelect: (p: Plan) => void;
  onMealCountChange: (n: number) => void;
  enterDelay: number;
}) {
  const { colors, fonts } = useTheme();
  const planRs    = Math.round(plan.price_paise / 100);
  const perMealRs = Math.round(pricePerMeal(plan) / 100);
  // The meta line already gives the count, so a feature that only restates it is skipped.
  const highlight = plan.features?.find((f) => !/^\d+\s+(meals?|salads?|bowls?)$/i.test(f.trim())) ?? null;

  return (
    <AnimatedCard onPress={() => onSelect(plan)} enterDelay={enterDelay}>
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
              {plan.total_meals} meals · ₹{perMealRs}/meal
            </Text>
            {highlight ? (
              <Text style={[stdStyles.planFeature, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {highlight}
              </Text>
            ) : null}
          </View>
          <View style={stdStyles.priceCol}>
            <Text style={[stdStyles.price, { color: isSelected ? colors.primaryDark : colors.text, fontFamily: fonts.display }]}>
              ₹{planRs}
            </Text>
            <Text style={[stdStyles.priceSub, { color: colors.textMuted, fontFamily: fonts.body }]}>total</Text>
          </View>
        </View>

        {/* Stepper strip (only when selected) */}
        {isSelected && plan.duration !== 'trial' && (
          <Animated.View
            entering={FadeInDown.delay(50).springify()}
            style={[stdStyles.stepperStrip, { borderTopColor: colors.primary + '22' }]}>
            <View style={stdStyles.stepperLeft}>
              <Ionicons name="restaurant-outline" size={13} color={colors.primaryDark} />
              <Text style={[stdStyles.stepperLabel, { color: colors.primaryDark, fontFamily: fonts.bodyMedium }]}>
                Meals in this plan
              </Text>
            </View>
            <View style={stdStyles.stepperControls}>
              <TouchableOpacity
                style={[stdStyles.stepBtn, {
                  backgroundColor: mealCount <= plan.total_meals ? colors.surface2 : colors.primaryBg,
                  borderColor: mealCount <= plan.total_meals ? colors.border : colors.primary,
                }]}
                onPress={() => onMealCountChange(Math.max(plan.total_meals, mealCount - 1))}
                disabled={mealCount <= plan.total_meals}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="remove" size={15} color={mealCount <= plan.total_meals ? colors.textMuted : colors.primary} />
              </TouchableOpacity>
              <View style={[stdStyles.stepCount, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[stdStyles.stepCountNum, { color: colors.text, fontFamily: fonts.display }]}>
                  {mealCount}
                </Text>
              </View>
              <TouchableOpacity
                style={[stdStyles.stepBtn, canAddMeal(plan, mealCount)
                  ? { backgroundColor: colors.primaryBg, borderColor: colors.primary }
                  : { backgroundColor: colors.surface2, borderColor: colors.border }]}
                onPress={() => onMealCountChange(mealCount + 1)}
                disabled={!canAddMeal(plan, mealCount)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add" size={15} color={canAddMeal(plan, mealCount) ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
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
  stepperStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[4], paddingVertical: 12, borderTopWidth: 1,
  },
  stepperLeft:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperLabel:   { fontSize: FontSize.sm },
  stepperControls:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32, height: 32, borderRadius: Radius.md, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCount:    { minWidth: 44, height: 32, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  stepCountNum: { fontSize: FontSize.base },
});

// ─── Fruit Plan Card ──────────────────────────────────────────────────────────

export function FruitPlanCard({
  plan,
  isSelected,
  mealCount,
  onSelect,
  onMealCountChange,
  enterDelay,
}: {
  plan: Plan;
  isSelected: boolean;
  mealCount: number;
  onSelect: (p: Plan) => void;
  onMealCountChange: (n: number) => void;
  enterDelay: number;
}) {
  const { fonts, isDark } = useTheme();
  const planRs    = Math.round(plan.price_paise / 100);
  const perMealRs = Math.round(pricePerMeal(plan) / 100);

  const amber       = '#F59E0B';
  const amberBg     = isDark
    ? (isSelected ? '#211800' : '#1A1300')
    : (isSelected ? '#FEF3C7' : '#FFFBEB');
  const amberBorder = isDark
    ? (isSelected ? '#C97A0A' : '#3A2800')
    : (isSelected ? '#F59E0B' : '#FDE68A');
  const amberDark   = isDark ? '#FCD34D' : '#92400E';
  const amberMeta   = isDark ? '#D97706' : '#B45309';
  const stepperBg   = isDark ? '#2A1E00' : '#FEF3C7';
  const stepDivider = isDark ? '#3A2800' : '#FDE68A';

  return (
    <AnimatedCard onPress={() => onSelect(plan)} enterDelay={enterDelay}>
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
              {plan.is_popular && (
                <View style={[fruitStyles.badge, { backgroundColor: amber }]}>
                  <Text style={[fruitStyles.badgeText, { fontFamily: fonts.bodySemibold }]}>Popular</Text>
                </View>
              )}
            </View>
            <Text style={[fruitStyles.meta, { color: amberMeta, fontFamily: fonts.body }]}>
              {plan.total_meals} servings · ₹{perMealRs}/serving
            </Text>
            {plan.features?.[0] && (
              <Text style={[fruitStyles.feature, { color: amberMeta, fontFamily: fonts.body }]}>
                {plan.features[0]}
              </Text>
            )}
          </View>
          <View style={fruitStyles.priceCol}>
            <Text style={[fruitStyles.price, { color: amberDark, fontFamily: fonts.display }]}>
              ₹{planRs}
            </Text>
            <Text style={[fruitStyles.priceSub, { color: amberMeta, fontFamily: fonts.body }]}>total</Text>
          </View>
        </View>

        {isSelected && (
          <Animated.View
            entering={FadeInDown.delay(50).springify()}
            style={[fruitStyles.stepperStrip, { borderTopColor: stepDivider }]}>
            <Text style={[fruitStyles.stepLabel, { color: amberDark, fontFamily: fonts.bodyMedium }]}>
              Servings in this plan
            </Text>
            <View style={fruitStyles.stepperControls}>
              <TouchableOpacity
                style={[fruitStyles.stepBtn, {
                  backgroundColor: stepperBg,
                  borderColor: mealCount <= plan.total_meals ? stepDivider : amber,
                  opacity: mealCount <= plan.total_meals ? 0.5 : 1,
                }]}
                onPress={() => onMealCountChange(Math.max(plan.total_meals, mealCount - 1))}
                disabled={mealCount <= plan.total_meals}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="remove" size={15} color={amberDark} />
              </TouchableOpacity>
              <View style={[fruitStyles.stepCount, { borderColor: stepDivider, backgroundColor: isDark ? '#1A1300' : '#fff' }]}>
                <Text style={[fruitStyles.stepCountNum, { color: amberDark, fontFamily: fonts.display }]}>
                  {mealCount}
                </Text>
              </View>
              <TouchableOpacity
                style={[fruitStyles.stepBtn, {
                  backgroundColor: stepperBg,
                  borderColor: canAddMeal(plan, mealCount) ? amber : stepDivider,
                  opacity: canAddMeal(plan, mealCount) ? 1 : 0.5,
                }]}
                onPress={() => onMealCountChange(mealCount + 1)}
                disabled={!canAddMeal(plan, mealCount)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add" size={15} color={amberDark} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
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
  stepperStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[4], paddingVertical: 12, borderTopWidth: 1,
  },
  stepLabel:       { fontSize: FontSize.sm },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32, height: 32, borderRadius: Radius.md, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCount:    { minWidth: 44, height: 32, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  stepCountNum: { fontSize: FontSize.base },
});
