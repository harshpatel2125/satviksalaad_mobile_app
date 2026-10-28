import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/glass-view';
import { Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useThemePreference } from '@/context/theme-preference';
import { useTheme } from '@/hooks/use-theme';

const IS_IOS = Platform.OS === 'ios';
// The mark's dark green is lost on the dark header, so there it takes the cream of logo-cream.png.
const DARK_MARK_TINT = '#F8F6E2';

function getGreeting(): string {
  const h = parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
    10,
  );
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface HomeHeaderProps {
  scrollY: SharedValue<number>;
  onBellPress: () => void;
  hasBellDot?: boolean;
}

export function HomeHeader({ scrollY, onBellPress, hasBellDot = true }: HomeHeaderProps) {
  const { colors, fonts } = useTheme();
  const { effectiveScheme: scheme } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { profile, cachedName } = useAuth();

  // profile.full_name is authoritative; cachedName (MMKV) fills in instantly on second+ opens
  const firstName = (profile?.full_name ?? cachedName)?.trim().split(' ')[0] ?? null;
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : null;

  // Solid background fades out on scroll (iOS) to reveal the blur layer — liquid glass
  const solidBgStyle = useAnimatedStyle(() => ({
    opacity: IS_IOS
      ? interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP)
      : 1,
  }));

  // Bottom separator fades in as user scrolls past the fold
  const borderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background layers are wrapped in their own clipping view so the glass
          effect stays contained without clipping the text content above it. */}
      <View style={[StyleSheet.absoluteFill, styles.backgroundClip]}>
        {IS_IOS && (
          <GlassView
            intensity={80}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, solidBgStyle]}
        />
      </View>

      <View style={[styles.content, column()]}>
        <View style={styles.row}>
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/logo/logo-mark.png')}
              tintColor={scheme === 'dark' ? DARK_MARK_TINT : null}
              style={styles.logo}
              contentFit="contain"
            />
            <View style={styles.brandText}>
              {greeting ? (
                <Text style={[styles.greeting, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>
                  {greeting}
                </Text>
              ) : null}
              <Text style={[styles.brand, { color: colors.primary, fontFamily: fonts.display }]}>
                Satvik Salaad
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onBellPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
            style={[styles.bell, { backgroundColor: colors.sageSoft }]}
            accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {hasBellDot && (
              <View style={[styles.bellDot, { backgroundColor: colors.error, borderColor: colors.sageSoft }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom separator — fades in on scroll */}
      <Animated.View
        style={[styles.border, { backgroundColor: colors.border }, borderStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No overflow: 'hidden' here — it would clip font glyphs at the container edge.
    // Background clipping is handled by the backgroundClip wrapper instead.
  },
  backgroundClip: {
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop: IS_IOS ? 0 : Spacing[3],
    paddingBottom: Spacing[2] + 2,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    flexShrink: 1,
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandText: {
    flexShrink: 1,
  },
  brand: {
    fontSize: 21,
    letterSpacing: -0.2,
  },
  greeting: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  border: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
