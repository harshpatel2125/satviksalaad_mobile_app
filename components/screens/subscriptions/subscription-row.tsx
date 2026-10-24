import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countOf, endedLine, formatDay, renewLabel, statusLabel } from '@/lib/subscription-view';
import type { Subscription } from '@/types/api';

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function badgeColors(sub: Subscription, colors: ReturnType<typeof useTheme>['colors']): { bg: string; fg: string } {
  switch (sub.status) {
    case 'active':   return { bg: colors.successBg, fg: colors.success };
    case 'upcoming': return { bg: colors.blueBg, fg: colors.blue };
    case 'expired':  return { bg: colors.warningBg, fg: colors.warning };
    case 'refunded': return { bg: colors.blueBg, fg: colors.blue };
    default:         return { bg: colors.surface2, fg: colors.textMuted };
  }
}

function detailText(sub: Subscription): string {
  const when = sub.status === 'expired' ? endedLine(sub) : `${formatDay(sub.starts_on)} – ${formatDay(sub.ends_on)}`;
  return `${countOf(sub.bowls_total, sub.unit)} · ${when} · ${formatRupees(sub.price_paise)}`;
}

interface SubscriptionRowProps {
  subscription: Subscription;
  /** "Salad Bowls · Weekly", or just the plan's name. */
  title: string;
  today: string;
  index: number;
  onPress?: () => void;
  /** Offered on the latest one that ended in a category with nothing running. */
  onRenew?: () => void;
}

export function SubscriptionRow({ subscription: sub, title, today, index, onPress, onRenew }: SubscriptionRowProps) {
  const { colors, fonts } = useTheme();
  const badge = badgeColors(sub, colors);

  return (
    <View style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} style={s.main} accessibilityRole="button">
        <View style={[s.icon, { backgroundColor: colors.sageSoft }]}>
          <Ionicons name="leaf" size={16} color={colors.primary} />
        </View>
        <View style={s.info}>
          <Text style={[s.name, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{title}</Text>
          <Text style={[s.meta, { color: colors.textMuted, fontFamily: fonts.body }]}>{detailText(sub)}</Text>
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeText, { color: badge.fg, fontFamily: fonts.bodySemibold }]}>{statusLabel(sub, today)}</Text>
          </View>
        </View>
      </TouchableOpacity>
      {onRenew ? (
        <TouchableOpacity style={[s.renew, { backgroundColor: colors.primary }]} onPress={onRenew} activeOpacity={0.85}>
          <Text style={[s.renewText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>{renewLabel(sub)}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[4], paddingVertical: Spacing[3] },
  main:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing[3], minHeight: 48 },
  icon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:  { flex: 1, gap: 2 },
  name:  { fontSize: FontSize.md },
  meta:  { fontSize: FontSize.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginTop: 2 },
  badgeText: { fontSize: FontSize.xs },
  renew: { minHeight: 44, paddingHorizontal: Spacing[4], borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  renewText: { fontSize: FontSize.base },
});
