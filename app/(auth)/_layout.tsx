import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/context/theme-preference';

export default function AuthLayout() {
  const { effectiveScheme: scheme } = useThemePreference();
  const c = Colors[scheme];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
