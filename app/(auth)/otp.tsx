import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { BackButton } from '@/components/ui/screen-header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '@/lib/api';
import { trackLogin, trackSignUp } from '@/lib/analytics';
import { signInWithToken } from '@/lib/auth-session';
import { withNetworkRetry } from '@/lib/network-retry';
import { FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { column, NARROW_WIDTH } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth';
import { OtpBoxRow, type OtpBoxRowHandle } from '@/components/ui/otp-box-row';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone, sessionId, channel: initialChannel } = useLocalSearchParams<{
    phone: string;
    sessionId: string;
    channel: string;
  }>();
  const { requestNameScreen } = useAuth();

  // channel tracks the currently active delivery method
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>(
    initialChannel === 'sms' ? 'sms' : 'whatsapp',
  );
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);

  const [filledCount, setFilledCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [switchingToSms, setSwitchingToSms] = useState(false);

  const otpRef = useRef<OtpBoxRowHandle>(null);

  useEffect(() => {
    setTimeout(() => otpRef.current?.focusFirst(), 200);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verify = useCallback(
    async (code: string) => {
      if (code.length < OTP_LENGTH || !currentSessionId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await withNetworkRetry(() => auth.verifyOtp(currentSessionId, code));
        if (!res.token) throw new Error('Verification failed. Please try again.');

        // Before the session lands, so the router sends a nameless account to
        // the name screen rather than the home tabs.
        if (!res.hasName) {
          requestNameScreen();
        }
        await signInWithToken(res.token);

        if (res.isNewUser) {
          trackSignUp('phone');
        } else {
          trackLogin('phone');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
        setLoading(false);
      }
    },
    [currentSessionId, requestNameScreen],
  );

  async function handleResend(resendChannel: 'whatsapp' | 'sms' = channel) {
    if (resending || switchingToSms) return;
    if (resendChannel === channel && countdown > 0) return;
    setResending(true);
    setError(null);
    otpRef.current?.reset();
    try {
      const res = await auth.sendOtp(phone!, resendChannel);
      setCurrentSessionId(res.sessionId);
      setChannel(res.channel);
      router.setParams({ sessionId: res.sessionId, channel: res.channel });
      setCountdown(res.resendAfterSeconds ?? RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setResending(false);
      setSwitchingToSms(false);
      setTimeout(() => otpRef.current?.focusFirst(), 100);
    }
  }

  async function handleSwitchToSms() {
    setSwitchingToSms(true);
    await handleResend('sms');
  }

  const maskedPhone = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : '';
  const isWhatsApp = channel === 'whatsapp';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View
        style={[
          styles.inner,
          column(NARROW_WIDTH),
          { paddingTop: insets.top + Spacing[2], paddingBottom: insets.bottom + Spacing[6] },
        ]}>

        {/* Back */}
        <View style={styles.back}>
          <BackButton onPress={() => router.back()} />
        </View>

        {/* Channel badge */}
        <View style={[styles.channelBadge, { backgroundColor: isWhatsApp ? '#E7F9EE' : colors.surface2, borderColor: isWhatsApp ? '#A8E6BE' : colors.border }]}>
          {isWhatsApp ? (
            <FontAwesome5 name="whatsapp" size={14} color="#25D366" />
          ) : (
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
          )}
          <Text style={[styles.channelBadgeText, { color: isWhatsApp ? '#1A7A3C' : colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            {isWhatsApp ? 'WhatsApp' : 'SMS'}
          </Text>
        </View>

        {/* Heading */}
        <Text style={[styles.heading, { color: colors.text, fontFamily: fonts.display }]}>
          {isWhatsApp ? 'Check your WhatsApp' : 'Check your SMS'}
        </Text>
        <View style={styles.subRow}>
          <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.body }]}>
            We sent a 4-digit code to{' '}
            <Text style={{ color: colors.text, fontFamily: fonts.bodySemibold }}>
              {maskedPhone}
            </Text>
            {isWhatsApp ? ' via WhatsApp.' : ' via SMS.'}{' '}
          </Text>
          <TouchableOpacity onPress={() => router.back()} disabled={loading} activeOpacity={0.7}>
            <Text style={[styles.changeLink, { color: loading ? colors.textMuted : colors.primary, fontFamily: fonts.bodyMedium }]}>
              Change
            </Text>
          </TouchableOpacity>
        </View>

        {/* OTP boxes */}
        <OtpBoxRow
          ref={otpRef}
          error={error}
          backgroundColor={colors.surface}
          onComplete={(code) => void verify(code)}
          onChange={(_, count) => { setFilledCount(count); setError(null); }}
          style={styles.boxRow}
        />

        {/* Resend / SMS fallback */}
        <View style={styles.resendSection}>
          {switchingToSms ? (
            <Text style={[styles.resendCountdown, { color: colors.textMuted, fontFamily: fonts.body }]}>
              Sending OTP via SMS…
            </Text>
          ) : (
            <>
              {countdown > 0 && (
                <Text style={[styles.resendCountdown, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  Available in{' '}
                  <Text style={{ color: colors.text, fontFamily: fonts.bodySemibold }}>
                    0:{String(countdown).padStart(2, '0')}
                  </Text>
                </Text>
              )}
              <View style={[styles.resendRow, (countdown > 0 || loading) && styles.optionDimmed]}>
                <TouchableOpacity
                  onPress={() => void handleResend()}
                  disabled={countdown > 0 || resending || loading}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  {resending ? (
                    <Text style={[styles.resendCountdown, { color: colors.textMuted, fontFamily: fonts.body }]}>
                      Resending…
                    </Text>
                  ) : (
                    <Text style={[styles.resendLink, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                      {isWhatsApp ? 'Resend via WhatsApp' : 'Resend via SMS'}
                    </Text>
                  )}
                </TouchableOpacity>
                {isWhatsApp && (
                  <>
                    <Text style={[styles.resendDot, { color: colors.textMuted, fontFamily: fonts.body }]}>·</Text>
                    <TouchableOpacity
                      onPress={() => void handleSwitchToSms()}
                      disabled={countdown > 0 || resending || loading}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={[styles.resendLink, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>
                        Try via SMS
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error, fontFamily: fonts.body }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Verify CTA */}
        <TouchableOpacity
          style={[
            styles.verifyBtn,
            { backgroundColor: filledCount === OTP_LENGTH ? colors.primary : colors.surface2 },
            filledCount === OTP_LENGTH ? (Shadows.sm as object) : undefined,
            loading && { opacity: 0.6 },
          ]}
          onPress={() => void verify(otpRef.current?.getCode() ?? '')}
          disabled={filledCount < OTP_LENGTH || loading}
          activeOpacity={0.85}>
          <Text
            style={[
              styles.verifyBtnText,
              {
                color: filledCount === OTP_LENGTH ? '#fff' : colors.textMuted,
                fontFamily: fonts.bodySemibold,
              },
            ]}>
            {loading ? 'Verifying…' : 'Verify and continue'}
          </Text>
        </TouchableOpacity>

        {/* Security note */}
        <View style={[styles.securityNote, { backgroundColor: colors.primaryTint }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
          <Text style={[styles.securityText, { color: colors.primaryDark, fontFamily: fonts.body }]}>
            We never share your number. The OTP expires in 10 minutes.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing[5],
  },
  back: {
    marginBottom: Spacing[5],
    alignSelf: "flex-start",
  },
  channelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing[4],
  },
  channelBadgeText: {
    fontSize: FontSize.sm,
  },
  heading: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.5,
    marginBottom: Spacing[2],
  },
  subRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: Spacing[7],
    gap: 2,
  },
  subtitle: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.5,
    flexShrink: 1,
  },
  changeLink: {
    fontSize: FontSize.base,
  },

  boxRow: {
    marginBottom: Spacing[4],
  },

  resendSection: {
    alignItems: "center",
    marginBottom: Spacing[5],
    gap: Spacing[2],
  },
  resendCountdown: {
    fontSize: FontSize.sm,
  },
  resendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing[2],
  },
  resendLink: {
    fontSize: FontSize.base,
  },
  resendDot: {
    fontSize: FontSize.base,
  },
  optionDimmed: {
    opacity: 0.4,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    marginBottom: Spacing[4],
  },
  errorText: {
    fontSize: FontSize.sm,
    flex: 1,
  },

  verifyBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: Radius.full,
    marginBottom: Spacing[4],
  },
  verifyBtnText: {
    fontSize: FontSize.md,
  },

  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  securityText: {
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: FontSize.sm * 1.5,
  },
});
