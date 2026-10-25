import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { Brand, CardEdge, FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toWhatsAppNumber } from '@/lib/contact-actions';
import { useSupportContact } from '@/lib/support-contact';

const CLINIC = 'Vitamin Y: Diet Clinic';
const FOUNDER = { name: 'Divya Agrawal', title: 'Founder & Clinical Dietitian', credentials: 'M.Sc. Food & Nutrition · Clinical Nutrition' };

const PACKAGES = [
  { label: 'Diet consultation', months: null, price: 1000 },
  { label: '1 month', months: 1, price: 4000 },
  { label: '3 months', months: 3, price: 11000 },
  { label: '6 months', months: 6, price: 22000 },
] as const;
const MONTHLY_PRICE = 4000;

const FOCUS = [
  'Understanding your symptoms, not just labels',
  'Finding nutritional and lifestyle imbalances',
  'Supporting gut, hormone and metabolic health',
  'Building realistic, long-term food habits',
];
const DESIGNED_FOR = [
  'Sustainable weight loss',
  'Diabetes / prediabetes',
  'PCOD / thyroid concerns',
  'Gut health & digestion',
  'Fatigue, inflammation & imbalance',
];
const SESSION = [
  'Your health history and current concerns',
  'A review of your lab reports, if you have them',
  'Possible root causes of your symptoms',
  'Timelines, approach and what to expect',
];
const RULES = [
  'All sessions are online',
  'Fees are non-refundable once paid',
  'Lab tests and supplements are not included',
  'Sessions start and end on time',
  "One reschedule, with 6 hours' notice",
  'No reminders are sent, so set an alarm',
  'Missed sessions without notice are not refunded',
  'Share lab reports in the first session to qualify for a follow-up pre-consultation',
];

const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

function bookingText(pkg?: (typeof PACKAGES)[number]): string {
  const choice = !pkg
    ? 'a 1:1 Diet Consultation'
    : pkg.months
      ? `the ${pkg.months}-month diet package (${rupees(pkg.price)}) at ${CLINIC}`
      : `a diet consultation (${rupees(pkg.price)}) at ${CLINIC}`;
  return `Hello Divya,\n\nI would like to book ${choice}.\nPlease share the next steps.\n\nThank you.`;
}

