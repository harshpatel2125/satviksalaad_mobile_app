import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { profileApi } from './api';

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const opts = projectId ? { projectId } : undefined;

  // Retry once on transient failures (Expo's token relay returns 503 occasionally)
  let tokenData: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync(opts);
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    tokenData = await Notifications.getExpoPushTokenAsync(opts);
  }

  await profileApi.update({
    expo_push_token: tokenData.data,
    app_platform: Platform.OS,
  });

  return tokenData.data;
}

export async function clearPushToken(): Promise<void> {
  await profileApi.update({ expo_push_token: null });
}
