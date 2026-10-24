import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  bowlsLeftText,
  countOf,
  endedLine,
  extensionLine,
  formatDay,
  isEnding,
  nextLine,
  renewLabel,
  statusLabel,
} from '@/lib/subscription-view';
import type { Subscription } from '@/types/api';

interface SubscriptionCardProps {
  sub: Subscription;
  /** "Salad Bowls · Weekly", or just the plan's name. */
  title: string;
  /** The one waiting to start after it, in the same category. */
  next: Subscription | null;
  today: string;
  onRenew: () => void;
  onDeliveries: () => void;
}

/** One running subscription: what is left, how long it runs, and what comes after it. */
export function SubscriptionCard({ sub, title, next, today, onRenew, onDeliveries }: SubscriptionCardProps) {
  const { colors, fonts } = useTheme();
  const started = sub.starts_on <= today;
  const used = sub.bowls_total > 0 ? (sub.bowls_total - sub.bowls_left) / sub.bowls_total : 0;
  const ending = isEnding(sub, next !== null);
  const facts = [
    ...(started ? [] : [{ label: 'Starts', value: formatDay(sub.starts_on) }]),
    { label: 'Valid till', value: formatDay(sub.ends_on) },
    { label: 'If you skip, it can run until', value: formatDay(sub.last_allowed_on) },
  ];

  return (
    <View style={[s.card, { backgroundColor: colors.primaryTint }]}>
      <View style={s.headRow}>
        <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>{title}</Text>
        <View style={[s.pill, { backgroundColor: started ? colors.successBg : colors.blueBg }]}>
          <Text style={[s.pillText, { color: started ? colors.success : colors.blue, fontFamily: fonts.bodySemibold }]}>
            {statusLabel(sub, today)}
          </Text>
        </View>
      </View>

      <Text style={[s.big, { color: colors.primaryDark, fontFamily: fonts.display }]}>
        {started ? bowlsLeftText(sub) : countOf(sub.bowls_total, sub.unit)}
      </Text>
      {started ? (
        <View style={[s.progressTrack, { backgroundColor: colors.primary + '22' }]}>
          <View style={[s.progressFill, { backgroundColor: colors.primary, width: `${Math.min(used * 100, 100)}%` as `${number}%` }]} />
        </View>
      ) : null}

      <View style={s.facts}>
        {facts.map((f) => (
          <View key={f.label} style={s.fact}>
            <Text style={[s.factLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>{f.label}</Text>
            <Text style={[s.factValue, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{f.value}</Text>
          </View>
        ))}
      </View>
      {started ? (
        <Text style={[s.note, { color: colors.textMuted, fontFamily: fonts.body }]}>{extensionLine(sub)}</Text>
      ) : null}

      {next ? (
        <View style={[s.next, { backgroundColor: colors.surface }]}>
          <Ionicons name="time-outline" size={18} color={colors.blue} />
          <Text style={[s.nextText, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            {`${nextLine(next)} · ${countOf(next.bowls_total, next.unit)}`}
          </Text>
        </View>
      ) : null}

      <View style={s.btnRow}>
        <TouchableOpacity
          style={[s.btn, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={onDeliveries}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={[s.btnText, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Deliveries</Text>
        </TouchableOpacity>
        {ending ? (
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={onRenew} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={18} color={colors.textOnPrimary} />
            <Text style={[s.btnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>{renewLabel(sub)}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

interface NoSubscriptionCardProps {
  /** The latest one that ended, if any. */
  lastEnded: Subscription | null;
  onRenew: () => void;
  loading?: boolean;
}

/** Nothing running: what happened to the last one, and the way back in. */
export function NoSubscriptionCard({ lastEnded, onRenew, loading = false }: NoSubscriptionCardProps) {
  const { colors, fonts } = useTheme();
  if (loading) {
    return (
      <View style={[s.card, { backgroundColor: colors.primaryTint }]}>
        <Skeleton width={160} height={22} radius={6} />
        <Skeleton width={220} height={30} radius={6} style={{ marginTop: Spacing[3] }} />
        <Skeleton width="100%" height={6} radius={3} style={{ marginTop: Spacing[3] }} />
        <Skeleton width="100%" height={48} radius={Radius.full} style={{ marginTop: Spacing[4] }} />
      </View>
    );
  }
  return (
    <View style={[s.card, { backgroundColor: colors.primaryTint }]}>
      <Text style={[s.title, { color: colors.primaryDark, fontFamily: fonts.display }]}>
        {lastEnded ? `Your ${lastEnded.plan.name} has ended` : 'No subscription yet'}
      </Text>
      <Text style={[s.emptyText, { color: colors.textMuted, fontFamily: fonts.body }]}>
        {lastEnded ? endedLine(lastEnded) : 'Pick a plan and get fresh bowls on the days you choose.'}
      </Text>
      <TouchableOpacity style={[s.btn, s.soloBtn, { backgroundColor: colors.primary }]} onPress={onRenew} activeOpacity={0.85}>
        <Ionicons name={lastEnded ? 'refresh-outline' : 'add-circle-outline'} size={18} color={colors.textOnPrimary} />
        <Text style={[s.btnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
          {lastEnded ? renewLabel(lastEnded) : 'Choose a plan'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function NoteCard({ text }: { text: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[s.noteCard, { backgroundColor: colors.surface }, CardEdge]}>
      <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={s.noteIcon} />
      <Text style={[s.noteText, { color: colors.textSecondary, fontFamily: fonts.body }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing[4], gap: Spacing[2] },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing[2] },
  title: { flex: 1, fontSize: FontSize.xl },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs },
  big: { fontSize: FontSize['2xl'], marginTop: Spacing[1] },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  facts: { gap: 6, marginTop: Spacing[1] },
  fact: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: Spacing[3] },
  factLabel: { flexShrink: 1, fontSize: FontSize.base },
  factValue: { fontSize: FontSize.base },
  note: { fontSize: FontSize.sm },
  next: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], borderRadius: Radius.md, padding: Spacing[3], marginTop: Spacing[1] },
  nextText: { flex: 1, fontSize: FontSize.base },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginTop: Spacing[2] },
  btn: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 48,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  soloBtn: { marginTop: Spacing[2] },
  btnText: { fontSize: FontSize.md },
  emptyText: { fontSize: FontSize.base, lineHeight: 20 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], borderRadius: 16, padding: Spacing[4] },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: FontSize.base, lineHeight: 21 },
});
