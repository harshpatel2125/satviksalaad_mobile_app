import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { ScreenHeader } from '@/components/ui/screen-header';

import { InvoiceDetailSkeleton } from '@/components/skeletons/invoice-detail-skeleton';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/alert';
import { useTheme } from '@/hooks/use-theme';
import { invoicesApi } from '@/lib/api';
import { trackInvoiceDownloaded } from '@/lib/analytics';
import { downloadAndShareInvoice } from '@/lib/invoice-pdf';
import { readInvoiceDetailCache, writeInvoiceDetailCache } from '@/lib/home-cache';
import type { InvoiceDetailResponse, InvoiceLineItem } from '@/types/api';
import { isPhoneEmail } from '@/lib/phone-email';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rupees(p: number): string {
  const sign = p < 0 ? '−' : '';
  const v = Math.abs(p) / 100;
  return `${sign}₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatGstRate(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

function formatHalfGstRate(bps: number): string {
  const pct = bps / 200;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

type DetailData = InvoiceDetailResponse['data'];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InvoiceDetailScreen() {
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; invoice_number?: string }>();
  const invoiceId = typeof params.id === 'string' ? params.id : null;

  // Synchronous MMKV read — show cached invoice instantly if user has viewed it before
  const hasCachedData = React.useRef(false);
  const [data, setData] = useState<DetailData | null>(() => {
    if (!invoiceId) return null;
    const cached = readInvoiceDetailCache(invoiceId);
    hasCachedData.current = cached !== null;
    return cached;
  });
  const [loading, setLoading] = useState(!hasCachedData.current && !!invoiceId);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) {
      setError('Missing invoice id');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      // Only show skeleton on first view — subsequent opens show cache and refresh silently
      if (!hasCachedData.current) setLoading(true);
      const res = await invoicesApi.detail(invoiceId);
      if (!res.success) throw new Error('Unable to load invoice');
      setData(res.data);
      writeInvoiceDetailCache(invoiceId, res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load]);

  async function handleDownload() {
    if (!invoiceId || !data) return;
    setDownloading(true);
    const r = await downloadAndShareInvoice(invoiceId, data.invoice.invoice_number);
    setDownloading(false);
    if (r.ok) trackInvoiceDownloaded(invoiceId);
    else showAlert('Download failed', r.reason);
  }

  // ─── Loading state — skeleton matching the real layout ─────────────────
  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title={data?.invoice.invoice_number ?? 'Invoice'} onBack={() => router.back()} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing[5] }}
        >
          <InvoiceDetailSkeleton />
        </ScrollView>
      </View>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title={data?.invoice.invoice_number ?? 'Invoice'} onBack={() => router.back()} />
        <View style={styles.centeredFill}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.errorTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            Couldn&apos;t load this invoice
          </Text>
          <Text style={[styles.centeredText, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {error ?? 'Please try again.'}
          </Text>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.retryBtnText, { fontFamily: fonts.bodySemibold }]}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Derived ─────────────────────────────────────────────────────────────
  const { invoice, lineItems, profile, orderRef, revisionOf, supersededBy } = data;
  const snapshot = invoice.billing_snapshot ?? {};
  const seller = snapshot.seller ?? {};
  const buyer = snapshot.buyer ?? {};
  const taxMode = (invoice.gst_rate_bps ?? 0) > 0 && !!seller.gstin && seller.gstin.trim().length > 0;
  const docTitle = taxMode ? 'TAX INVOICE' : 'INVOICE';
  const isSuperseded = invoice.status === 'superseded';
  const buyerName = buyer.name ?? profile?.full_name ?? 'Customer';

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={data?.invoice.invoice_number ?? "Invoice"}
        onBack={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Spacing[5],
          paddingTop: Spacing[4],
          paddingBottom: Spacing[5], // leave room for sticky CTA
        }}
      >
        {/* Status banners ────────────────────────────────────────────── */}
        {isSuperseded && supersededBy && (
          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/invoice-detail",
                params: {
                  id: supersededBy.id,
                  invoice_number: supersededBy.invoice_number,
                },
              })
            }
            style={({ pressed }) => [
              styles.banner,
              {
                backgroundColor: "#FEF6E4",
                borderColor: "#F4D8A1",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={18} color="#A06A00" />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.bannerTitle,
                  { color: "#7A5200", fontFamily: fonts.bodySemibold },
                ]}
              >
                This invoice was revised
              </Text>
              <Text
                style={[
                  styles.bannerBody,
                  { color: "#7A5200", fontFamily: fonts.body },
                ]}
              >
                Tap to view current invoice {supersededBy.invoice_number}
              </Text>
            </View>
          </Pressable>
        )}
        {revisionOf && (
          <View
            style={[
              styles.banner,
              { backgroundColor: "#EEF0FB", borderColor: "#C7CDF0" },
            ]}
          >
            <Ionicons name="time-outline" size={18} color="#3F47B0" />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.bannerTitle,
                  { color: "#2C338F", fontFamily: fonts.bodySemibold },
                ]}
              >
                Revised invoice
              </Text>
              <Text
                style={[
                  styles.bannerBody,
                  { color: "#2C338F", fontFamily: fonts.body },
                ]}
              >
                Replaces {revisionOf.invoice_number} (issued{" "}
                {formatDateLong(revisionOf.issued_at)})
              </Text>
            </View>
          </View>
        )}

        {/* Hero card ────────────────────────────────────────────────── */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.surface, borderWidth: 0 },
            CardEdge,
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[
                  styles.heroEyebrow,
                  { color: colors.textMuted, fontFamily: fonts.bodySemibold },
                ]}
              >
                {docTitle}
              </Text>
              <Text
                style={[
                  styles.heroNumber,
                  {
                    color: colors.text,
                    fontFamily: fonts.mono ?? fonts.bodySemibold,
                  },
                ]}
                numberOfLines={1}
              >
                {invoice.invoice_number}
              </Text>
              <Text
                style={[
                  styles.heroDate,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {formatDateLong(invoice.issued_at)}
              </Text>
            </View>
            <StatusPill status={invoice.status} colors={colors} fonts={fonts} />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.amountRow}>
            <Text
              style={[
                styles.amountLabel,
                { color: colors.textMuted, fontFamily: fonts.bodySemibold },
              ]}
            >
              TOTAL
            </Text>
            <Text
              style={[
                styles.amountValue,
                { color: colors.text, fontFamily: fonts.display },
              ]}
            >
              {rupees(invoice.total_paise)}
            </Text>
          </View>
        </View>

        {/* From / Bill To ─────────────────────────────────────────────── */}
        <View style={styles.partiesRow}>
          <PartyBlock
            label="FROM"
            name={seller.legalName ?? "Satvik Salaad"}
            lines={
              [
                ...(seller.addressLines ?? []),
                [seller.city, seller.state, seller.pincode]
                  .filter(Boolean)
                  .join(", "),
              ].filter(Boolean) as string[]
            }
            gstin={taxMode ? seller.gstin : undefined}
            colors={colors}
            fonts={fonts}
          />
          <View style={{ height: Spacing[3] }} />
          <PartyBlock
            label="BILL TO"
            name={buyer.legalName ?? buyerName}
            secondaryName={
              buyer.legalName && buyerName !== buyer.legalName
                ? buyerName
                : undefined
            }
            lines={
              [
                ...(buyer.addressLines ?? []),
                [buyer.city, buyer.state, buyer.pincode]
                  .filter(Boolean)
                  .join(", "),
                buyer.email && !isPhoneEmail(buyer.email)
                  ? buyer.email
                  : undefined,
                buyer.phone ?? undefined,
              ].filter(Boolean) as string[]
            }
            gstin={buyer.gstin}
            colors={colors}
            fonts={fonts}
          />
        </View>

        {/* Order reference ─────────────────────────────────────────────── */}
        {orderRef && (
          <View
            style={[
              styles.metaCard,
              { backgroundColor: colors.surface, borderWidth: 0 },
              CardEdge,
            ]}
          >
            <Text
              style={[
                styles.metaLabel,
                { color: colors.textMuted, fontFamily: fonts.bodySemibold },
              ]}
            >
              ORDER REFERENCE
            </Text>
            <Text
              style={[
                styles.metaValue,
                {
                  color: colors.text,
                  fontFamily: fonts.mono ?? fonts.bodySemibold,
                },
              ]}
            >
              {orderRef}
            </Text>
          </View>
        )}

        {/* Line items ─────────────────────────────────────────────────── */}
        <Text
          style={[
            styles.sectionHead,
            { color: colors.textMuted, fontFamily: fonts.bodySemibold },
          ]}
        >
          ITEMS
        </Text>
        <View
          style={[
            styles.itemsCard,
            { backgroundColor: colors.surface, borderWidth: 0 },
            CardEdge,
          ]}
        >
          {lineItems.length === 0 && (
            <Text
              style={[
                styles.emptyItems,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              No items on this invoice.
            </Text>
          )}
          {lineItems.map((item, idx) => (
            <LineItemRow
              key={item.id}
              item={item}
              taxMode={taxMode}
              gstRateBps={invoice.gst_rate_bps}
              isLast={idx === lineItems.length - 1}
              colors={colors}
              fonts={fonts}
            />
          ))}
        </View>

        {/* Totals ─────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.totalsCard,
            { backgroundColor: colors.surface, borderWidth: 0 },
            CardEdge,
          ]}
        >
          <TotalsRow
            label="Subtotal"
            value={rupees(invoice.subtotal_paise)}
            colors={colors}
            fonts={fonts}
          />
          {invoice.discount_paise > 0 && (
            <TotalsRow
              label="Discount"
              value={`−${rupees(invoice.discount_paise)}`}
              accent
              colors={colors}
              fonts={fonts}
            />
          )}
          {taxMode && (
            <TotalsRow
              label="Taxable Value"
              value={rupees(invoice.taxable_value_paise)}
              colors={colors}
              fonts={fonts}
            />
          )}
          {taxMode && (invoice.cgst_paise ?? 0) > 0 && (
            <TotalsRow
              label={`CGST @ ${formatHalfGstRate(invoice.gst_rate_bps)}`}
              value={rupees(invoice.cgst_paise ?? 0)}
              colors={colors}
              fonts={fonts}
            />
          )}
          {taxMode && (invoice.sgst_paise ?? 0) > 0 && (
            <TotalsRow
              label={`SGST @ ${formatHalfGstRate(invoice.gst_rate_bps)}`}
              value={rupees(invoice.sgst_paise ?? 0)}
              colors={colors}
              fonts={fonts}
            />
          )}
          {taxMode && (invoice.igst_paise ?? 0) > 0 && (
            <TotalsRow
              label={`IGST @ ${formatGstRate(invoice.gst_rate_bps)}`}
              value={rupees(invoice.igst_paise ?? 0)}
              colors={colors}
              fonts={fonts}
            />
          )}
          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border, marginVertical: Spacing[2] },
            ]}
          />
          <View style={styles.grandTotalRow}>
            <Text
              style={[
                styles.grandTotalLabel,
                { color: colors.primaryDark, fontFamily: fonts.display },
              ]}
            >
              Grand Total
            </Text>
            <Text
              style={[
                styles.grandTotalValue,
                { color: colors.primaryDark, fontFamily: fonts.display },
              ]}
            >
              {rupees(invoice.total_paise)}
            </Text>
          </View>
        </View>

        {/* Notes ──────────────────────────────────────────────────────── */}
        {invoice.notes && (
          <View
            style={[
              styles.notesCard,
              { backgroundColor: colors.surface, borderWidth: 0 },
              CardEdge,
            ]}
          >
            <Text
              style={[
                styles.metaLabel,
                { color: colors.textMuted, fontFamily: fonts.bodySemibold },
              ]}
            >
              NOTES
            </Text>
            <Text
              style={[
                styles.notesText,
                { color: colors.text, fontFamily: fonts.body },
              ]}
            >
              {invoice.notes}
            </Text>
          </View>
        )}

        {/* Email status hint ──────────────────────────────────────────── */}
        {invoice.email_sent_at && (
          <View style={styles.emailHint}>
            <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
            <Text
              style={[
                styles.emailHintText,
                { color: colors.textMuted, fontFamily: fonts.body },
              ]}
            >
              Emailed on {formatDateLong(invoice.email_sent_at)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Download CTA ─────────────────────────────────────────── */}
      <BottomActionBar
        style={{ backgroundColor: colors.background, borderTopWidth: 0 }}
      >
        <Pressable
          onPress={handleDownload}
          disabled={downloading || !(invoice.has_pdf ?? true)}
          style={({ pressed }) => [
            styles.ctaBtn,
            {
              backgroundColor: colors.primary,
              opacity:
                downloading || !(invoice.has_pdf ?? true)
                  ? 0.5
                  : pressed
                    ? 0.85
                    : 1,
            },
          ]}
        >
          {downloading && (
            <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} />
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing[2],
              opacity: downloading ? 0 : 1,
            }}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text
              style={[styles.ctaBtnText, { fontFamily: fonts.bodySemibold }]}
            >
              {(invoice.has_pdf ?? true) ? "Download PDF" : "PDF preparing…"}
            </Text>
          </View>
        </Pressable>
      </BottomActionBar>
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type ThemeFonts = ReturnType<typeof useTheme>['fonts'];

function StatusPill({ status, colors, fonts }: { status: string; colors: ThemeColors; fonts: ThemeFonts }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    issued:     { bg: colors.primaryBg,  fg: colors.primaryDark, label: 'Issued' },
    paid:       { bg: colors.primaryBg,  fg: colors.primaryDark, label: 'Paid' },
    draft:      { bg: colors.surface2,   fg: colors.textMuted,   label: 'Draft' },
    cancelled:  { bg: colors.errorBg,    fg: colors.error,       label: 'Cancelled' },
    superseded: { bg: '#FEF6E4',         fg: '#A06A00',          label: 'Superseded' },
  };
  const cfg = map[status] ?? map.issued;
  return (
    <View style={[pillStyles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[pillStyles.text, { color: cfg.fg, fontFamily: fonts.bodySemibold }]}>{cfg.label}</Text>
    </View>
  );
}

function PartyBlock({
  label,
  name,
  secondaryName,
  lines,
  gstin,
  colors,
  fonts,
}: {
  label: string;
  name: string;
  secondaryName?: string;
  lines: string[];
  gstin?: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
}) {
  return (
    <View style={[styles.partyCard, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
      <Text style={[styles.partyLabel, { color: colors.primaryDark, fontFamily: fonts.bodySemibold }]}>
        {label}
      </Text>
      <Text style={[styles.partyName, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={2}>
        {name}
      </Text>
      {secondaryName && (
        <Text style={[styles.partyLine, { color: colors.textMuted, fontFamily: fonts.body }]}>
          Contact: {secondaryName}
        </Text>
      )}
      {lines.map((l, i) => (
        <Text key={i} style={[styles.partyLine, { color: colors.textMuted, fontFamily: fonts.body }]}>
          {l}
        </Text>
      ))}
      {gstin && gstin.trim().length > 0 && (
        <View style={styles.partyGstinRow}>
          <Text style={[styles.partyGstinKey, { color: colors.textMuted, fontFamily: fonts.body }]}>GSTIN</Text>
          <Text style={[styles.partyGstinVal, { color: colors.text, fontFamily: fonts.mono ?? fonts.bodySemibold }]}>{gstin}</Text>
        </View>
      )}
    </View>
  );
}

function LineItemRow({
  item,
  taxMode,
  gstRateBps,
  isLast,
  colors,
  fonts,
}: {
  item: InvoiceLineItem;
  taxMode: boolean;
  gstRateBps: number;
  isLast: boolean;
  colors: ThemeColors;
  fonts: ThemeFonts;
}) {
  const isDiscount = item.amount_paise < 0;
  return (
    <View
      style={[
        styles.lineItem,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={{ flex: 1, paddingRight: Spacing[3] }}>
        <Text style={[styles.lineItemTitle, { color: isDiscount ? colors.primaryDark : colors.text, fontFamily: fonts.bodySemibold }]}>
          {item.description}
        </Text>
        {taxMode && !isDiscount && (
          <Text style={[styles.lineItemSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
            GST @ {formatGstRate(gstRateBps)} · Qty {item.quantity}
          </Text>
        )}
        {(!taxMode || isDiscount) && item.quantity !== 1 && (
          <Text style={[styles.lineItemSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
            Qty {item.quantity}
          </Text>
        )}
      </View>
      <Text style={[styles.lineItemAmount, { color: isDiscount ? colors.primaryDark : colors.text, fontFamily: fonts.mono ?? fonts.bodySemibold }]}>
        {isDiscount ? `−${rupees(Math.abs(item.amount_paise))}` : rupees(item.amount_paise)}
      </Text>
    </View>
  );
}

function TotalsRow({
  label,
  value,
  accent,
  colors,
  fonts,
}: {
  label: string;
  value: string;
  accent?: boolean;
  colors: ThemeColors;
  fonts: ThemeFonts;
}) {
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { color: accent ? colors.primaryDark : colors.textMuted, fontFamily: fonts.body }]}>
        {label}
      </Text>
      <Text style={[styles.totalsValue, { color: accent ? colors.primaryDark : colors.text, fontFamily: fonts.mono ?? fonts.bodySemibold }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Centered (loading / error)
  centeredFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing[6] },
  centeredText: { fontSize: FontSize.sm, textAlign: 'center' },
  errorTitle: { fontSize: FontSize.md, marginTop: 4 },
  retryBtn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.md },
  retryBtnText: { color: '#fff', fontSize: FontSize.sm },

  // Banners
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: Radius.md, borderWidth: 1,
    marginBottom: Spacing[3],
  },
  bannerTitle: { fontSize: 13 },
  bannerBody: { fontSize: 11.5, marginTop: 1 },

  // Hero card
  heroCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing[4],
    marginBottom: Spacing[4],
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroEyebrow: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroNumber: { fontSize: 20, letterSpacing: -0.3, marginTop: 2 },
  heroDate: { fontSize: 12, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing[3] },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing[3],
  },
  amountLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  amountValue: { fontSize: 28, letterSpacing: -0.5 },

  // Parties
  partiesRow: { marginBottom: Spacing[4] },
  partyCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing[4],
    gap: 2,
  },
  partyLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  partyName: { fontSize: FontSize.md, marginBottom: 4 },
  partyLine: { fontSize: 12, lineHeight: 18 },
  partyGstinRow: { flexDirection: 'row', marginTop: 6, gap: 8 },
  partyGstinKey: { fontSize: 10, width: 42, textTransform: 'uppercase', letterSpacing: 0.5 },
  partyGstinVal: { fontSize: 12 },

  // Meta card (order ref)
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    marginBottom: Spacing[4],
  },
  metaLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  metaValue: { fontSize: 13 },

  // Section heading
  sectionHead: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Items list
  itemsCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing[4],
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing[4],
  },
  lineItemTitle: { fontSize: 14 },
  lineItemSub: { fontSize: 11.5, marginTop: 2 },
  lineItemAmount: { fontSize: 14 },
  emptyItems: { padding: Spacing[5], textAlign: 'center', fontSize: 13 },

  // Totals
  totalsCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[4],
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalsLabel: { fontSize: 13 },
  totalsValue: { fontSize: 13 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 4 },
  grandTotalLabel: { fontSize: FontSize.md, letterSpacing: -0.2 },
  grandTotalValue: { fontSize: 22, letterSpacing: -0.5 },

  // Notes
  notesCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing[4],
    marginBottom: Spacing[4],
  },
  notesText: { fontSize: 13, marginTop: 6, lineHeight: 19 },

  emailHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 4, paddingVertical: 4, marginBottom: Spacing[4],
  },
  emailHintText: { fontSize: 11.5 },

  ctaBtn: {
    height: 52,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnText: { color: '#fff', fontSize: FontSize.md, letterSpacing: 0.2 },
});

const pillStyles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  text: { fontSize: 10.5, letterSpacing: 0.4 },
});
