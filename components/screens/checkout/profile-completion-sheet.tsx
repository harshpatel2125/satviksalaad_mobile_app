import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { auth, profileApi } from '@/lib/api';
import { OtpBoxRow, type OtpBoxRowHandle } from '@/components/ui/otp-box-row';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

type SheetStep = 'phone' | 'otp' | 'name';

export interface ProfileCompletionSheetProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  needsPhone: boolean;
  needsName: boolean;
}

export function ProfileCompletionSheet({
  visible,
  onClose,
  onComplete,
  needsPhone,
  needsName,
}: ProfileCompletionSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();

  const stepList: SheetStep[] = React.useMemo(() => {
    const s: SheetStep[] = [];
    if (needsPhone) { s.push('phone'); s.push('otp'); }
    if (needsName) s.push('name');
    return s;
  }, [needsPhone, needsName]);

  const totalSteps = stepList.length;
  const initialStep: SheetStep = needsPhone ? 'phone' : 'name';

  const [step, setStep] = useState<SheetStep>(initialStep);
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [filledCount, setFilledCount] = useState(0);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [switchingToSms, setSwitchingToSms] = useState(false);

  const otpRef = useRef<OtpBoxRowHandle>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const nameRef = useRef<TextInput | null>(null);

  const keyboardOffset = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardOffset.value = withTiming(e.endCoordinates.height, { duration: 250 });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardOffset.value = withTiming(0, { duration: 200 });
    });
    return () => { show.remove(); hide.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keyboardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardOffset.value }],
  }));

  // Reset state and keyboard offset on each visibility change
  useEffect(() => {
    if (!visible) {
      // Always reset the keyboard offset when sheet closes so it doesn't
      // carry stale translateY into the next open (Android may not dismiss
      // the keyboard before the modal unmounts, leaving a non-zero offset).
      keyboardOffset.value = 0;
      Keyboard.dismiss();
      return;
    }
    setStep(initialStep);
    setPhone('');
    setSessionId('');
    setFilledCount(0);
    setName('');
    setLoading(false);
    setError(null);
    setChannel('whatsapp');
    setCountdown(RESEND_SECONDS);
    setResending(false);
    setSwitchingToSms(false);
    setTimeout(() => {
      if (needsPhone) phoneRef.current?.focus();
      else nameRef.current?.focus();
    }, 350);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // OTP countdown
  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown]);

  // Auto-focus when step changes
  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRef.current?.focusFirst(), 200);
    if (step === 'name') setTimeout(() => nameRef.current?.focus(), 200);
  }, [step]);

  const currentStepIndex = stepList.indexOf(step);

  // ── Phone: send OTP ────────────────────────────────────────────────────────

  async function handleSendOtp() {
    const trimmed = phone.replace(/\s/g, '');
    if (!/^[6-9]\d{9}$/.test(trimmed)) {
      setError('Enter a valid 10-digit mobile number starting with 6-9');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await auth.sendOtp(trimmed, 'whatsapp');
      setSessionId(res.sessionId);
      setChannel(res.channel);
      setCountdown(res.resendAfterSeconds ?? RESEND_SECONDS);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── OTP: verify phone ownership, save to profile ───────────────────────────
  // The caller is already signed in, so the verify call only proves ownership
  // of the number; it must not start a new session here.

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (code.length < OTP_LENGTH || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        await auth.verifyOtp(sessionId, code);
        try {
          await profileApi.update({ phone: phone.replace(/\s/g, '') });
        } catch (updateErr) {
          const msg = updateErr instanceof Error ? updateErr.message : '';
          if (msg.toLowerCase().includes('already linked')) {
            setStep('phone');
            setPhone('');
            setError(msg);
            return;
          }
          throw updateErr;
        }
        if (needsName) {
          setStep('name');
        } else {
          await refreshProfile();
          onComplete();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed. Try again.');
      } finally {
        setLoading(false);
      }
    },
    [sessionId, phone, needsName, refreshProfile, onComplete],
  );

  async function handleResend(resendChannel: 'whatsapp' | 'sms' = channel) {
    if ((resendChannel === channel && countdown > 0) || resending || switchingToSms) return;
    setResending(true);
    setError(null);
    otpRef.current?.reset();
    try {
      const res = await auth.sendOtp(phone.replace(/\s/g, ''), resendChannel);
      setSessionId(res.sessionId);
      setChannel(res.channel);
      setCountdown(res.resendAfterSeconds ?? RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP.');
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

  // ── Name: save full name ───────────────────────────────────────────────────

  async function handleSaveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Enter your full name (at least 2 characters)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await profileApi.update({ full_name: trimmed });
      await refreshProfile();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Try again.');
      setLoading(false);
    }
  }

  const isWhatsApp = channel === 'whatsapp';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => { /* only the X icon closes this sheet */ }}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop — non-interactive: user must use the X icon to close */}
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.duration(300).easing(Easing.out(Easing.ease))}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.sheet,
            keyboardStyle,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing[4]),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.display }]}>
                {step === 'phone' && 'Add your mobile number'}
                {step === 'otp' && "Verify it's you"}
                {step === 'name' && "What's your name?"}
              </Text>
              <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {step === 'phone' && 'We\'ll send a code via WhatsApp'}
                {step === 'otp' && `Code sent to +91 ${phone} via ${isWhatsApp ? 'WhatsApp' : 'SMS'}`}
                {step === 'name' && 'Shown on your delivery'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surface2 }]}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Step progress dots */}
          {totalSteps > 1 && (
            <View style={styles.stepRow}>
              {stepList.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: i <= currentStepIndex ? colors.primary : colors.border,
                      width: i === currentStepIndex ? 20 : 8,
                    },
                  ]}
                />
              ))}
              <Text style={[styles.stepLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {currentStepIndex + 1} of {totalSteps}
              </Text>
            </View>
          )}

          {/* ── Phone step ──────────────────────────────────────────────────── */}
          {step === 'phone' && (
            <View style={styles.body}>
              <View
                style={[
                  styles.phoneRow,
                  {
                    backgroundColor: colors.background,
                    borderColor: error ? colors.error : colors.border,
                  },
                ]}
              >
                <View style={[styles.prefix, { borderRightColor: colors.border }]}>
                  <Text style={[styles.prefixText, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                    +91
                  </Text>
                </View>
                <TextInput
                  ref={phoneRef}
                  style={[styles.phoneInput, { color: colors.text, fontFamily: fonts.body }]}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t.replace(/\D/g, '').slice(0, 10));
                    setError(null);
                  }}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>

              {error && <ErrorBanner message={error} colors={colors} fonts={fonts} />}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: phone.length === 10 ? colors.primary : colors.surface2 },
                  loading && { opacity: 0.6 },
                ]}
                onPress={handleSendOtp}
                disabled={phone.length !== 10 || loading}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    {
                      color: phone.length === 10 ? '#fff' : colors.textMuted,
                      fontFamily: fonts.bodySemibold,
                    },
                  ]}
                >
                  {loading ? 'Sending OTP…' : 'Send verification code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── OTP step ────────────────────────────────────────────────────── */}
          {step === 'otp' && (
            <View style={styles.body}>
              {/* Channel badge + "Change number" on the same row as the subtitle in header */}
              <View style={[styles.channelBadge, { backgroundColor: isWhatsApp ? '#E7F9EE' : colors.surface2, borderColor: isWhatsApp ? '#A8E6BE' : colors.border }]}>
                {isWhatsApp ? (
                  <FontAwesome5 name="whatsapp" size={12} color="#25D366" />
                ) : (
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.textMuted} />
                )}
                <Text style={[styles.channelBadgeText, { color: isWhatsApp ? '#1A7A3C' : colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                  {isWhatsApp ? 'WhatsApp' : 'SMS'}
                </Text>
              </View>

              <View style={styles.subRow}>
                <Text style={[styles.subRowText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  Code sent to{' '}
                  <Text style={{ color: colors.text, fontFamily: fonts.bodySemibold }}>+91 {phone}</Text>
                  {isWhatsApp ? ' via WhatsApp.' : ' via SMS.'}{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => { setStep('phone'); setError(null); setFilledCount(0); }}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.changeLink, { color: loading ? colors.textMuted : colors.primary, fontFamily: fonts.bodyMedium }]}>
                    Change
                  </Text>
                </TouchableOpacity>
              </View>

              <OtpBoxRow
                ref={otpRef}
                error={error}
                backgroundColor={colors.background}
                onComplete={(code) => void handleVerifyOtp(code)}
                onChange={(_, count) => { setFilledCount(count); setError(null); }}
                active={step === 'otp' && visible}
              />

              {/* Resend row — same pattern as auth OTP screen */}
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

              {error && <ErrorBanner message={error} colors={colors} fonts={fonts} />}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor:
                      filledCount === OTP_LENGTH ? colors.primary : colors.surface2,
                  },
                  loading && { opacity: 0.6 },
                ]}
                onPress={() => void handleVerifyOtp(otpRef.current?.getCode() ?? '')}
                disabled={filledCount < OTP_LENGTH || loading}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    {
                      color: filledCount === OTP_LENGTH ? '#fff' : colors.textMuted,
                      fontFamily: fonts.bodySemibold,
                    },
                  ]}
                >
                  {loading ? 'Verifying…' : 'Verify & Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Name step ───────────────────────────────────────────────────── */}
          {step === 'name' && (
            <View style={styles.body}>
              <View
                style={[
                  styles.nameInputWrap,
                  {
                    backgroundColor: colors.background,
                    borderColor: error ? colors.error : colors.border,
                  },
                ]}
              >
                <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                <TextInput
                  ref={nameRef}
                  style={[styles.nameInput, { color: colors.text, fontFamily: fonts.body }]}
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    setError(null);
                  }}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
              </View>

              {error && <ErrorBanner message={error} colors={colors} fonts={fonts} />}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor:
                      name.trim().length >= 2 ? colors.primary : colors.surface2,
                  },
                  loading && { opacity: 0.6 },
                ]}
                onPress={handleSaveName}
                disabled={name.trim().length < 2 || loading}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    {
                      color: name.trim().length >= 2 ? '#fff' : colors.textMuted,
                      fontFamily: fonts.bodySemibold,
                    },
                  ]}
                >
                  {loading ? 'Saving…' : 'Save & Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({
  message,
  colors,
  fonts,
}: {
  message: string;
  colors: ReturnType<typeof import('@/hooks/use-theme').useTheme>['colors'];
  fonts: ReturnType<typeof import('@/hooks/use-theme').useTheme>['fonts'];
}) {
  return (
    <View style={[errorStyles.box, { backgroundColor: colors.errorBg }]}>
      <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
      <Text style={[errorStyles.text, { color: colors.error, fontFamily: fonts.body }]}>
        {message}
      </Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  box:  { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], padding: Spacing[3], borderRadius: Radius.md },
  text: { fontSize: FontSize.sm, flex: 1 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  sheet: {
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    paddingBottom: Spacing[4],
  },
  headerTitle: {
    fontSize: FontSize.xl,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[5],
  },
  stepDot: {
    height: 8,
    borderRadius: 4,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    marginLeft: Spacing[1],
  },

  body: {
    gap: Spacing[4],
    paddingBottom: Spacing[2],
  },

  // Phone input
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    height: 54,
  },
  prefix: {
    paddingHorizontal: Spacing[4],
    borderRightWidth: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: FontSize.base,
    letterSpacing: 0.5,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing[4],
    fontSize: FontSize.base,
    letterSpacing: 1,
  },

  // OTP — channel badge + resend
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  channelBadgeText: { fontSize: FontSize.xs },
  resendSection: {
    alignItems: 'center',
    gap: Spacing[1],
  },
  resendCountdown: { fontSize: FontSize.sm },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing[2],
  },
  resendLink: { fontSize: FontSize.sm },
  resendDot: { fontSize: FontSize.sm },
  optionDimmed: { opacity: 0.4 },
  subRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  subRowText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    flexShrink: 1,
  },
  changeLink: { fontSize: FontSize.sm },

  // Name input
  nameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    height: 54,
  },
  nameInput: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.base,
    padding: 0,
  },

  // Primary CTA button
  primaryBtn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: FontSize.base,
  },
});
