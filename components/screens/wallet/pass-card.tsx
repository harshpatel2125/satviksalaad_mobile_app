import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PassPurchase } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PURCHASE_BADGES: Record<string, { label: string; bg: string; fg: string }> = {
  paid:      { label: 'Paid',      bg: '#dcfce7', fg: '#16a34a' },
  pending:   { label: 'Pending',   bg: '#dbeafe', fg: '#2563eb' },
  refunded:  { label: 'Refunded',  bg: '#f3f4f6', fg: '#4b5563' },
  failed:    { label: 'Failed',    bg: '#fee2e2', fg: '#dc2626' },
  cancelled: { label: 'Cancelled', bg: '#fee2e2', fg: '#dc2626' },
};

export function purchaseBadge(p: PassPurchase): { label: string; bg: string; fg: string } {
  return PURCHASE_BADGES[p.status] ?? { label: p.status, bg: '#f3f4f6', fg: '#4b5563' };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PassCardProps {
  purchase: PassPurchase;
  index: number;
  onPress?: () => void;
}

export function PassCard({ purchase, index, onPress }: PassCardProps) {
  const { colors, fonts } = useTheme();
  const badge    = purchaseBadge(purchase);
  const planName = purchase.pass_plans?.name ?? 'Plan';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[
        s.purchaseRow,
        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
      ]}
    >
      {/* Icon */}
      <View style={[s.purchaseIcon, { backgroundColor: colors.sageSoft }]}>
        <Ionicons name="leaf" size={16} color={colors.primary} />
      </View>

      {/* Info */}
      <View style={s.purchaseInfo}>
        <Text style={[s.purchaseName, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          {planName}
        </Text>
        <Text style={[s.purchaseMeta, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {purchase.passes_purchased} meals · {formatDate(purchase.paid_at)}
        </Text>
      </View>

      {/* Right */}
      <View style={s.purchaseRight}>
        <Text style={[s.purchaseAmt, { color: colors.text, fontFamily: fonts.display }]}>
          {formatRupees(purchase.price_paise)}
        </Text>
        <View style={[s.badge, { backgroundColor: badge.bg }]}>
          <Text style={[s.badgeText, { color: badge.fg, fontFamily: fonts.bodySemibold }]}>
            {badge.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  purchaseRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[4], paddingVertical: 14 },
  purchaseIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  purchaseInfo: { flex: 1, gap: 2 },
  purchaseName: { fontSize: FontSize.sm },
  purchaseMeta: { fontSize: FontSize.xs },
  purchaseRight:{ alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  purchaseAmt:  { fontSize: FontSize.md },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText:    { fontSize: 10 },
});
