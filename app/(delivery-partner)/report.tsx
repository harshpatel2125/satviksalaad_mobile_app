// A delivery partner's own volume and reliability. Revenue is deliberately not
// shown to partners.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { partnerReportApi, type DateRangeKey, type PartnerSelfReport } from '@/lib/delivery-partner/report-api';
import { slotName, useSlots } from '@/lib/slots';

const RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'this_week', label: 'This week' },
  { key: 'prev_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'prev_month', label: 'Last month' },
];

type LoadMode = 'initial' | 'refresh' | 'silent';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge, Shadows.xs]}>
      <Text style={[styles.statValue, { color: tone ?? colors.text, fontFamily: fonts.display }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted, fontFamily: fonts.body }]}>{label}</Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge, Shadows.xs]}>
      <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, max }: { label: string; value: number; max: number }) {
  const { colors, fonts } = useTheme();
  const width = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text
          style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={[styles.rowValue, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
          {value}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
        <View style={[styles.fill, { width: `${width}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

export default function PartnerReportScreen() {
  const { colors, fonts } = useTheme();
  const slots = useSlots();
  const insets = useSafeAreaInsets();

  const [report, setReport] = useState<PartnerSelfReport | null>(null);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('this_week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: DateRangeKey, mode: LoadMode) => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await partnerReportApi.mine({ range: key });
      setReport(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // `loadedOnce` is a ref rather than derived from `report`: reading state here
  // would put it in the callback's dependencies, and since every load sets it,
  // the effect would re-run on its own result forever.
  const loadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      void load(rangeKey, loadedOnce.current ? 'silent' : 'initial');
      loadedOnce.current = true;
    }, [load, rangeKey]),
  );

  const maxDay = Math.max(1, ...(report?.series ?? []).map((d) => d.delivered));
  const maxArea = report?.byArea[0]?.delivered ?? 0;
  const deltaBowls =
    report && report.previousTotals.bowls > 0
      ? Math.round(((report.bowls - report.previousTotals.bowls) / report.previousTotals.bowls) * 100)
      : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.background, paddingTop: insets.top + Spacing[3] }]}>
        <Text style={[styles.topBarTitle, { color: colors.text, fontFamily: fonts.display }]}>
          My Report
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(rangeKey, 'refresh')} tintColor={colors.primary} />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {RANGES.map((option) => {
            const active = option.key === rangeKey;
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.7}
                onPress={() => {
                  setRangeKey(option.key);
                  void load(option.key, 'initial');
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? colors.textOnPrimary : colors.textSecondary,
                      fontFamily: active ? fonts.bodySemibold : fonts.body,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centre}>
            <Text style={[styles.errorText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              {error}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => void load(rangeKey, 'initial')}
              style={[styles.retry, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.retryText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : report ? (
          <>
            <Text style={[styles.period, { color: colors.textMuted, fontFamily: fonts.body }]}>
              {report.rangeLabel}
            </Text>

            <View style={styles.statRow}>
              <Stat value={String(report.bowls)} label="Bowls delivered" />
              <Stat value={String(report.delivered)} label="Stops completed" />
              <Stat
                value={report.delivered + report.missed > 0 ? pct(report.completionRate) : '—'}
                label="Completion"
                tone={report.missed > 0 ? colors.warning : colors.success}
              />
            </View>

            {deltaBowls !== null ? (
              <Text style={[styles.compare, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {deltaBowls === 0
                  ? `Same as the ${report.previous.days} days before.`
                  : `${deltaBowls > 0 ? 'Up' : 'Down'} ${Math.abs(deltaBowls)}% on the ${report.previous.days} days before (${report.previousTotals.bowls} bowls).`}
              </Text>
            ) : null}

            <Card title="Day by day">
              {report.series.every((d) => d.delivered === 0 && d.missed === 0) ? (
                <Text style={[styles.empty, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  Nothing delivered in this period.
                </Text>
              ) : (
                <View style={styles.chart}>
                  {report.series.map((day) => (
                    <View key={day.date} style={styles.column}>
                      {day.missed > 0 ? (
                        <View
                          style={[
                            styles.bar,
                            { backgroundColor: colors.error, height: `${Math.max(3, (day.missed / maxDay) * 100)}%` },
                          ]}
                        />
                      ) : null}
                      <View
                        style={[
                          styles.bar,
                          { backgroundColor: colors.primary, height: `${(day.delivered / maxDay) * 100}%` },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              )}
              <Text style={[styles.footnote, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {report.activeDays} {report.activeDays === 1 ? 'day' : 'days'} on the road
              </Text>
            </Card>

            <Card title="By delivery slot">
              {report.bySlot.map((slot) => (
                <Row
                  key={slot.slot}
                  label={slotName(slot.slot, slots)}
                  value={slot.delivered}
                  max={Math.max(1, ...report.bySlot.map((s) => s.delivered))}
                />
              ))}
            </Card>

            {report.byArea.length > 0 ? (
              <Card title="Areas you covered">
                {report.byArea.slice(0, 8).map((area) => (
                  <Row key={area.area} label={area.area} value={area.delivered} max={maxArea} />
                ))}
              </Card>
            ) : null}

            {report.missed > 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
                <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                  {report.missed} missed
                </Text>
                <Text style={[styles.empty, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  A missed stop is one the customer paid for. If a delivery could not be completed, tell the
                  kitchen why so it can be rescheduled.
                </Text>
              </View>
            ) : null}

            {/* Deliveries without a recorded hand-off are credited to the assigned
                partner; say so rather than present them as recorded. */}
            {report.attribution.inferred > 0 ? (
              <Text style={[styles.footnote, { color: colors.textMuted, fontFamily: fonts.body }]}>
                {report.attribution.stamped} of these are recorded against you directly; {report.attribution.inferred}{' '}
                {report.attribution.inferred === 1 ? 'is' : 'are'} counted because the stop was assigned to you.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[6], gap: Spacing[3] },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  topBarTitle: { fontSize: FontSize['1.5xl'], letterSpacing: -0.5 },

  chips: { gap: Spacing[2], paddingRight: Spacing[5] },
  chip: { paddingHorizontal: Spacing[3], paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { fontSize: FontSize.sm },

  centre: { paddingVertical: Spacing[8], alignItems: 'center', gap: Spacing[3] },
  errorText: { fontSize: FontSize.sm, textAlign: 'center' },
  retry: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.full },
  retryText: { fontSize: FontSize.sm },

  period: { fontSize: FontSize.xs },
  statRow: { flexDirection: 'row', gap: Spacing[2] },
  stat: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    alignItems: 'center',
  },
  statValue: { fontSize: FontSize['1.5xl'] },
  statLabel: { fontSize: FontSize.xs, marginTop: 2, textAlign: 'center' },
  compare: { fontSize: FontSize.xs },

  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    gap: Spacing[2.5],
  },
  cardTitle: { fontSize: FontSize.base },
  empty: { fontSize: FontSize.xs },
  footnote: { fontSize: FontSize.xs },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 96 },
  column: { flex: 1, justifyContent: 'flex-end', gap: 1, minWidth: 2 },
  bar: { width: '100%', borderRadius: 2 },

  row: { gap: 5 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing[2] },
  rowLabel: { fontSize: FontSize.xs, flex: 1, minWidth: 0 },
  rowValue: { fontSize: FontSize.xs },
  track: { height: 5, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
});
