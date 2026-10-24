import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { popupEvents } from '@/lib/popup-events';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { CardEdge, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface QuickActionsProps {
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
  onSkipToday: () => void;
  /** Has or had a subscription, so the plans action reads "Renew". */
  hadSubscription: boolean;
  onPlans: () => void;
  onMenu: () => void;
  onSettings: () => void;
}

export function QuickActions({
  colors,
  fonts,
  onSkipToday,
  hadSubscription,
  onPlans,
  onMenu,
  onSettings,
}: QuickActionsProps) {
  const actions = [
    {
      icon: 'calendar-outline' as const,
      label: 'Skip a day',
      sub: 'Free, before the cutoff',
      onPress: onSkipToday,
    },
    {
      icon: hadSubscription ? 'refresh-outline' as const : 'add-circle-outline' as const,
      label: hadSubscription ? 'Renew' : 'Choose a plan',
      sub: hadSubscription ? 'Book your next one' : 'Weekly or monthly',
      onPress: onPlans,
    },
    {
      icon: 'settings-outline' as const,
      label: 'Settings',
      sub: 'App preferences',
      onPress: onSettings,
    },
    {
      icon: 'restaurant-outline' as const,
      label: 'Menu',
      sub: 'See the menu',
      onPress: onMenu,
    },
  ];

  return (
    <View style={qaStyles.grid}>
      {[0, 2].map((start) => (
        <View key={start} style={qaStyles.row}>
          {actions.slice(start, start + 2).map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[qaStyles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}
              onPress={() => { popupEvents.emit(); a.onPress(); }}
              activeOpacity={0.75}>
              <View style={[qaStyles.iconWrap, { backgroundColor: colors.sageSoft }]}>
                <Ionicons name={a.icon} size={18} color={colors.primary} />
              </View>
              <View style={qaStyles.text}>
                <Text style={[qaStyles.label, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={1}>
                  {a.label}
                </Text>
                <Text style={[qaStyles.sub, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={1}>
                  {a.sub}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const qaStyles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
    gap: Spacing[2.5],
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: FontSize.sm,
  },
  sub: {
    fontSize: 11,
  },
});
