import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { ScreenHeader } from '@/components/ui/screen-header';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appSettingsApi } from '@/lib/api';
import { policyUrls } from '@/lib/policy-urls';
import { CACHE_TTL } from '@/lib/query-client';
import type { AppSettings } from '@/types/api';

// ─── Policy definitions ───────────────────────────────────────────────────────

type PolicyItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  url: string;
};

function buildPolicies(s: AppSettings | null): PolicyItem[] {
  const urls = policyUrls(s);
  return [
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy Policy',
      description: 'How we collect, use, and protect your data',
      url: urls.privacy,
    },
    {
      icon: 'document-text-outline',
      title: 'Terms & Conditions',
      description: 'Rules governing your use of Satvik Salaad',
      url: urls.terms,
    },
    {
      icon: 'return-up-back-outline',
      title: 'Refund Policy',
      description: 'When and how refunds are processed',
      url: urls.refund,
    },
    {
      icon: 'bicycle-outline',
      title: 'Delivery Policy',
      description: 'Delivery areas, timings, and missed meals',
      url: urls.delivery,
    },
  ];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PoliciesScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['app-settings'],
    queryFn: appSettingsApi.get,
    staleTime: CACHE_TTL.appSettings,
  });

  const policies = buildPolicies(data?.data ?? null);
  const supportEmail = data?.data.supportEmail ?? null;

  const openPolicy = (item: PolicyItem) => {
    router.push({
      pathname: '/policy-webview',
      params: { url: item.url, title: item.title },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Policies" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Spacing[4],
            paddingBottom: insets.bottom + Spacing[5],
            paddingHorizontal: Spacing[5],
          },
        ]}
      >
        <Animated.View
          entering={FadeInDown.delay(80).springify().damping(18)}
          style={[styles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}
        >
          {policies.map((item, index) => (
            <PolicyRow
              key={item.title}
              item={item}
              isLast={index === policies.length - 1}
              onPress={() => openPolicy(item)}
              colors={colors}
              fonts={fonts}
            />
          ))}
        </Animated.View>

        {supportEmail && (
          <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>
            <Text style={[styles.footer, { color: colors.textMuted, fontFamily: fonts.body }]}>
              For questions, contact us at {supportEmail}
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type ThemeFonts = ReturnType<typeof useTheme>['fonts'];

function PolicyRow({
  item,
  isLast,
  onPress,
  colors,
  fonts,
}: {
  item: PolicyItem;
  isLast: boolean;
  onPress: () => void;
  colors: ThemeColors;
  fonts: ThemeFonts;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
        <Ionicons name={item.icon} size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          {item.title}
        </Text>
        <Text style={[styles.rowDesc, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {item.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { gap: Spacing[4] },

  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    gap: Spacing[3],
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: FontSize.base },
  rowDesc:  { fontSize: FontSize.xs, marginTop: 2 },

  footer: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    paddingTop: Spacing[2],
  },
});
