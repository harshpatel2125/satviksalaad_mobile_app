import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoalRow } from '@/components/screens/goals/goal-row';
import { HabitTipCard } from '@/components/screens/goals/habit-tip-card';
import { WaterTracker } from '@/components/screens/goals/water-tracker';
import { WeekStrip } from '@/components/screens/goals/week-strip';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { column } from '@/constants/layout';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SLOT_LABELS, useDailyGoals, type GoalSlot } from '@/lib/daily-goals';

const SLOTS: GoalSlot[] = ['morning', 'day', 'evening'];

export default function GoalsScreen() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goals, isDone, doneCount, streak, week, water, toggle, setWater } = useDailyGoals();

  const waterGoal = goals.find((goal) => goal.target !== undefined);
  const allDone = goals.length > 0 && doneCount === goals.length;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Today's goals"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        right={
          <TouchableOpacity
            onPress={() => router.push('/goals-setup')}
            style={[s.edit, { backgroundColor: colors.primaryBg }]}
            activeOpacity={0.7}
          >
            <Text style={[s.editText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Edit</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[column(), s.content, { paddingBottom: insets.bottom + Spacing[6] }]}
        showsVerticalScrollIndicator={false}
      >
        <WeekStrip days={week} />

        <View style={s.summary}>
          <Text style={[s.summaryText, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {allDone ? 'All done for today. See you tomorrow!' : `${doneCount} of ${goals.length} done today`}
          </Text>
          {streak > 0 ? (
            <View style={[s.streak, { backgroundColor: colors.accentBg }]}>
              <Ionicons name="flame" size={13} color={colors.accent} />
              <Text style={[s.streakText, { color: colors.accent, fontFamily: fonts.bodySemibold }]}>{streak}-day streak</Text>
            </View>
          ) : null}
        </View>

        {waterGoal ? <WaterTracker glasses={water} target={waterGoal.target!} onChange={setWater} /> : null}

        {SLOTS.map((slot) => {
          const inSlot = goals.filter((goal) => goal.slot === slot && goal.target === undefined);
          if (inSlot.length === 0) return null;
          return (
            <View key={slot} style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.textMuted, fontFamily: fonts.bodyBold }]}>
                {SLOT_LABELS[slot].toUpperCase()}
              </Text>
              <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
                {inSlot.map((goal, index) => (
                  <GoalRow key={goal.id} goal={goal} done={isDone(goal)} first={index === 0} onToggle={() => toggle(goal.id)} />
                ))}
              </View>
            </View>
          );
        })}

        <HabitTipCard />

        <Text style={[s.note, { color: colors.textMuted, fontFamily: fonts.body }]}>
          A missed day never resets your streak. Your goals stay on this phone.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], gap: Spacing[4] },
  edit: { paddingHorizontal: Spacing[3], paddingVertical: 6, borderRadius: Radius.full },
  editText: { fontSize: FontSize.sm },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { fontSize: FontSize.sm },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing[2.5], paddingVertical: 3, borderRadius: Radius.full },
  streakText: { fontSize: FontSize.xs },
  section: { gap: Spacing[2] },
  sectionLabel: { fontSize: FontSize.xs, letterSpacing: 0.9, marginLeft: 2 },
  card: { borderRadius: Radius.xl, paddingHorizontal: Spacing[4] },
  note: { fontSize: FontSize.xs, textAlign: 'center' },
});
