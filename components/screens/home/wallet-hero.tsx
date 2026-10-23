import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Skeleton } from '@/components/skeleton';
import { Brand, FontSize, FontWeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/* Skeleton colors for use on the wallet card — white-tinted so they read on WALLET_COLOR */
const SK_BASE    = 'rgba(255,255,255,0.20)';
const SK_SHIMMER = 'rgba(255,255,255,0.38)';

export const WALLET_COLOR = Brand.forest;
export const WALLET_COLOR_DARK = Brand.forestDark;

interface WalletHeroProps {
  remaining: number;
  total: number;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
  onBuyMore: () => void;
  onHistory: () => void;
  onPress?: () => void;
  loading?: boolean;
  empty?: boolean;
}

export function WalletHero({
  remaining,
  total,
  colors,
  fonts,
  onBuyMore,
  onHistory,
  onPress,
  loading = false,
  empty = false,
}: WalletHeroProps) {
  const used = total - remaining;
  const pct = total > 0 ? used / total : 0;

  return (
    <View style={[walletStyles.card, Shadows.sm]}>
      {/* Decorative circles go first so the content paints over them */}
      <View style={walletStyles.deco1} />
      <View style={walletStyles.deco2} />

      <TouchableOpacity style={walletStyles.top} onPress={empty ? onBuyMore : onPress} activeOpacity={0.7}>
        <View style={walletStyles.leftCol}>
          <Text style={[walletStyles.label, { fontFamily: fonts.bodyMedium }]}>
            {empty ? 'YOUR SALAD WALLET' : 'MEALS REMAINING'}
          </Text>
          <View style={walletStyles.countRow}>
            {loading ? (
              <Skeleton width={72} height={52} radius={10} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} />
            ) : empty ? (
              <View style={walletStyles.emptyIconWrap}>
                <Ionicons name="leaf-outline" size={36} color="rgba(255,255,255,0.9)" />
              </View>
            ) : (
              <Text style={[walletStyles.count, { fontFamily: fonts.display }]}>
                {remaining}
              </Text>
            )}
          </View>
          <View style={walletStyles.subRow}>
            {loading ? (
              <Skeleton width={130} height={10} radius={5} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} />
            ) : (
              <Text style={walletStyles.subLabel} numberOfLines={1}>
                {empty ? 'No plan yet' : `of ${total} meals · active`}
              </Text>
            )}
          </View>
        </View>
        <View style={walletStyles.iconBox}>
          <Ionicons name="wallet-outline" size={22} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={walletStyles.progressBg}>
        {!loading && !empty && (
          <View
            style={[
              walletStyles.progressFill,
              { width: `${Math.min(pct * 100, 100)}%` as `${number}%` },
            ]}
          />
        )}
      </View>

      {/* Actions — skeleton placeholders during loading so layout never shifts */}
      <View style={walletStyles.btnRow}>
        {loading ? (
          <>
            <Skeleton width="50%" height={36} radius={10} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} style={{ flex: 1 }} />
            <Skeleton width="50%" height={36} radius={10} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} style={{ flex: 1 }} />
          </>
        ) : empty ? (
          <TouchableOpacity style={[walletStyles.buyBtn, { flex: 1 }]} onPress={onBuyMore} activeOpacity={0.85}>
            <Text style={walletStyles.buyBtnText}>Buy your first pack</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={walletStyles.buyBtn} onPress={onBuyMore} activeOpacity={0.85}>
              <Text style={walletStyles.buyBtnText}>Buy more</Text>
            </TouchableOpacity>
            <TouchableOpacity style={walletStyles.historyBtn} onPress={onHistory} activeOpacity={0.85}>
              <Text style={walletStyles.historyBtnText}>History</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const walletStyles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: Spacing[5],
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: WALLET_COLOR,
  },
  deco1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -30,
    right: -30,
  },
  deco2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -50,
    right: 30,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
  },
  leftCol: {
    gap: 2,
  },
  subRow: {
    height: 16,
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.6,
    marginBottom: Spacing[1],
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
  },
  emptyIconWrap: {
    height: 64,
    justifyContent: 'center',
  },
  count: {
    fontSize: 56,
    color: '#fff',
    lineHeight: 60,
    fontWeight: FontWeight.semibold,
  },
  subLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    marginTop: Spacing[4],
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: Radius.full,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[3],
    position: 'relative',
  },
  buyBtn: {
    flex: 1,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: WALLET_COLOR_DARK,
  },
  historyBtn: {
    flex: 1,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  historyBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
});
