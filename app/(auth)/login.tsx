import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from "expo-apple-authentication";
import {
  digestStringAsync,
  CryptoDigestAlgorithm,
  getRandomBytesAsync,
} from "expo-crypto";
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '@/lib/api';
import { withNetworkRetry } from '@/lib/network-retry';
import { trackLogin } from "@/lib/analytics";
import { FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearGoogleSignInPending, markGoogleSignInPending, signInWithToken } from '@/lib/auth-session';

// Required on Android so the auth session closes cleanly after redirect
WebBrowser.maybeCompleteAuthSession();


export default function LoginScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = /^[6-9]\d{9}$/.test(phone.trim());

  async function handleGoogleSignIn() {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);

    try {
      const redirectUrl = Linking.createURL('auth/callback');
      markGoogleSignInPending();
      const result = await WebBrowser.openAuthSessionAsync(auth.googleSignInUrl(redirectUrl), redirectUrl);

      // Not on 'dismiss': on Android the redirect can still reach auth/callback after it.
      if (result.type === 'cancel') clearGoogleSignInPending();
      if (result.type === 'success' && result.url) {
        // The browser captured the redirect before the OS could route it.
        // auth/callback.tsx is the single place a returned token is used, so
        // hand the result there rather than racing the Linking listener.
        const { queryParams } = Linking.parse(result.url);
        const token = typeof queryParams?.token === 'string' ? queryParams.token : null;
        const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
        if (!token) throw new Error(error === 'google_unavailable' ? 'Google sign-in is not available right now.' : 'Google sign-in failed. Please try again.');
        router.replace(`/auth/callback?token=${encodeURIComponent(token)}` as Href);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (appleLoading) return;
    setAppleLoading(true);
    setError(null);
    try {
      // Cryptographically random nonce — needed for Apple's replay-attack prevention
      const rawNonceBytes = await getRandomBytesAsync(16);
      const rawNonce = Array.from(rawNonceBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const hashedNonce = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken)
        throw new Error("No identity token from Apple.");

      // Apple shares the name only on the first sign-in; the backend keeps it.
      const givenName = credential.fullName?.givenName ?? "";
      const familyName = credential.fullName?.familyName ?? "";
      const fullName = [givenName, familyName].filter(Boolean).join(" ");

      const res = await auth.signInWithApple(credential.identityToken, rawNonce, fullName || undefined);
      await signInWithToken(res.token);
      trackLogin("apple");
    } catch (err: unknown) {
      // ERR_REQUEST_CANCELED = user dismissed the Apple sheet — not an error worth showing
      if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
      setError(
        err instanceof Error
          ? err.message
          : "Apple sign-in failed. Please try again.",
      );
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleSend() {
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await withNetworkRetry(() => auth.sendOtp(phone.trim(), 'whatsapp'));
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: phone.trim(), sessionId: res.sessionId, channel: res.channel },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + Spacing[8],
            paddingBottom: insets.bottom + Spacing[6],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require("@/assets/logo/logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        {/* Headings */}
        <Text
          style={[
            styles.heading,
            { color: colors.text, fontFamily: fonts.display },
          ]}
        >
          Welcome back
        </Text>
        <Text
          style={[
            styles.subheading,
            { color: colors.textMuted, fontFamily: fonts.body },
          ]}
        >
          Log in or create an account to continue.
        </Text>

        {/* Phone input */}
        <View style={styles.inputGroup}>
          <Text
            style={[
              styles.label,
              { color: colors.textMuted, fontFamily: fonts.bodyMedium },
            ]}
          >
            Mobile number
          </Text>
          <View
            style={[
              styles.inputRow,
              {
                borderColor: error
                  ? colors.error
                  : isValid
                    ? colors.primary
                    : colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View style={[styles.prefix, { borderRightColor: colors.border }]}>
              <Text
                style={[
                  styles.prefixText,
                  { color: colors.text, fontFamily: fonts.bodyMedium },
                ]}
              >
                +91
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, fontFamily: fonts.body },
              ]}
              value={phone}
              onChangeText={(t) => {
                setError(null);
                setPhone(t.replace(/\D/g, "").slice(0, 10));
              }}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              accessibilityLabel="Mobile number"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleSend}
              autoFocus
            />
            {phone.length === 10 && (
              <Ionicons
                name={isValid ? "checkmark-circle" : "close-circle"}
                size={20}
                color={isValid ? colors.primary : colors.error}
                style={styles.inputIcon}
              />
            )}
          </View>
          <View style={styles.inputHint}>
            <Text
              style={[
                styles.inputHintText,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              We&apos;ll send a verification code to this number
            </Text>
          </View>
          {error && (
            <View style={styles.errorRow}>
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={colors.error}
              />
              <Text
                style={[
                  styles.errorText,
                  { color: colors.error, fontFamily: fonts.body },
                ]}
              >
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: isValid ? colors.primary : colors.surface2 },
            isValid ? (Shadows.sm as object) : undefined,
            loading && { opacity: 0.6 },
          ]}
          onPress={handleSend}
          disabled={!isValid || loading || googleLoading}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.primaryBtnText,
              {
                color: isValid ? "#fff" : colors.textMuted,
                fontFamily: fonts.bodySemibold,
              },
            ]}
          >
            {loading ? "Sending OTP…" : "Continue"}
          </Text>
          {!loading && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={isValid ? "#fff" : colors.textMuted}
            />
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
          <Text
            style={[
              styles.dividerText,
              { color: colors.textMuted, fontFamily: fonts.body },
            ]}
          >
            or
          </Text>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
        </View>

        {/* Sign in with Apple — iOS only, shown first per Apple HIG */}
        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={[
              styles.socialBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              (loading || googleLoading || appleLoading) && { opacity: 0.6 },
            ]}
            onPress={handleAppleSignIn}
            disabled={appleLoading || loading || googleLoading}
            activeOpacity={0.8}
            accessibilityLabel="Sign in with Apple"
            accessibilityRole="button"
          >
            <Ionicons name="logo-apple" size={22} color={colors.text} />
            <Text
              style={[
                styles.socialBtnText,
                { color: colors.text, fontFamily: fonts.bodyMedium },
              ]}
            >
              {appleLoading ? "Signing in…" : "Continue with Apple"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Google OAuth */}
        <TouchableOpacity
          style={[
            styles.socialBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginBottom: Spacing[7],
            },
            (loading || googleLoading) && { opacity: 0.6 },
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || loading}
          activeOpacity={0.8}
          accessibilityLabel="Sign in with Google"
          accessibilityRole="button"
        >
          {!googleLoading && (
            <Image
              source={require("@/assets/images/google-g.png")}
              style={styles.socialIcon}
              contentFit="contain"
            />
          )}
          <Text
            style={[
              styles.socialBtnText,
              { color: colors.text, fontFamily: fonts.bodyMedium },
            ]}
          >
            {googleLoading ? "Signing in…" : "Continue with Google"}
          </Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text
          style={[
            styles.terms,
            { color: colors.textMuted, fontFamily: fonts.body },
          ]}
        >
          {"By continuing, you agree to our\n"}
          <Text
            style={{ color: colors.primary }}
            onPress={() =>
              void WebBrowser.openBrowserAsync("https://satviksalaad.com/terms")
            }
            accessibilityRole="link"
          >
            Terms & Conditions
          </Text>
          {" and "}
          <Text
            style={{ color: colors.primary }}
            onPress={() =>
              void WebBrowser.openBrowserAsync(
                "https://satviksalaad.com/privacy-policy",
              )
            }
            accessibilityRole="link"
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[5],
  },

  logoSection: {
    marginBottom: Spacing[7],
  },
  logo: {
    width: 130,
    height: 80,
  },

  heading: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.5,
    marginBottom: Spacing[2],
  },
  subheading: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.5,
    marginBottom: Spacing[7],
  },

  inputGroup: {
    gap: Spacing[2],
    marginBottom: Spacing[5],
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    overflow: "hidden",
    minHeight: 52,
  },
  prefix: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    borderRightWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  prefixText: {
    fontSize: FontSize.md,
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
    paddingHorizontal: Spacing[3],
    letterSpacing: 1,
  },
  inputIcon: { marginRight: Spacing[3] },
  inputHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  inputHintText: {
    fontSize: FontSize.xs,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1],
  },
  errorText: {
    fontSize: FontSize.sm,
    flex: 1,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: 52,
    borderRadius: Radius.full,
    marginBottom: Spacing[5],
  },
  primaryBtnText: {
    fontSize: FontSize.md,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Spacing[5],
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.1,
  },

  // Shared style for all social sign-in buttons (Apple + Google)
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    marginBottom: Spacing[3],
  },
  socialBtnText: {
    fontSize: FontSize.md,
  },
  socialIcon: {
    width: 22,
    height: 22,
  },

  terms: {
    fontSize: FontSize.xs,
    textAlign: "center",
    lineHeight: FontSize.xs * 1.6,
  },
});
