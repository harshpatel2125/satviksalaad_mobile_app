import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDay } from '@/lib/subscription-view';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { trackPurchase } from '@/lib/analytics';
import { useTheme } from '@/hooks/use-theme';

export default function PaymentSuccessScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { planName, orderId, amountRs, startsOn, endsOn, renewal, unit: unitParam } = useLocalSearchParams<{
    planName?: string;
    orderId?: string;
    amountRs?: string;
    startsOn?: string;
    endsOn?: string;
    renewal?: string;
    /** The plan's word for one, e.g. "bowl". */
    unit?: string;
  }>();
  const unit = unitParam || 'bowl';
  const queued = renewal === 'true';

  useEffect(() => {
    if (orderId) {
      trackPurchase(orderId, Number(amountRs ?? '0'), [{ item_id: orderId, item_name: planName ?? 'Plan' }]);
    }
    void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    void queryClient.invalidateQueries({ queryKey: ['home'] });
    void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = startsOn && endsOn ? `Starts ${formatDay(startsOn)} · valid till ${formatDay(endsOn)}` : null;
  const subtitle = queued
    ? `${planName ?? 'Your next subscription'} is booked to start after your current one.`
    : `${planName ?? 'Your subscription'} is confirmed.`;
  const expectations: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
    { icon: 'notifications-outline', text: "You'll receive an SMS confirmation shortly" },
    {
      icon: 'calendar-outline',
      text: startsOn
        ? `Your first ${unit} arrives on ${formatDay(startsOn)}`
        : `Your first ${unit} arrives on your first delivery day`,
    },
    { icon: 'leaf-outline', text: `Skip a day before its cutoff and that ${unit} moves to the end` },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Success icon */}
        <View style={[styles.iconCircle, { backgroundColor: colors.successBg }]}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        </View>

        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>
          You&apos;re all set!
        </Text>

        <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {subtitle}
        </Text>

        <View style={[styles.infoCard, { backgroundColor: colors.primaryBg, borderColor: colors.primaryTint }]}>
          <Ionicons name="leaf-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primaryDark, fontFamily: fonts.bodyMedium }]}>
            {dates ?? 'Your deliveries will be scheduled on your days automatically.'}
          </Text>
        </View>

        <View style={[styles.expectCard, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
          {expectations.map((item, i) => (
            <View key={i} style={[styles.expectRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Ionicons name={item.icon} size={16} color={colors.primary} />
              <Text style={[styles.expectText, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[4] }]}>
        <TouchableOpacity
          style={[styles.homeBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.85}>
          <Text style={[styles.homeBtnText, { fontFamily: fonts.bodySemibold }]}>
            Go to home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deliveriesBtn, { borderColor: colors.border }]}
          onPress={() => router.replace('/(tabs)/deliveries')}
          activeOpacity={0.7}>
          <Text style={[styles.deliveriesBtnText, { color: colors.text, fontFamily: fonts.bodyMedium }]}>
            View my deliveries
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[7],
    gap: Spacing[5],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  title: {
    fontSize: FontSize['3xl'],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing[2],
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  footer: {
    paddingHorizontal: Spacing[5],
    gap: Spacing[3],
  },
  homeBtn: {
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnText: {
    fontSize: FontSize.base,
    color: '#fff',
  },
  deliveriesBtn: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  deliveriesBtnText: {
    fontSize: FontSize.base,
  },
  expectCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  expectRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: Spacing[3],
    padding: Spacing[3],
  },
  expectText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
});
