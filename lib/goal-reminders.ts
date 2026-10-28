import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { GOALS, reminderGoalIds, selectedGoalIds } from './daily-goals';
import { storage } from './storage';

const SCHEDULED_KEY = 'goals.scheduledReminders';
const CHANNEL_ID = 'daily-goals';

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/**
 * Replaces this device's goal reminders with one daily notification per chosen
 * goal that has a reminder switched on. Resolves false when notifications are
 * not allowed, so the caller can say so.
 */
export async function syncGoalReminders(): Promise<boolean> {
  const previous: string[] = JSON.parse(storage.getString(SCHEDULED_KEY) ?? '[]');
  await Promise.all(previous.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  storage.set(SCHEDULED_KEY, '[]');

  const selected = selectedGoalIds();
  const wanted = reminderGoalIds();
  const goals = GOALS.filter((goal) => goal.remindAt && selected.includes(goal.id) && wanted.includes(goal.id));
  if (goals.length === 0) return true;
  if (!(await ensurePermission())) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily goals',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const ids = await Promise.all(
    goals.map((goal) =>
      Notifications.scheduleNotificationAsync({
        content: { title: goal.title, body: `${goal.when}. Tick it off in Satvik Salaad.`, data: { screen: '/goals' } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: goal.remindAt!.hour,
          minute: goal.remindAt!.minute,
          channelId: CHANNEL_ID,
        },
      }),
    ),
  );
  storage.set(SCHEDULED_KEY, JSON.stringify(ids));
  return true;
}
