import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoalRow } from '@/components/screens/goals/goal-row';
import { HabitTipCard } from '@/components/screens/goals/habit-tip-card';
import { ProgressRing } from '@/components/screens/goals/progress-ring';
import { Text } from '@/components/ui/text';
import { column, SHEET_WIDTH } from '@/constants/layout';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDailyGoals } from '@/lib/daily-goals';
import { getGreeting } from '@/lib/greeting';

const HIDDEN_Y = 700;
/** How far down, or how fast, a drag has to go to close the sheet. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;
const ROWS = 3;

interface GoalsSheetProps {
  visible: boolean;
  firstName: string | null;
  onDismiss: () => void;
}

export function GoalsSheet({ visible, firstName, onDismiss }: GoalsSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { goals, isDone, doneCount, streak, water, toggle, setWater } = useDailyGoals();

  const translateY = useSharedValue(HIDDEN_Y);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { stiffness: 300, damping: 30 });
    } else {
      backdrop.value = 0;
      translateY.value = HIDDEN_Y;
    }
  }, [visible, backdrop, translateY]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        translateY.value = withTiming(HIDDEN_Y, { duration: 180 });
        runOnJS(onDismiss)();
      } else {
        translateY.value = withSpring(0, { stiffness: 300, damping: 30 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!visible) return null;

  // Unfinished goals first, so the sheet shows what is left to do.
  const shown = [...goals.filter((goal) => !isDone(goal)), ...goals.filter((goal) => isDone(goal))].slice(0, ROWS);
  const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase();
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : getGreeting();

  return (
    <Modal transparent animationType="none" visible onRequestClose={onDismiss} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close" />
        </Animated.View>

        <View style={s.bottom} pointerEvents="box-none">
          <GestureDetector gesture={drag}>
            <Animated.View
              style={[
                s.sheet,
                column(SHEET_WIDTH),
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing[4]) + Spacing[2] },
                sheetStyle,
              ]}
            >
              <View style={[s.grabber, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                onPress={onDismiss}
                style={[s.close, { backgroundColor: colors.surface2 }]}
                hitSlop={8}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>

              <View style={s.head}>
                <ProgressRing
                  size={64}
                  thickness={7}
                  progress={goals.length ? doneCount / goals.length : 0}
                  color={colors.primary}
                  trackColor={colors.sageSoft}
                  holeColor={colors.surface}
                >
                  <Text style={[s.ringText, { color: colors.text, fontFamily: fonts.bodyBold }]}>
                    {doneCount}/{goals.length}
                  </Text>
                </ProgressRing>
                <View style={s.headText}>
                  <Text style={[s.label, { color: colors.primary, fontFamily: fonts.bodyBold }]}>TODAY · {weekday}</Text>
                  <Text style={[s.greeting, { color: colors.text, fontFamily: fonts.display }]} numberOfLines={1}>
                    {greeting}
                  </Text>
                  {streak > 0 ? (
                    <View style={[s.streak, { backgroundColor: colors.accentBg }]}>
                      <Ionicons name="flame" size={13} color={colors.accent} />
                      <Text style={[s.streakText, { color: colors.accent, fontFamily: fonts.bodySemibold }]}>
                        {streak}-day streak
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View>
                {shown.map((goal, index) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    done={isDone(goal)}
                    water={water}
                    first={index === 0}
                    onToggle={() => toggle(goal.id)}
                    onAddWater={() => setWater(water + 1)}
                    onNavigate={onDismiss}
                  />
                ))}
              </View>

              <HabitTipCard />

              <TouchableOpacity
                style={[s.primary, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => {
                  onDismiss();
                  router.push('/goals');
                }}
              >
                <Text style={[s.primaryText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                  See all of today&apos;s goals
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismiss} hitSlop={8} style={s.later}>
                <Text style={[s.laterText, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>Not today</Text>
              </TouchableOpacity>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: Spacing[5],
    gap: Spacing[3],
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: Spacing[2.5] },
  close: {
    position: 'absolute',
    top: Spacing[3.5],
    right: Spacing[4],
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3.5], paddingRight: 40 },
  headText: { flex: 1, gap: 2, alignItems: 'flex-start' },
  ringText: { fontSize: FontSize.sm },
  label: { fontSize: 10.5, letterSpacing: 0.9 },
  greeting: { fontSize: FontSize.lg },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[2.5],
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  streakText: { fontSize: FontSize.xs },
  primary: { height: 50, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: Spacing[1] },
  primaryText: { fontSize: FontSize.md },
  later: { alignSelf: 'center', paddingVertical: Spacing[1] },
  laterText: { fontSize: FontSize.sm },
});
