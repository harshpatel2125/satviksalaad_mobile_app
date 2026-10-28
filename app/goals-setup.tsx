import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { column } from '@/constants/layout';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/alert';
import { useTheme } from '@/hooks/use-theme';
import {
  GOALS,
  MAX_GOALS,
  MIN_GOALS,
  reminderGoalIds,
  selectedGoalIds,
  setReminderGoalIds,
  setSelectedGoals,
  type GoalId,
} from '@/lib/daily-goals';
import { syncGoalReminders } from '@/lib/goal-reminders';

function formatTime({ hour, minute }: { hour: number; minute: number }): string {
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export default function GoalsSetupScreen() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [selected, setSelected] = useState<GoalId[]>(selectedGoalIds);
  const [reminders, setReminders] = useState<GoalId[]>(reminderGoalIds);
  const [saving, setSaving] = useState(false);

  const canSave = selected.length >= MIN_GOALS && selected.length <= MAX_GOALS && !saving;
  const remindable = GOALS.filter((goal) => goal.remindAt && selected.includes(goal.id));

  function toggleGoal(id: GoalId) {
    if (selected.includes(id)) {
      setSelected(selected.filter((g) => g !== id));
    } else if (selected.length >= MAX_GOALS) {
      showAlert('Up to 5 goals', 'Small and few works best. Remove one to add another.', [{ text: 'OK' }]);
    } else {
      setSelected([...selected, id]);
    }
  }

  async function save() {
    setSaving(true);
    setSelectedGoals(selected);
    setReminderGoalIds(reminders.filter((id) => selected.includes(id)));
    const allowed = await syncGoalReminders().catch(() => false);
    setSaving(false);
    if (!allowed) {
      showAlert(
        'Reminders are off',
        'Your goals are saved. To get reminders, allow notifications for Satvik Salaad in your phone settings.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
      return;
    }
    router.back();
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Your daily goals" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[column(), s.content]} showsVerticalScrollIndicator={false}>
        <View style={s.intro}>
          <Text style={[s.heading, { color: colors.text, fontFamily: fonts.display }]}>Pick {MIN_GOALS} to {MAX_GOALS} small goals</Text>
          <Text style={[s.sub, { color: colors.textMuted, fontFamily: fonts.body }]}>
            Small and daily beats big and rare. You can change these any time.
          </Text>
        </View>

        <View style={s.grid}>
          {GOALS.map((goal) => {
            const on = selected.includes(goal.id);
            return (
              <TouchableOpacity
                key={goal.id}
                activeOpacity={0.8}
                onPress={() => toggleGoal(goal.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[
                  s.option,
                  { backgroundColor: on ? colors.primaryTint : colors.surface, borderColor: on ? colors.primary : colors.border },
                ]}
              >
                <View style={[s.optionIcon, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name={goal.icon} size={17} color={colors.primary} />
                </View>
                <Text style={[s.optionTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={2}>
                  {goal.title}
                </Text>
                <Text style={[s.optionSub, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={1}>
                  {goal.short}
                </Text>
                {on ? (
                  <View style={[s.tick, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={12} color={colors.textOnPrimary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {remindable.length > 0 ? (
          <View style={s.reminders}>
            <Text style={[s.sectionLabel, { color: colors.textMuted, fontFamily: fonts.bodyBold }]}>REMINDERS</Text>
            {remindable.map((goal) => (
              <View key={goal.id} style={[s.reminderRow, { borderTopColor: colors.border }]}>
                <Text style={[s.reminderText, { color: colors.text, fontFamily: fonts.body }]}>
                  {goal.title} · {formatTime(goal.remindAt!)}
                </Text>
                <Switch
                  value={reminders.includes(goal.id)}
                  onValueChange={(on) => setReminders(on ? [...reminders, goal.id] : reminders.filter((id) => id !== goal.id))}
                  trackColor={{ true: colors.primary, false: colors.surface2 }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[s.foot, { color: colors.textMuted, fontFamily: fonts.body }]}>
          General wellness suggestions, not medical advice.
        </Text>
      </ScrollView>

      <BottomActionBar>
        <TouchableOpacity
          style={[s.save, { backgroundColor: canSave ? colors.primary : colors.surface2 }]}
          onPress={save}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          <Text style={[s.saveText, { color: canSave ? colors.textOnPrimary : colors.textMuted, fontFamily: fonts.bodySemibold }]}>
            {selected.length < MIN_GOALS ? `Pick ${MIN_GOALS - selected.length} more` : 'Save my goals'}
          </Text>
        </TouchableOpacity>
      </BottomActionBar>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[6], gap: Spacing[4] },
  intro: { gap: Spacing[1] },
  heading: { fontSize: FontSize.xl },
  sub: { fontSize: FontSize.sm, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], justifyContent: 'space-between' },
  option: { width: '48.5%', borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing[3], gap: 2 },
  optionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  optionTitle: { fontSize: FontSize.sm, paddingRight: Spacing[5] },
  optionSub: { fontSize: FontSize.xs },
  tick: { position: 'absolute', top: Spacing[2.5], right: Spacing[2.5], width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reminders: { gap: 0 },
  sectionLabel: { fontSize: FontSize.xs, letterSpacing: 0.9, marginBottom: Spacing[1], marginLeft: 2 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing[2.5], borderTopWidth: StyleSheet.hairlineWidth },
  reminderText: { fontSize: FontSize.sm, flex: 1, marginRight: Spacing[3] },
  foot: { fontSize: FontSize.xs, textAlign: 'center' },
  save: { height: 50, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: FontSize.md },
});
