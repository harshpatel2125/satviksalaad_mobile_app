import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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

import { useAuth } from '@/context/auth';
import { profileApi } from '@/lib/api';
import { FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { NARROW_WIDTH, column } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';

export default function NameScreen() {
  const { colors, fonts, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { clearPendingNameRoute, refreshProfile, profile } = useAuth();

  const [name, setName] = useState(prefill ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;

  async function handleSubmit() {
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);

    try {
      await profileApi.update({ full_name: trimmed });
      // Clear name-screen flag synchronously so the guard doesn't redirect back.
      clearPendingNameRoute();
      // Refresh profile in background so the rest of the app has the updated name.
      void refreshProfile();
      router.replace((profile?.role === 'delivery_partner' ? '/(delivery-partner)' : '/(tabs)') as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your name. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      {/* Prevent back gesture — name entry is required to proceed. */}
      <Stack.Screen options={{ gestureEnabled: false, animation: 'fade' }} />

      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[
            column(NARROW_WIDTH),
            styles.scroll,
            { paddingTop: insets.top + Spacing[8], paddingBottom: insets.bottom + Spacing[6] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={styles.logoSection}>
            <Image
              source={
                isDark
                  ? require('@/assets/logo/logo-cream.png')
                  : require('@/assets/logo/logo.png')
              }
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          {/* Headings */}
          <Text style={[styles.heading, { color: colors.text, fontFamily: fonts.display }]}>
            One last step!
          </Text>
          <Text style={[styles.subheading, { color: colors.textMuted, fontFamily: fonts.body }]}>
            What should we call you? This appears on your orders.
          </Text>

          {/* Name input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
              Your name
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  borderColor: error ? colors.error : isValid ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                },
              ]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.text, fontFamily: fonts.body }]}
                value={name}
                onChangeText={(t) => {
                  setError(null);
                  setName(t);
                }}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoFocus
                maxLength={60}
              />
              {name.length > 0 && (
                <Ionicons
                  name={isValid ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isValid ? colors.primary : colors.error}
                  style={styles.inputIcon}
                />
              )}
            </View>
            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error, fontFamily: fonts.body }]}>
                  {error}
                </Text>
              </View>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: isValid ? colors.primary : colors.surface2 },
              isValid ? (Shadows.sm as object) : undefined,
              loading && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
            activeOpacity={0.85}>
            <Text
              style={[
                styles.primaryBtnText,
                { color: isValid ? '#fff' : colors.textMuted, fontFamily: fonts.bodySemibold },
              ]}>
              {loading ? 'Saving…' : 'Continue'}
            </Text>
            {!loading && (
              <Ionicons name="arrow-forward" size={18} color={isValid ? '#fff' : colors.textMuted} />
            )}
          </TouchableOpacity>

          {/* Reassurance */}
          <View style={[styles.note, { backgroundColor: colors.primaryTint }]}>
            <Ionicons name="leaf-outline" size={15} color={colors.primaryDark} />
            <Text style={[styles.noteText, { color: colors.primaryDark, fontFamily: fonts.body }]}>
              You can change your name anytime from your profile.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
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
    width: 176,
    aspectRatio: 1200 / 504,
  },

  heading: {
    fontSize: FontSize['3xl'],
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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    minHeight: 52,
    paddingHorizontal: Spacing[4],
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
    paddingVertical: Spacing[3],
  },
  inputIcon: { marginLeft: Spacing[2] },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  errorText: {
    fontSize: FontSize.sm,
    flex: 1,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 52,
    borderRadius: Radius.full,
    marginBottom: Spacing[5],
  },
  primaryBtnText: {
    fontSize: FontSize.md,
  },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  noteText: {
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: FontSize.sm * 1.5,
  },
});
