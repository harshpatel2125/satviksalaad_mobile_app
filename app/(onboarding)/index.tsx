import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import type { ThemeColors } from '@/constants/theme';
import { FontWeight, Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { trackOnboardingCompleted } from '@/lib/analytics';
import { DINNER_SLOT, LUNCH_SLOT, cutoffLabel } from '@/lib/delivery-rules';
import { formatTimeRange, useSlots } from '@/lib/slots';

const { width: W, height: H } = Dimensions.get('window');
const SP = { damping: 24, stiffness: 220 } as const;
const SP_FAST = { damping: 28, stiffness: 320 } as const;

// Responsive font: anchored to iPhone 14 (390px). Scales with screen width only —
// overflow protection is handled by the BODY_FLEX tiers, not by shrinking fonts.
const rf = (n: number) => Math.round(n * Math.min(W / 390, 1.35));

// Illustration flex — 3 tiers based on device height:
//   < 800dp  (Poco F1, SE-class): −15% → 47
//   800–930dp (iPhone 14, most Android): standard → 55
//   > 930dp  (Pro Max, iPhone 16 Pro Max): −17% → 46
const ILLUS_FLEX = H < 800 ? Math.round(55 * 0.85) : H > 930 ? Math.round(55 * 0.83) : 55;
const BODY_FLEX = 100 - ILLUS_FLEX;

const ILLUS_GRADIENT = { light: ['#f0f6f2', '#e6f0e9'], dark: ['#1e2a24', '#17211c'] } as const;

const SLIDES = [
  {
    id: "subscription",
    tag: "YOUR SUBSCRIPTION",
    title: "Subscriptions that\nfit your week.",
    body: "Weekly or monthly. Nothing renews by itself.",
    cta: "Next →",
  },
  {
    id: "skip",
    tag: "SKIP ANYTIME",
    title: "Skip any delivery.\nZero guilt.",
    body: "Skip a day before its cutoff and that bowl moves to the end (up to 15 extra days).",
    cta: "Next →",
  },
  {
    id: "schedule",
    tag: "YOUR SCHEDULE",
    title: "You pick the days\n& slot.",
    body: "Mon to Sun. Choose the days that suit you, for lunch or dinner, and change them anytime.",
    cta: "Let's go →",
  },
] as const;

// ─── Slide 1: Subscription card ───────────────────────────────────────────────

function SubscriptionArt({
  isActive,
  colors,
  isDark,
}: {
  isActive: boolean;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const cardY = useSharedValue(60);
  const cardO = useSharedValue(0);
  const behindY = useSharedValue(80);
  const behindO = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      cardO.value = withTiming(1, { duration: 200 });
      cardY.value = withSpring(0, SP);
      behindO.value = withDelay(80, withTiming(1, { duration: 200 }));
      behindY.value = withDelay(80, withSpring(0, SP));
    } else {
      cardY.value = 60;
      cardO.value = 0;
      behindY.value = 80;
      behindO.value = 0;
    }
  }, [isActive, cardY, cardO, behindY, behindO]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardO.value,
    transform: [{ translateY: cardY.value }],
  }));
  const behindStyle = useAnimatedStyle(() => ({
    opacity: behindO.value,
    transform: [{ rotate: '4deg' }, { translateY: behindY.value }],
  }));

  return (
    <View style={artS.subOuter}>
      {/* Fixed-width wrapper so behind card fills correctly */}
      <View style={{ width: W * 0.68 }}>
        <Animated.View
          style={[
            artS.subCardBehind,
            {
              backgroundColor: isDark ? '#27352e' : '#d5e5da',
              borderColor: isDark ? '#313f38' : 'transparent',
              borderWidth: isDark ? 1 : 0,
            },
            behindStyle,
          ]}
        />
        <Animated.View
          style={[
            artS.subCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? '#313f38' : '#e6f0e9',
            },
            cardStyle,
          ]}
        >
          <Text style={[artS.subTag, { color: colors.primary }]}>Weekly subscription</Text>
          <Text style={[artS.subDays, { color: colors.text }]}>
            {'6 '}
            <Text style={[artS.subDaysSub, { color: colors.textMuted }]}>bowls</Text>
          </Text>
          <View style={[artS.subDivider, { backgroundColor: colors.borderLight }]} />
          <View style={artS.subBadges}>
            <View style={[artS.subBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[artS.subBadgeText, { color: colors.primary }]}>Fresh daily</Text>
            </View>
            <View style={[artS.subBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[artS.subBadgeText, { color: colors.primary }]}>Mon to Sun</Text>
            </View>
          </View>
          <View style={artS.subNoAuto}>
            <Text style={[artS.subNoAutoText, { color: colors.textMuted }]}>
              <Text style={{ color: '#ef4444' }}>{'✗ '}</Text>
              No auto-renew
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Slide 2: Skip calendar ───────────────────────────────────────────────────

// [label, isSkip, isActiveDay]
const CAL_CELLS: [string, boolean, boolean][] = [
  ['M', false, true],
  ['T', true, false],
  ['W', false, true],
  ['T', false, true],
  ['F', true, false],
  ['S', false, true],
];

function CalCell({
  label,
  isSkip,
  isActiveDay,
  sv,
  colors,
}: {
  label: string;
  isSkip: boolean;
  isActiveDay: boolean;
  sv: SharedValue<number>;
  colors: ThemeColors;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ scale: sv.value }],
  }));

  const bg = isSkip ? colors.errorBg : isActiveDay ? colors.primaryBg : colors.surface2;

  return (
    <Animated.View style={[artS.calCell, { backgroundColor: bg }, style]}>
      {isSkip ? (
        <Text style={{ fontSize: rf(16), color: colors.error, fontWeight: FontWeight.bold, opacity: 0.85 }}>
          ✕
        </Text>
      ) : (
        <Text style={[artS.calCellText, { color: isActiveDay ? colors.primary : colors.textMuted }]}>
          {label}
        </Text>
      )}
    </Animated.View>
  );
}