export default function DietConsultationScreen() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useSupportContact();
  const whatsapp = toWhatsAppNumber(phone);

  function book(pkg?: (typeof PACKAGES)[number]) {
    if (whatsapp) void Linking.openURL(`https://wa.me/${whatsapp}?text=${encodeURIComponent(bookingText(pkg))}`);
  }

  const body = { color: colors.textSecondary, fontFamily: fonts.body };
  const muted = { color: colors.textMuted, fontFamily: fonts.body };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Diet consultation" onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + Spacing[6] }]}
      >
        <View style={s.intro}>
          <Text style={[s.eyebrow, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>1:1 CLINICAL NUTRITION</Text>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>
            Consult with our founder, {FOUNDER.name}
          </Text>
          <Text style={[s.text, body]}>
            Science-backed, personalised and sustainable guidance, not quick fixes. Divya personally reviews every case
            and designs the road map for your health.
          </Text>
        </View>

        <View style={[s.founder, { backgroundColor: Brand.forest }]}>
          <Text style={[s.founderTitle, { color: colors.accent, fontFamily: fonts.bodySemibold }]}>
            {FOUNDER.title.toUpperCase()}
          </Text>
          <Text style={[s.founderName, { color: colors.textOnPrimary, fontFamily: fonts.display }]}>{FOUNDER.name}</Text>
          <Text style={[s.small, { color: colors.textOnPrimary, opacity: 0.75, fontFamily: fonts.body }]}>
            {FOUNDER.credentials}
          </Text>
          <Text style={[s.text, { color: colors.textOnPrimary, opacity: 0.88, fontFamily: fonts.body }]}>
            A biotechnologist, clinical dietitian and yoga expert who consults and researches lifestyle disease with
            U.S.-based scientists, and pairs Ayurvedic wisdom with modern nutrition science.
          </Text>
          <TouchableOpacity
            onPress={() => book()}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[s.goldBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="logo-whatsapp" size={17} color="#1D1A12" />
            <Text style={[s.goldBtnText, { fontFamily: fonts.bodySemibold }]}>Book your consultation</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
          <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Every consultation focuses on</Text>
          {FOCUS.map((item) => (
            <Bullet key={item} text={item} />
          ))}
          <Text style={[s.cardTitle, s.cardTitleGap, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Designed for</Text>
          <View style={s.chips}>
            {DESIGNED_FOR.map((item) => (
              <View key={item} style={[s.chip, { backgroundColor: colors.primaryBg }]}>
                <Text style={[s.chipText, { color: colors.onPrimaryBg, fontFamily: fonts.bodyMedium }]}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={s.note}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.accent} />
            <Text style={[s.small, s.flex, muted]}>
              We don&apos;t currently consult pregnant or lactating women, or children under 10.
            </Text>
          </View>
        </View>

        <View>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.display }]}>{CLINIC}</Text>
          <Text style={[s.small, muted]}>Your consultation is included in every package.</Text>
        </View>
        <View style={s.packages}>
          {PACKAGES.map((pkg) => {
            const longer = pkg.months && pkg.months > 1;
            return (
              <View key={pkg.label} style={[s.package, { backgroundColor: colors.surface }, CardEdge]}>
                <Text style={[s.packageLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>{pkg.label}</Text>
                <Text style={[s.packagePrice, { color: colors.text, fontFamily: fonts.display }]}>{rupees(pkg.price)}</Text>
                <Text style={[s.small, muted]}>{pkg.months ? 'Consultation included' : 'One online session'}</Text>
                {longer ? (
                  <>
                    <Text style={[s.small, muted]}>{rupees(Math.round(pkg.price / pkg.months))} a month</Text>
                    <Text style={[s.small, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                      Save {rupees(MONTHLY_PRICE * pkg.months - pkg.price)} vs. paying monthly
                    </Text>
                  </>
                ) : null}
                <TouchableOpacity
                  onPress={() => book(pkg)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Book ${pkg.label} on WhatsApp`}
                  style={[s.outlineBtn, { borderColor: colors.primary }]}
                >
                  <Ionicons name="logo-whatsapp" size={14} color={colors.primary} />
                  <Text style={[s.outlineBtnText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>Book</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
          <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Step 1 · Lab work</Text>
          <Text style={[s.text, muted]}>
            Recommended for precision: lab reports give a deeper understanding and more accurate guidance.
          </Text>
          <Text style={[s.cardTitle, s.cardTitleGap, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            Step 2 · A 30-minute online pre-consultation
          </Text>
          <Text style={[s.text, muted]}>
            A paid session ({rupees(PACKAGES[0].price)}, or included in any package) focused entirely on understanding you:
          </Text>
          {SESSION.map((item) => (
            <Bullet key={item} text={item} />
          ))}
          <Text style={[s.small, muted]}>Meal plans and supplement protocols aren&apos;t part of this session.</Text>
        </View>

        <View style={[s.card, { backgroundColor: colors.surface2 }]}>
          <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.bodySemibold }]}>Good to know</Text>
          {RULES.map((rule) => (
            <Text key={rule} style={[s.small, muted]}>
              · {rule}
            </Text>
          ))}
        </View>

        <View style={[s.card, { backgroundColor: colors.primaryTint }]}>
          <Text style={[s.text, { color: colors.primaryDark, fontFamily: fonts.body }]}>
            <Text style={{ fontFamily: fonts.bodySemibold }}>Want your meals planned too?</Text> The Diet + Meal Combo pairs
            your plan with salads curated to your goals.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/plans')}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[s.primaryBtnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>See plans</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={s.bullet}>
      <View style={[s.dot, { backgroundColor: colors.primary }]} />
      <Text style={[s.text, s.flex, { color: colors.textSecondary, fontFamily: fonts.body }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[3], gap: Spacing[4] },
  intro: { gap: Spacing[2] },
  eyebrow: { fontSize: 11, letterSpacing: 1.2 },
  title: { fontSize: FontSize['2xl'], lineHeight: FontSize['2xl'] * 1.2 },
  text: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.normal },
  small: { fontSize: FontSize.xs, lineHeight: FontSize.xs * LineHeight.normal },

  founder: { borderRadius: Radius.xl, padding: Spacing[5], gap: Spacing[2] },
  founderTitle: { fontSize: 11, letterSpacing: 1.2 },
  founderName: { fontSize: FontSize['2xl'] },
  goldBtn: {
    marginTop: Spacing[2],
    height: 46,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goldBtnText: { fontSize: FontSize.base, color: '#1D1A12' },

  card: { borderRadius: Radius.lg, padding: Spacing[4], gap: Spacing[2] },
  cardTitle: { fontSize: FontSize.sm },
  cardTitleGap: { marginTop: Spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: FontSize.xs },
  note: { flexDirection: 'row', gap: 6, marginTop: Spacing[1] },
  bullet: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },

  sectionTitle: { fontSize: FontSize.xl },
  packages: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  package: { flexBasis: '47%', flexGrow: 1, borderRadius: Radius.lg, padding: Spacing[4], gap: 4 },
  packageLabel: { fontSize: FontSize.sm },
  packagePrice: { fontSize: FontSize['2xl'], marginBottom: 2 },
  outlineBtn: {
    marginTop: Spacing[2],
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineBtnText: { fontSize: FontSize.sm },

  primaryBtn: { height: 42, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: Spacing[1] },
  primaryBtnText: { fontSize: FontSize.sm },
});
