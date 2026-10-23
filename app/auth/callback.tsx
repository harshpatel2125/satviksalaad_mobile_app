import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { trackLogin } from '@/lib/analytics';
import { clearGoogleSignInPending, isGoogleSignInPending, signInWithToken } from '@/lib/auth-session';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';

/**
 * Where Google sign-in returns, with the backend's session token (?token=) or
 * a failure (?error=).
 *
 * Two paths land here:
 *   1. The auth browser captures the redirect → login.tsx navigates here
 *   2. Android routes the intent → Expo Router opens this screen directly
 *
 * The `consumed` ref makes sure the token is used once even when both fire.
 * Anyone can open this URL, so a token is only used while a Google sign-in
 * this app started is pending, and never over an existing session.
 */

// Needed on iOS to close a lingering SFAuthenticationSession.
WebBrowser.maybeCompleteAuthSession();

const STATUS_MESSAGES = [
  'Verifying your identity…',
  'Securing your session…',
  'Loading your account…',
  'Almost ready…',
];

export default function AuthCallbackScreen() {
  const { colors, fonts } = useTheme();
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const consumed = useRef(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [trackWidth, setTrackWidth] = useState(260);

  // Traveling shimmer bar: animate a segment from left edge to right edge, repeat.
  const tx = useSharedValue(0);

  useEffect(() => {
    const barW = trackWidth * 0.55;
    tx.value = -barW;
    tx.value = withRepeat(
      withTiming(trackWidth, {
        duration: 1500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth]);

  // Cycle through status messages with a staggered delay.
  useEffect(() => {
    const timers = STATUS_MESSAGES.map((_, i) =>
      setTimeout(() => setMsgIdx(i), i * 1800),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  useEffect(() => {
    if (consumed.current || isLoading) return;
    // The auth guard moves a signed-in user on from here.
    if (session) {
      consumed.current = true;
      return;
    }
    if (params.error) {
      consumed.current = true;
      clearGoogleSignInPending();
      setExchangeError(
        params.error === 'google_unavailable'
          ? 'Google sign-in is not available right now.'
          : 'Google sign-in failed. Please try again.',
      );
      return;
    }
    if (!params.token) return;
    consumed.current = true;

    if (!isGoogleSignInPending()) {
      setExchangeError('Google sign-in failed. Please try again.');
      return;
    }
    // Cleared only once settled, so the second of the two paths above still passes.
    signInWithToken(params.token)
      .then(() => trackLogin('google'))
      .catch((err: unknown) => {
        setExchangeError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      })
      .finally(clearGoogleSignInPending);
  }, [params.token, params.error, session, isLoading]);

  // Navigation after session is handled entirely by the auth guard in _layout.tsx,
  // which also checks pendingNameRoute to decide between tabs and name entry.

  if (exchangeError) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.errorCard, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
          <View style={[s.errorIcon, { backgroundColor: colors.errorBg }]}>
            <Ionicons name="alert-circle" size={28} color={colors.error} />
          </View>
          <Text style={[s.errorTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            Sign-in failed
          </Text>
          <Text style={[s.errorBody, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {exchangeError}
          </Text>
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/login' as Href)}
            activeOpacity={0.85}>
            <Text style={[s.retryText, { fontFamily: fonts.bodySemibold }]}>
              Back to sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.content}>

        {/* Logo */}
        <Image
          source={require('@/assets/logo/logo.png')}
          style={s.logo}
          contentFit="contain"
        />

        {/* Heading */}
        <Text style={[s.heading, { color: colors.text, fontFamily: fonts.display }]}>
          One moment
        </Text>

        {/* Cycling status message with fade */}
        <Animated.Text
          key={msgIdx}
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[s.message, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {STATUS_MESSAGES[msgIdx]}
        </Animated.Text>

        {/* Indeterminate progress bar */}
        <View
          style={[s.track, { backgroundColor: colors.primaryTint }]}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
          <Animated.View
            style={[s.bar, { backgroundColor: colors.primary, width: trackWidth * 0.55 }, barStyle]}
          />
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[5],
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing[4],
  },

  logo: {
    width: 120,
    height: 72,
    marginBottom: Spacing[2],
  },
  heading: {
    fontSize: FontSize['2xl'],
    letterSpacing: -0.3,
  },
  message: {
    fontSize: FontSize.base,
    textAlign: 'center',
  },

  track: {
    width: '100%',
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: Spacing[2],
  },
  bar: {
    height: '100%',
    borderRadius: Radius.full,
  },

  // Error state
  errorCard: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[6],
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  errorTitle: {
    fontSize: FontSize.lg,
  },
  errorBody: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
  },
  retryBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    marginTop: Spacing[2],
  },
  retryText: {
    fontSize: FontSize.md,
    color: '#fff',
  },
});