function SkipArt({ isActive, colors }: { isActive: boolean; colors: ThemeColors }) {
  const calY = useSharedValue(50);
  const calO = useSharedValue(0);
  const sv0 = useSharedValue(0);
  const sv1 = useSharedValue(0);
  const sv2 = useSharedValue(0);
  const sv3 = useSharedValue(0);
  const sv4 = useSharedValue(0);
  const sv5 = useSharedValue(0);
  const badgeO = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      calO.value = withTiming(1, { duration: 180 });
      calY.value = withSpring(0, SP);
      sv0.value = withDelay(80, withSpring(1, SP_FAST));
      sv1.value = withDelay(130, withSpring(1, SP_FAST));
      sv2.value = withDelay(180, withSpring(1, SP_FAST));
      sv3.value = withDelay(230, withSpring(1, SP_FAST));
      sv4.value = withDelay(280, withSpring(1, SP_FAST));
      sv5.value = withDelay(330, withSpring(1, SP_FAST));
      badgeO.value = withDelay(430, withTiming(1, { duration: 180 }));
    } else {
      calY.value = 50;
      calO.value = 0;
      sv0.value = 0;
      sv1.value = 0;
      sv2.value = 0;
      sv3.value = 0;
      sv4.value = 0;
      sv5.value = 0;
      badgeO.value = 0;
    }
  }, [isActive, calY, calO, sv0, sv1, sv2, sv3, sv4, sv5, badgeO]);

  const calStyle = useAnimatedStyle(() => ({
    opacity: calO.value,
    transform: [{ translateY: calY.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeO.value }));
  const cellSvs = [sv0, sv1, sv2, sv3, sv4, sv5] as const;

  return (
    <Animated.View style={[artS.calWidget, { backgroundColor: colors.surface }, calStyle]}>
      <Text style={[artS.calMonth, { color: colors.textMuted }]}>THIS WEEK</Text>
      <View style={artS.calRow}>
        {CAL_CELLS.map(([label, isSkip, isActiveDay], i) => (
          <CalCell
            key={i}
            label={label}
            isSkip={isSkip}
            isActiveDay={isActiveDay}
            sv={cellSvs[i]}
            colors={colors}
          />
        ))}
      </View>
      <Animated.View style={badgeStyle}>
        <Text style={[artS.calBadgeText, { color: colors.textMuted }]}>
          {'2 days skipped · '}
          <Text style={{ color: colors.primary }}>bowls moved to the end</Text>
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Slide 3: Day picker + slots ─────────────────────────────────────────────

const DAY_PILLS: { short: string; label: string; on: boolean }[] = [
  { short: 'M', label: 'Mon', on: true },
  { short: 'T', label: 'Tue', on: false },
  { short: 'W', label: 'Wed', on: true },
  { short: 'T', label: 'Thu', on: true },
  { short: 'F', label: 'Fri', on: false },
  { short: 'S', label: 'Sat', on: true },
];

function DayPill({
  short,
  label,
  on,
  sv,
  colors,
}: {
  short: string;
  label: string;
  on: boolean;
  sv: SharedValue<number>;
  colors: ThemeColors;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ scale: 0.7 + sv.value * 0.3 }],
  }));

  return (
    <Animated.View
      style={[
        artS.dayPill,
        { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border },
        style,
      ]}
    >
      <Text style={[artS.dayPillShort, { color: on ? '#fff' : colors.textMuted }]}>{short}</Text>
      <Text style={[artS.dayPillSub, { color: on ? 'rgba(255,255,255,0.7)' : colors.textDisabled }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

// Shown until /api/v1/slots answers, e.g. on a first launch offline.
const ART_SLOTS = [
  { label: 'Lunch', time_range: '8 AM–1 PM', icon: '🌤️' },
  { label: 'Dinner', time_range: '4–8:30 PM', icon: '🌙' },
];

function DayPickerArt({ isActive, colors }: { isActive: boolean; colors: ThemeColors }) {
  const fetched = useSlots();
  const [left, right] = fetched.length >= 2 ? fetched : ART_SLOTS;
  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  const p4 = useSharedValue(0);
  const p5 = useSharedValue(0);
  const slotLO = useSharedValue(0);
  const slotLX = useSharedValue(-20);
  const slotRO = useSharedValue(0);
  const slotRX = useSharedValue(20);

  useEffect(() => {
    if (isActive) {
      [p0, p1, p2, p3, p4, p5].forEach((sv, i) => {
        sv.value = withDelay(60 + i * 55, withSpring(1, SP));
      });
      slotLO.value = withDelay(380, withTiming(1, { duration: 180 }));
      slotLX.value = withDelay(380, withSpring(0, SP));
      slotRO.value = withDelay(460, withTiming(1, { duration: 180 }));
      slotRX.value = withDelay(460, withSpring(0, SP));
    } else {
      p0.value = 0;
      p1.value = 0;
      p2.value = 0;
      p3.value = 0;
      p4.value = 0;
      p5.value = 0;
      slotLO.value = 0;
      slotLX.value = -20;
      slotRO.value = 0;
      slotRX.value = 20;
    }
  }, [isActive, p0, p1, p2, p3, p4, p5, slotLO, slotLX, slotRO, slotRX]);

  const slotLStyle = useAnimatedStyle(() => ({
    opacity: slotLO.value,
    transform: [{ translateX: slotLX.value }],
  }));
  const slotRStyle = useAnimatedStyle(() => ({
    opacity: slotRO.value,
    transform: [{ translateX: slotRX.value }],
  }));
  const pillSvs = [p0, p1, p2, p3, p4, p5] as const;

  return (
    <View style={artS.dayPickerRoot}>
      <View style={artS.pillRow}>
        {DAY_PILLS.map((d, i) => (
          <DayPill key={i} short={d.short} label={d.label} on={d.on} sv={pillSvs[i]} colors={colors} />
        ))}
      </View>
      <View style={artS.slotRow}>
        <Animated.View
          style={[
            artS.slotCard,
            { backgroundColor: colors.primaryBg, borderColor: colors.primary },
            slotLStyle,
          ]}
        >
          <Text style={artS.slotIcon}>{left.icon ?? '🌤️'}</Text>
          <Text style={[artS.slotName, { color: colors.primary }]}>{left.label}</Text>
          <Text style={[artS.slotTime, { color: colors.textMuted }]}>{formatTimeRange(left.time_range)}</Text>
        </Animated.View>
        <Animated.View
          style={[
            artS.slotCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            slotRStyle,
          ]}
        >
          <Text style={artS.slotIcon}>{right.icon ?? '🌙'}</Text>
          <Text style={[artS.slotName, { color: colors.textMuted }]}>{right.label}</Text>
          <Text style={[artS.slotTime, { color: colors.textMuted }]}>{formatTimeRange(right.time_range)}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Animated dot ─────────────────────────────────────────────────────────────

function Dot({ isActive, colors }: { isActive: boolean; colors: ThemeColors }) {
  const w = useSharedValue(isActive ? 20 : 5);
  useEffect(() => {
    w.value = withSpring(isActive ? 20 : 5, SP_FAST);
  }, [isActive, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View
      style={[dotS.dot, { backgroundColor: isActive ? colors.primary : colors.border }, style]}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { colors, fonts, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { markOnboardingDone } = useAuth();

  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);

  const [titleChars, setTitleChars] = useState(SLIDES[0].title.length);
  const [bodyChars, setBodyChars] = useState(SLIDES[0].body.length);

  const artX = useSharedValue(0);
  const artO = useSharedValue(1);

  const transitioning = useRef(false);
  const typerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTyper = useCallback(() => {
    if (typerRef.current) {
      clearInterval(typerRef.current);
      typerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTyper(), [clearTyper]);

  const transitionTo = useCallback(
    (nextIdx: number, dir: 1 | -1) => {
      if (transitioning.current) return;
      transitioning.current = true;
      clearTyper();

      // 1. Start art exit
      artX.value = withTiming(dir * -W * 0.75, { duration: 240 });
      artO.value = withTiming(0, { duration: 200 });

      // 2. Unwrite text
      const titleFull = SLIDES[activeIdxRef.current].title;
      const bodyFull = SLIDES[activeIdxRef.current].body;
      const STEPS = 8;
      let step = 0;
      typerRef.current = setInterval(() => {
        step++;
        const ratio = 1 - step / STEPS;
        setTitleChars(Math.round(titleFull.length * ratio));
        setBodyChars(Math.round(bodyFull.length * ratio));
        if (step >= STEPS) {
          clearTyper();
          // 3. Switch content
          activeIdxRef.current = nextIdx;
          setActiveIdx(nextIdx);
          setTitleChars(0);
          setBodyChars(0);
          // 4. Art enters from opposite side
          artX.value = dir * W * 0.75; // teleport to enter start (no animation)
          artX.value = withSpring(0, { damping: 18, stiffness: 110 });
          artO.value = withTiming(1, { duration: 280 });
          // 5. Typewrite new text
          const newTitle = SLIDES[nextIdx].title;
          const newBody = SLIDES[nextIdx].body;
          let tc = 0;
          let bc = 0;
          typerRef.current = setInterval(() => {
            let done = true;
            if (tc < newTitle.length) {
              tc = Math.min(tc + 2, newTitle.length);
              done = false;
            }
            if (bc < newBody.length) {
              bc = Math.min(bc + 4, newBody.length);
              done = false;
            }
            setTitleChars(tc);
            setBodyChars(bc);
            if (done) {
              clearTyper();
              transitioning.current = false;
            }
          }, 7);
        }
      }, Math.ceil(250 / STEPS));
    },
    [clearTyper, artX, artO],
  );

  const handleNext = useCallback(() => {
    if (activeIdxRef.current < SLIDES.length - 1) {
      transitionTo(activeIdxRef.current + 1, 1);
    }
  }, [transitionTo]);

  const handleFinish = useCallback(async () => {
    trackOnboardingCompleted();
    await markOnboardingDone();
    router.replace('/(auth)/login' as Href);
  }, [markOnboardingDone, router]);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX < -50 || e.velocityX < -500) {
        // Swipe left → next slide
        if (activeIdxRef.current < SLIDES.length - 1) {
          runOnJS(transitionTo)(activeIdxRef.current + 1, 1);
        }
      } else if (e.translationX > 50 || e.velocityX > 500) {
        // Swipe right → prev slide
        if (activeIdxRef.current > 0) {
          runOnJS(transitionTo)(activeIdxRef.current - 1, -1);
        }
      }
    });

  const artWrapperStyle = useAnimatedStyle(() => ({
    opacity: artO.value,
    transform: [{ translateX: artX.value }],
  }));

  const isLast = activeIdx === SLIDES.length - 1;
  const slide = SLIDES[activeIdx];
  const grad = (isDark ? ILLUS_GRADIENT.dark : ILLUS_GRADIENT.light) as [string, string];

  const displayTitle = slide.title.slice(0, titleChars);
  const displayBody = slide.body.slice(0, bodyChars);
  const allTitleVisible = titleChars >= slide.title.length;
  const allBodyVisible = bodyChars >= slide.body.length;
  const allCharsVisible = allTitleVisible && allBodyVisible;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {/* ── Illustration section ── */}
        <View style={s.illus}>
          <LinearGradient
            colors={grad}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Art wrapper with slide animation */}
          <Animated.View style={[artS.artWrapper, artWrapperStyle]}>
            {activeIdx === 0 && <SubscriptionArt isActive={true} colors={colors} isDark={isDark} />}
            {activeIdx === 1 && <SkipArt isActive={true} colors={colors} />}
            {activeIdx === 2 && <DayPickerArt isActive={true} colors={colors} />}
          </Animated.View>
        </View>

        {/* ── Body section ── */}
        <View
          style={[
            s.body,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom + 16, 20),
            },
          ]}
        >
          <Text style={[s.tag, { color: colors.primary }]}>{slide.tag}</Text>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>
            {displayTitle}
          </Text>

          {/* Growing area keeps footer pinned to bottom */}
          <View style={s.textArea}>
            <Text style={[s.bodyText, { color: colors.textMuted }]}>{displayBody}</Text>

            {/* Slide 2 only: cutoff pill — show once all chars visible */}
            {activeIdx === 1 && allCharsVisible && (
              <View
                style={[
                  s.cutoffPill,
                  { backgroundColor: isDark ? '#3d2c0a' : '#fef9c3' },
                ]}
              >
                <Text style={[s.cutoffText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
                  ⏰ Lunch by {cutoffLabel(LUNCH_SLOT)} · dinner by {cutoffLabel(DINNER_SLOT)}
                </Text>
              </View>
            )}

            {/* Slide 3 only: area chips — show once all chars visible */}
            {activeIdx === 2 && allCharsVisible && (
              <View style={s.areaStrip}>
                {(['📍 Prahladnagar', 'Satellite', 'Bodakdev', 'Vastrapur', 'SG Highway', '+more'] as const).map(
                  (area) => (
                    <View
                      key={area}
                      style={[
                        s.areaChip,
                        {
                          backgroundColor: colors.primaryBg,
                          borderWidth: isDark ? 1 : 0,
                          borderColor: isDark ? '#313f38' : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[s.areaChipText, { color: colors.primary }]}>{area}</Text>
                    </View>
                  ),
                )}
              </View>
            )}
          </View>

          {/* Footer: dots left, compact CTA right */}
          <View style={s.footer}>
            <View style={s.dotsRow}>
              {SLIDES.map((_, k) => (
                <Dot key={k} isActive={k === activeIdx} colors={colors} />
              ))}
            </View>
            <TouchableOpacity
              onPress={isLast ? handleFinish : handleNext}
              activeOpacity={0.85}
              style={[s.nextBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[s.nextBtnText, { fontFamily: fonts.bodySemibold }]}>{slide.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </GestureDetector>
  );
}

// ─── Screen styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  illus: {
    flex: ILLUS_FLEX,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flex: BODY_FLEX,
    paddingHorizontal: 22,
    paddingTop: 16,
    flexDirection: 'column',
  },

  tag: {
    fontSize: rf(13),
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: rf(36),
    lineHeight: rf(36) * 1.3,
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  // Grows to fill remaining space, keeping footer pinned to bottom
  textArea: { flex: 1 },

  bodyText: {
    fontSize: rf(17),
    lineHeight: rf(17) * 1.65,
  },

  // Slide 2: yellow cutoff pill
  cutoffPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginTop: 12,
  },
  cutoffText: {
    fontSize: rf(14),
    fontWeight: FontWeight.bold,
  },

  // Slide 3: delivery area chips
  areaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  areaChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  areaChipText: {
    fontSize: rf(14),
    fontWeight: FontWeight.semibold,
  },

  // Footer row
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // CTA button — fixed size, never scales
  nextBtn: {
    width: 130,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  nextBtnText: {
    fontSize: 17,
    color: '#fff',
  },

});

// ─── Art styles ───────────────────────────────────────────────────────────────

const artS = StyleSheet.create({
  // Art wrapper — fills illus section, more space at top, tighter at bottom
  artWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  // Subscription card
  subOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  subCardBehind: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 18,
  },
  subCard: {
    width: '100%',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  subTag: { fontSize: rf(13), fontWeight: FontWeight.bold, letterSpacing: 1.5 },
  subDays: {
    fontSize: rf(54),
    fontWeight: FontWeight.bold,
    lineHeight: rf(58),
  },
  subDaysSub: { fontSize: rf(18), fontWeight: FontWeight.medium },
  subDivider: { height: 1, marginVertical: 8 },
  subBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  subBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  subBadgeText: { fontSize: rf(13), fontWeight: FontWeight.semibold },
  subNoAuto: { marginTop: 8 },
  subNoAutoText: { fontSize: rf(13) },

  // Calendar
  calWidget: {
    width: '88%',
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  calMonth: {
    fontSize: rf(13),
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    letterSpacing: 1,
  },
  calRow: { flexDirection: 'row', gap: 8 },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellText: { fontSize: rf(18), fontWeight: FontWeight.semibold },
  calBadgeText: { fontSize: rf(13), textAlign: 'center' },

  // Day picker
  dayPickerRoot: { width: '100%', gap: 16 },
  pillRow: { flexDirection: 'row', gap: 6 },
  dayPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  dayPillShort: { fontSize: rf(18), fontWeight: FontWeight.bold },
  dayPillSub: { fontSize: rf(12), fontWeight: FontWeight.medium },
  slotRow: { flexDirection: 'row', gap: 12 },
  slotCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  slotIcon: { fontSize: rf(30) },
  slotName: { fontSize: rf(18), fontWeight: FontWeight.bold },
  slotTime: { fontSize: rf(13) },
});

// ─── Dot styles ───────────────────────────────────────────────────────────────

const dotS = StyleSheet.create({
  dot: {
    height: 5,
    borderRadius: Radius.full,
  },
});
