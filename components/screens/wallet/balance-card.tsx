import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface BalanceCardProps {
  remaining: number;
  totalUsed: number;
  totalPurchased: number;
  progressPct: number;
  onBuyPress: () => void;
  loading?: boolean;
}

export function BalanceCard({
  remaining,
  totalUsed,
  totalPurchased,
  progressPct,
  onBuyPress,
  loading = false,
}: BalanceCardProps) {
  const { colors, fonts } = useTheme();

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.primaryTint, borderColor: 'transparent' },
      ]}
    >
      <Text style={[s.cardMeta, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
        MEAL BALANCE
      </Text>

      {/* Fixed-height slot — loading skeleton same size as the big number so card never shifts */}
      <View style={s.balanceSlot}>
        {loading ? (
          <Skeleton width={72} height={56} radius={8} />
        ) : (
          <View style={s.balanceRow}>
            <Text style={[s.balanceNum, { color: colors.primaryDark, fontFamily: fonts.display }]}>
              {remaining}
            </Text>
            <Text style={[s.balanceSuffix, { color: colors.textMuted, fontFamily: fonts.body }]}>
              {remaining === 1 ? 'meal left' : 'meals left'}
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar — always visible, fill only when loaded */}
      <View style={[s.progressTrack, { backgroundColor: colors.primary + '22' }]}>
        {!loading && (
          <View
            style={[
              s.progressFill,
              { backgroundColor: colors.primary, width: `${progressPct}%` as `${number}%` },
            ]}
          />
        )}
      </View>

      {/* Fixed-height slot for the note line below progress bar */}
      <View style={s.noteSlot}>
        {loading ? (
          <Skeleton width={140} height={11} radius={4} />
        ) : (
          <Text style={[s.progressNote, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {totalUsed} used · {totalPurchased} total purchased
          </Text>
        )}
      </View>

      {/* Button — full skeleton block while loading, real button once data arrives */}
      {loading ? (
        <Skeleton width="100%" height={44} radius={Radius.md} />
      ) : (
        <TouchableOpacity
          style={[s.buyBtn, { backgroundColor: colors.primary }]}
          onPress={onBuyPress}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={[s.buyBtnText, { fontFamily: fonts.bodySemibold }]}>
            {remaining === 0 ? 'Buy a plan' : 'Top up'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:     { borderRadius: 16, padding: Spacing[4] },
  cardMeta: { fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },

  /* Fixed-height container — matches loaded text height so the card never reflows */
  balanceSlot: { height: 60, justifyContent: 'flex-end', marginBottom: 12 },
  balanceRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balanceNum:  { fontSize: 52, lineHeight: 56 },
  balanceSuffix: { fontSize: FontSize.base, paddingBottom: 4 },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: 3 },

  /* Fixed-height container — height matches 11px text lineHeight (~14) + surrounding space */
  noteSlot:    { height: 22, justifyContent: 'center', marginTop: 6, marginBottom: 8 },
  progressNote:{ fontSize: FontSize.xs },

  /* Fixed-height button so label-length never affects card height */
  buyBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: Radius.full},
  buyBtnText:{ fontSize: FontSize.sm, color: '#fff' },
});
