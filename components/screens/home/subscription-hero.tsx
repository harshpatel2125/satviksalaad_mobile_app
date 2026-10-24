import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/ui/text';
import { Brand, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  categoryInfo,
  endedLine,
  isEnding,
  namesCategories,
  nextLine,
  renewLabel,
  runningWithNext,
  subscriptionDetail,
  subscriptionTitle,
} from '@/lib/subscription-view';
import type { Categories, Subscription } from '@/types/api';

/* White-tinted so the skeletons read on the green card */
const SK_BASE = 'rgba(255,255,255,0.20)';
const SK_SHIMMER = 'rgba(255,255,255,0.38)';

const CARD_COLOR = Brand.forest;
const CARD_COLOR_DARK = Brand.forestDark;

interface SubscriptionHeroProps {
  /** Running and waiting subscriptions. */
  open: Subscription[];
  /** The most recent one that ended, when nothing runs. */
  lastEnded: Subscription | null;
  categories: Categories;
  today: string;
  onOpen: () => void;
  /** `sub` is the one to renew; null to choose any plan. */
  onRenew: (sub: Subscription | null) => void;
  loading?: boolean;
}

/**
 * "Your subscriptions": one line per running subscription, what waits after
 * it, and Renew when it is ending. With nothing running, the way back in.
 */
export function SubscriptionHero({ open, lastEnded, categories, today, onOpen, onRenew, loading = false }: SubscriptionHeroProps) {
  const { fonts } = useTheme();
  const lines = runningWithNext(open);
  const several = namesCategories(open);

  return (
    <View style={[heroStyles.card, Shadows.sm]}>
      <View style={heroStyles.deco1} />
      <View style={heroStyles.deco2} />

      <View style={heroStyles.head}>
        <Text style={[heroStyles.label, { fontFamily: fonts.bodySemibold }]}>YOUR SUBSCRIPTIONS</Text>
        <Ionicons name="leaf-outline" size={20} color="rgba(255,255,255,0.75)" />
      </View>

      {loading ? (
        <View style={heroStyles.line}>
          <Skeleton width={140} height={22} radius={6} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} />
          <Skeleton width={220} height={14} radius={5} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={6} radius={3} baseColor={SK_BASE} shimmerColor={SK_SHIMMER} style={{ marginTop: 12 }} />
        </View>
      ) : lines.length === 0 ? (
        <View style={heroStyles.line}>
          <Text style={[heroStyles.title, { fontFamily: fonts.display }]}>
            {lastEnded ? `Your ${lastEnded.plan.name} has ended` : 'No subscription yet'}
          </Text>
          <Text style={[heroStyles.detail, { fontFamily: fonts.body }]}>
            {lastEnded ? endedLine(lastEnded) : 'Fresh bowls on the days you choose, lunch or dinner.'}
          </Text>
          <TouchableOpacity
            style={heroStyles.primaryBtn}
            onPress={() => onRenew(lastEnded)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[heroStyles.primaryBtnText, { fontFamily: fonts.bodySemibold }]}>
              {lastEnded ? renewLabel(lastEnded) : 'Choose a plan'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        lines.map(({ sub, next }, i) => {
          const started = sub.starts_on <= today;
          const used = sub.bowls_total > 0 ? (sub.bowls_total - sub.bowls_left) / sub.bowls_total : 0;
          return (
            <View key={sub.id} style={[heroStyles.line, i > 0 && heroStyles.divided]}>
              <TouchableOpacity onPress={onOpen} activeOpacity={0.75} accessibilityRole="button" style={heroStyles.lineTap}>
                <View style={heroStyles.titleRow}>
                  <Text style={[heroStyles.title, { fontFamily: fonts.display }]}>
                    {subscriptionTitle(sub, several ? categoryInfo(categories, sub.category).name : null)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
                </View>
                <Text style={[heroStyles.detail, { fontFamily: fonts.body }]}>{subscriptionDetail(sub, today)}</Text>
                {started ? (
                  <View style={heroStyles.progressBg}>
                    <View style={[heroStyles.progressFill, { width: `${Math.min(used * 100, 100)}%` as `${number}%` }]} />
                  </View>
                ) : null}
                {next ? <Text style={[heroStyles.next, { fontFamily: fonts.bodyMedium }]}>{nextLine(next)}</Text> : null}
              </TouchableOpacity>
              {isEnding(sub, next !== null) ? (
                <TouchableOpacity style={heroStyles.primaryBtn} onPress={() => onRenew(sub)} activeOpacity={0.85} accessibilityRole="button">
                  <Text style={[heroStyles.primaryBtnText, { fontFamily: fonts.bodySemibold }]}>{renewLabel(sub)}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: Spacing[5],
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: CARD_COLOR,
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[3] },
  label: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.6 },
  line: { paddingTop: Spacing[3] },
  divided: { marginTop: Spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.25)' },
  lineTap: { minHeight: 44 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },
  title: { flexShrink: 1, fontSize: FontSize.xl, color: '#fff' },
  detail: { fontSize: FontSize.base, lineHeight: 20, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  next: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: Spacing[2] },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    marginTop: Spacing[2],
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: Radius.full },
  primaryBtn: {
    marginTop: Spacing[3],
    minHeight: 44,
    borderRadius: Radius.full,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
  },
  primaryBtnText: { fontSize: FontSize.base, color: CARD_COLOR_DARK },
});
