import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { BackButton } from '@/components/ui/screen-header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from "@/lib/api";
import { OtpBoxRow, type OtpBoxRowHandle } from '@/components/ui/otp-box-row';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

type EditStep = "form" | "otp";

interface EditProfileSheetProps {
  visible: boolean;
  isPhoneUser: boolean;
  currentName: string;
  currentPhone: string | null;
  currentEmail: string | null;
  onClose: () => void;
  onSave: (data: { full_name?: string; phone?: string; email?: string }) => Promise<void>;
}

export function EditProfileSheet({
  visible,
  isPhoneUser,
  currentName,
  currentPhone,
  currentEmail,
  onClose,
  onSave,
}: EditProfileSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Form state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<EditStep>("form");
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [email, setEmail] = useState(currentEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // ── OTP state ─────────────────────────────────────────────────────────────
  const [pendingPhone, setPendingPhone] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [filledCount, setFilledCount] = useState(0);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [switchingToSms, setSwitchingToSms] = useState(false);
  const otpRef = useRef<OtpBoxRowHandle>(null);

  // Reset on open
  useEffect(() => {
    if (!visible) return;
    setStep("form");
    setName(currentName);
    setPhone(currentPhone ?? "");
    setEmail(currentEmail ?? "");
    setError(null);
    setSaving(false);
    setPhoneVerified(false);
    setFilledCount(0);
    setSessionId("");
    setPendingPhone("");
    setChannel('whatsapp');
    setResending(false);
    setSwitchingToSms(false);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // OTP countdown
  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown]);

  // Auto-focus first OTP box when step transitions
  useEffect(() => {
    if (step === "otp") setTimeout(() => otpRef.current?.focusFirst(), 200);
  }, [step]);

  // Derived
  const phoneChanged = phone.trim().length === 10 && phone.trim() !== (currentPhone ?? "");
  const savingDisabled = saving || (phoneChanged && !phoneVerified);

  // ── Send OTP (triggered by inline Verify button) ───────────────────────────

  async function handleSendOtpForVerify() {
    const newPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(newPhone)) {
      setError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await auth.sendOtp(newPhone, 'whatsapp');
      setSessionId(res.sessionId);
      setChannel(res.channel);
      setPendingPhone(newPhone);
      setCountdown(RESEND_SECONDS);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Form: Save ─────────────────────────────────────────────────────────────

  async function handleSave() {
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (isPhoneUser && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: { full_name?: string; phone?: string; email?: string } = {
        full_name: name.trim(),
      };
      if (phoneVerified && pendingPhone) payload.phone = pendingPhone;
      if (isPhoneUser && email.trim()) payload.email = email.trim();
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── OTP: verify → return to form ──────────────────────────────────────────

  async function handleVerifyOtp(code: string) {
    if (code.length < OTP_LENGTH || !sessionId) return;
    setSaving(true);
    setError(null);
    try {
      await auth.verifyOtp(sessionId, code);
      setPhoneVerified(true);
      setStep("form");
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed. Try again.";
      setError(msg);
      if (msg.toLowerCase().includes("already linked")) {
        setStep("form");
        setPhone("");
        setPhoneVerified(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResend(resendChannel: 'whatsapp' | 'sms' = channel) {
    if ((resendChannel === channel && countdown > 0) || resending || switchingToSms) return;
    setResending(true);
    setError(null);
    otpRef.current?.reset();
    try {
      const res = await auth.sendOtp(pendingPhone, resendChannel);
      setSessionId(res.sessionId);
      setChannel(res.channel);
      setCountdown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP.");
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

  function goBackToForm() {
    setStep("form");
    setError(null);
    setFilledCount(0);
  }

  const isWhatsApp = channel === 'whatsapp';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (saving) return;
        if (step === "otp") goBackToForm();
        else onClose();
      }}
    >
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Only iOS presents this as a card; Android shows it full screen. */}
        {Platform.OS === "ios" ? <View style={[s.grabber, { backgroundColor: colors.border }]} /> : null}
        <View
          style={[
            s.header,
            { paddingTop: Platform.OS === "ios" ? Spacing[2] : insets.top + Spacing[2] },
          ]}
        >
          {step === "otp" ? (
            <BackButton onPress={() => { if (!saving) goBackToForm(); }} />
          ) : (
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={saving ? colors.textDisabled : colors.text} />
            </TouchableOpacity>
          )}

          <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.display }]}>
            {step === "form" ? "Edit profile" : "Verify number"}
          </Text>

          {step === "form" ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={savingDisabled}
              activeOpacity={0.8}
              style={[s.saveBtn, { backgroundColor: savingDisabled ? colors.surface2 : colors.primary }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    s.headerBtn,
                    {
                      color: savingDisabled ? colors.textMuted : colors.textOnPrimary,
                      fontFamily: fonts.bodySemibold,
                    },
                  ]}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {step === "form" ? (
          <ScrollView
        showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Full Name */}
            <View style={s.fieldGroup}>
              <Text
                style={[
                  s.fieldLabel,
                  { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                ]}
              >
                FULL NAME
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: fonts.body,
                  },
                ]}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
              />
            </View>

            {/* Phone */}
            <View style={s.fieldGroup}>
              <Text
                style={[
                  s.fieldLabel,
                  { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                ]}
              >
                PHONE NUMBER
              </Text>
              <View
                style={[
                  s.phoneRow,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: phoneVerified ? colors.success : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.phonePrefixText,
                    { color: colors.text, fontFamily: fonts.body },
                  ]}
                >
                  +91
                </Text>
                <TextInput
                  style={[
                    s.phoneInput,
                    { color: colors.text, fontFamily: fonts.body },
                  ]}
                  value={phone}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/\D/g, "").slice(0, 10);
                    setPhone(cleaned);
                    setError(null);
                    if (phoneVerified) setPhoneVerified(false);
                  }}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {phoneVerified ? (
                  <View style={s.phoneEndSlot}>
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.success}
                    />
                  </View>
                ) : phoneChanged ? (
                  <TouchableOpacity
                    style={[
                      s.phoneVerifyBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handleSendOtpForVerify}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={[
                          s.phoneVerifyBtnText,
                          { color: "#fff", fontFamily: fonts.bodySemibold },
                        ]}
                      >
                        Verify
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
              {phoneVerified ? (
                <Text
                  style={[
                    s.fieldNote,
                    { color: colors.success, fontFamily: fonts.body },
                  ]}
                >
                  Number verified. Tap Save to update.
                </Text>
              ) : phoneChanged ? (
                <Text
                  style={[
                    s.fieldNote,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  Tap Verify to confirm this number
                </Text>
              ) : !currentPhone ? (
                <Text
                  style={[
                    s.fieldNote,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  A mobile number is needed to schedule and receive deliveries
                </Text>
              ) : null}
            </View>

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text
                style={[
                  s.fieldLabel,
                  { color: colors.textMuted, fontFamily: fonts.bodyMedium },
                ]}
              >
                EMAIL
              </Text>
              {!isPhoneUser ? (
                <View
                  style={[
                    s.lockedRow,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={15}
                    color={colors.textMuted}
                  />
                  <Text
                    style={[
                      s.lockedValue,
                      { color: colors.text, fontFamily: fonts.body },
                    ]}
                    numberOfLines={1}
                  >
                    {currentEmail ?? "Not set"}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                      color: colors.text,
                      fontFamily: fonts.body,
                    },
                  ]}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError(null);
                  }}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
              <Text
                style={[
                  s.fieldNote,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {!isPhoneUser ? "Locked: this is your login email" : ""}
              </Text>
            </View>

            {error && (
              <Banner
                type="error"
                message={error}
                colors={colors}
                fonts={fonts}
              />
            )}
          </ScrollView>
        ) : (
          /* OTP step */
          <ScrollView
        showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Channel badge */}
            <View
              style={[
                s.channelBadge,
                {
                  backgroundColor: isWhatsApp ? "#E7F9EE" : colors.surface2,
                  borderColor: isWhatsApp ? "#A8E6BE" : colors.border,
                },
              ]}
            >
              {isWhatsApp ? (
                <FontAwesome5 name="whatsapp" size={12} color="#25D366" />
              ) : (
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={12}
                  color={colors.textMuted}
                />
              )}
              <Text
                style={[
                  s.channelBadgeText,
                  {
                    color: isWhatsApp ? "#1A7A3C" : colors.textMuted,
                    fontFamily: fonts.bodyMedium,
                  },
                ]}
              >
                {isWhatsApp ? "WhatsApp" : "SMS"}
              </Text>
            </View>

            <View style={s.subRow}>
              <Text
                style={[
                  s.otpSubtitle,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                Code sent to{" "}
                <Text
                  style={{ color: colors.text, fontFamily: fonts.bodySemibold }}
                >
                  +91 {pendingPhone}
                </Text>
                {isWhatsApp ? " via WhatsApp." : " via SMS."}{" "}
              </Text>
              <TouchableOpacity
                onPress={goBackToForm}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.changeLink,
                    {
                      color: saving ? colors.textMuted : colors.primary,
                      fontFamily: fonts.bodyMedium,
                    },
                  ]}
                >
                  Change
                </Text>
              </TouchableOpacity>
            </View>

            <OtpBoxRow
              ref={otpRef}
              error={error}
              backgroundColor={colors.surface2}
              onComplete={(code) => void handleVerifyOtp(code)}
              onChange={(_, count) => { setFilledCount(count); setError(null); }}
              active={step === 'otp' && visible}
            />

            {/* Resend row — same pattern as auth OTP screen */}
            <View style={s.resendSection}>
              {switchingToSms ? (
                <Text
                  style={[
                    s.resendCountdown,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  Sending OTP via SMS…
                </Text>
              ) : (
                <>
                  {countdown > 0 && (
                    <Text
                      style={[
                        s.resendCountdown,
                        { color: colors.textMuted, fontFamily: fonts.body },
                      ]}
                    >
                      Available in{" "}
                      <Text
                        style={{
                          color: colors.text,
                          fontFamily: fonts.bodySemibold,
                        }}
                      >
                        0:{String(countdown).padStart(2, "0")}
                      </Text>
                    </Text>
                  )}
                  <View
                    style={[
                      s.resendRow,
                      (countdown > 0 || saving) && s.optionDimmed,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => void handleResend()}
                      disabled={countdown > 0 || resending || saving}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      {resending ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <Text
                          style={[
                            s.resendLink,
                            {
                              color: colors.primary,
                              fontFamily: fonts.bodySemibold,
                            },
                          ]}
                        >
                          {isWhatsApp
                            ? "Resend via WhatsApp"
                            : "Resend via SMS"}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {isWhatsApp && (
                      <>
                        <Text
                          style={[
                            s.resendDot,
                            { color: colors.textMuted, fontFamily: fonts.body },
                          ]}
                        >
                          ·
                        </Text>
                        <TouchableOpacity
                          onPress={() => void handleSwitchToSms()}
                          disabled={countdown > 0 || resending || saving}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <Text
                            style={[
                              s.resendLink,
                              {
                                color: colors.textMuted,
                                fontFamily: fonts.bodySemibold,
                              },
                            ]}
                          >
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
              <Banner
                type="error"
                message={error}
                colors={colors}
                fonts={fonts}
              />
            )}

            <TouchableOpacity
              style={[
                s.verifyBtn,
                {
                  backgroundColor:
                    filledCount === OTP_LENGTH
                      ? colors.primary
                      : colors.surface2,
                },
              ]}
              onPress={() => void handleVerifyOtp(otpRef.current?.getCode() ?? "")}
              disabled={filledCount < OTP_LENGTH || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator
                  color={filledCount === OTP_LENGTH ? "#fff" : colors.textMuted}
                />
              ) : (
                <Text
                  style={[
                    s.verifyBtnText,
                    {
                      color:
                        filledCount === OTP_LENGTH ? "#fff" : colors.textMuted,
                      fontFamily: fonts.bodySemibold,
                    },
                  ]}
                >
                  Verify number
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

type ThemeColors = ReturnType<typeof import('@/hooks/use-theme').useTheme>['colors'];
type ThemeFonts  = ReturnType<typeof import('@/hooks/use-theme').useTheme>['fonts'];

function Banner({ type, message, colors, fonts }: { type: 'error' | 'success'; message: string; colors: ThemeColors; fonts: ThemeFonts }) {
  const isError = type === 'error';
  return (
    <View style={[s.bannerBox, { backgroundColor: isError ? colors.errorBg : colors.successBg }]}>
      <Ionicons name={isError ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={14} color={isError ? colors.error : colors.success} />
      <Text style={[s.bannerText, { color: isError ? colors.error : colors.success, fontFamily: fonts.body }]}>{message}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: Spacing[2] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  headerTitle: { flex: 1, fontSize: FontSize.xl },
  headerBtn: { fontSize: FontSize.sm },
  saveBtn: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.full, minWidth: 68, alignItems: "center" },
  body: { padding: Spacing[5], gap: Spacing[5] },
  fieldGroup: { gap: Spacing[2] },
  fieldLabel: { fontSize: 11, letterSpacing: 0.8 },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    fontSize: FontSize.md,
    minHeight: 48,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.md,
    overflow: "hidden",
    height: 48,
  },
  phonePrefixText: { paddingLeft: Spacing[3], fontSize: FontSize.md, letterSpacing: 0.5 },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingLeft: Spacing[2],
    paddingRight: Spacing[3],
    fontSize: FontSize.md,
    letterSpacing: 1,
  },
  phoneEndSlot: {
    paddingHorizontal: Spacing[3],
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneVerifyBtn: {
    height: "100%",
    paddingHorizontal: Spacing[3],
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  phoneVerifyBtnText: { fontSize: FontSize.sm },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    minHeight: 48,
  },
  lockedValue: { fontSize: FontSize.md, flex: 1 },
  fieldNote: { fontSize: FontSize.xs },
  bannerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  bannerText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },

  // OTP
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
  otpSubtitle: { fontSize: FontSize.sm, lineHeight: 20 },
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
  changeLink: { fontSize: FontSize.sm },
  verifyBtn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[2],
  },
  verifyBtnText: { fontSize: FontSize.base },
});
