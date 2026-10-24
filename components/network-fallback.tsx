import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { type NetworkErrorKind, useNetwork } from '@/context/network';
import { useTheme } from '@/hooks/use-theme';

// ─── Error copy ───────────────────────────────────────────────────────────────

interface ErrorCopy {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}

function getCopy(kind: NetworkErrorKind): ErrorCopy {
  switch (kind) {
    case 'no_internet':
      return {
        icon:  'wifi-outline',
        title: 'You\'re offline',
        body:  'It looks like your internet is disconnected. Turn on Wi-Fi or mobile data and we\'ll reconnect automatically.',
      };
    case 'timeout':
      return {
        icon:  'time-outline',
        title: 'Taking longer than usual',
        body:  'Things are a little slow right now. No action needed, we\'ll sort it out for you.',
      };
    default:
      return {
        icon:  'cloud-offline-outline',
        title: 'We hit a small snag',
        body:  'Something on our end isn\'t quite right. Please try again in a little while.',
      };
  }
}

// ─── Pulsing icon ─────────────────────────────────────────────────────────────

function PulseIcon({
  name,
  color,
  bg,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.18,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.iconWrapper}>
      {/* Pulsing halo ring */}
      <Animated.View
        style={[
          styles.halo,
          { backgroundColor: bg, transform: [{ scale }], opacity },
        ]}
      />
      {/* Icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>
        <Ionicons name={name} size={36} color={color} />
      </View>
    </View>
  );
}

// ─── Countdown badge ──────────────────────────────────────────────────────────

function CountdownBadge({
  seconds,
  attempt,
  colors,
  fonts,
}: {
  seconds: number;
  attempt: number;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
}) {
  const label = seconds > 0
    ? `Checking again in ${seconds}s…`
    : 'Checking connection…';

  return (
    <View style={[styles.badge, { backgroundColor: colors.surface2 }]}>
      <View style={[styles.badgeDot, { backgroundColor: attempt > 0 ? colors.warning : colors.primary }]} />
      <Text style={[styles.badgeText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NetworkFallback() {
  const { networkError, retryNow } = useNetwork();
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  const slideY = useRef(new Animated.Value(60)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  const visible = networkError !== null;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(slideY, {
          toValue: 0,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideY.setValue(60);
      fadeIn.setValue(0);
    }
  }, [visible, fadeIn, slideY]);

  if (!networkError) return null;

  const copy = getCopy(networkError.kind);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          { backgroundColor: colors.background, opacity: fadeIn },
        ]}
      >
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + Spacing[8], paddingBottom: insets.bottom + Spacing[6] },
          ]}
        >
          {/* Illustration area */}
          <Animated.View
            style={[styles.illustrationWrap, { transform: [{ translateY: slideY }] }]}
          >
            <PulseIcon
              name={copy.icon}
              color={colors.primary}
              bg={colors.primaryBg}
            />
          </Animated.View>

          {/* Text block */}
          <Animated.View style={[styles.textBlock, { transform: [{ translateY: slideY }] }]}>
            <Text
              style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}
            >
              {copy.title}
            </Text>
            <Text
              style={[styles.body, { color: colors.textMuted, fontFamily: fonts.body }]}
            >
              {copy.body}
            </Text>
          </Animated.View>

          {/* Countdown */}
          <CountdownBadge
            seconds={networkError.secondsLeft}
            attempt={networkError.attempt}
            colors={colors}
            fonts={fonts}
          />

          {/* Retry button */}
          <Animated.View style={{ transform: [{ translateY: slideY }], width: '100%' }}>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.75}
              onPress={retryNow}
              accessibilityLabel="Retry connection"
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={styles.retryIcon} />
              <Text style={[styles.retryText, { fontFamily: fonts.bodySemibold }]}>
                Try again
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Decorative footer label */}
          <Text style={[styles.footer, { color: colors.textDisabled, fontFamily: fonts.body }]}>
            We&apos;ll keep trying until you&apos;re back online
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
    gap: Spacing[5],
  },

  // Icon
  iconWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: Radius.full,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrap: {
    marginBottom: Spacing[2],
  },

  // Text
  textBlock: {
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  title: {
    fontSize: FontSize['2xl'],
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: FontSize.sm,
  },

  // Button
  retryBtn: {
    width: '100%',
    height: 52,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  // Footer
  footer: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
});
