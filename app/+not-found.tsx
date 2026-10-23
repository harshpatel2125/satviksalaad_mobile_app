import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/context/auth';

/**
 * Catches unmatched routes (e.g. the bare-scheme "resume" intent Android fires
 * when Chrome Custom Tab closes: satviksalaad:///).
 * Redirects silently to the appropriate screen instead of showing an error.
 */
export default function NotFound() {
  const router = useRouter();
  const { session, isLoading, hasSeenOnboarding, profile } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!hasSeenOnboarding) {
      router.replace('/(onboarding)' as Href);
    } else if (!session) {
      router.replace('/(auth)/login' as Href);
    } else {
      router.replace((profile?.role === 'delivery_partner' ? '/(delivery-partner)' : '/(tabs)') as Href);
    }
  }, [isLoading, session, hasSeenOnboarding, profile?.role, router]);

  return <View style={{ flex: 1 }} />;
}
