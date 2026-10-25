import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuRow, SettingsSection } from '@/components/screens/profile/settings-section';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CardEdge, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { trackScreenOpened } from '@/lib/analytics';
import { useTheme } from '@/hooks/use-theme';
import { openMap } from '@/lib/contact-actions';
import { useCafeInfo, useSupportContact } from '@/lib/support-contact';
import { useAuth } from '@/context/auth';

type QuickAction = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  message: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'bicycle-outline', label: 'Delivery issue',  message: 'I have an issue with a delivery.'   },
  { icon: 'leaf-outline',    label: 'Food complaint',  message: 'I have a complaint about my food.'  },
  { icon: 'calendar-outline', label: 'Subscription issue', message: 'I want to report a problem with my subscription.' },
  { icon: 'receipt-outline', label: 'Invoice / GST',   message: 'I need help with an invoice / GST.' },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MSupport() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useEffect(() => { trackScreenOpened('support'); }, []);

  const { profile } = useAuth();
  const {
    phone: supportPhone,
    phoneDisplay,
    whatsappUrl,
    email: supportEmail,
    socials,
    swiggyUrl,
    zomatoUrl,
  } = useSupportContact();
  const cafe = useCafeInfo();

  const userName = profile?.full_name?.trim() || null;

  // Opens WhatsApp Messenger specifically (not Business).
  // iOS:     whatsapp:// scheme is exclusive to Messenger.
  // Android: intent:// URI with package=com.whatsapp locks to Messenger.
  // Falls back to wa.me web URL if WhatsApp is not installed.
  const handleWhatsAppPress = useCallback(async (topic?: string) => {
    if (!whatsappUrl) return;
    const greeting = userName
      ? `Hi, I'm ${userName}. I need help with Satvik Salaad.`
      : `Hi, I need help with Satvik Salaad.`;
    const encodedText = encodeURIComponent(topic ? `${greeting} ${topic}` : greeting);
    const phoneMatch = whatsappUrl.match(/wa\.me\/(\d+)/);
    if (phoneMatch) {
      const phone = phoneMatch[1];
      const nativeUrl = Platform.OS === 'android'
        ? `intent://send?phone=${phone}&text=${encodedText}#Intent;package=com.whatsapp;scheme=whatsapp;end`
        : `whatsapp://send?phone=${phone}&text=${encodedText}`;
      try {
        await Linking.openURL(nativeUrl);
        return;
      } catch {
        // WhatsApp not installed — fall through to wa.me
      }
    }
    void Linking.openURL(`${whatsappUrl}?text=${encodedText}`);
  }, [whatsappUrl, userName]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Help & Support" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing[5] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.primary },
            Shadows.sm as object,
          ]}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroIconBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.heroTitle, { fontFamily: fonts.display }]}>
                {"We're here to help"}
              </Text>
              <Text style={[styles.heroSub, { fontFamily: fonts.body }]}>
                Chat with us on WhatsApp, every day
              </Text>
            </View>
          </View>
          {whatsappUrl && (
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: "#fff" }]}
              activeOpacity={0.7}
              onPress={() => void handleWhatsAppPress()}
            >
              <Text
                style={[
                  styles.chatBtnText,
                  { color: colors.primaryDark, fontFamily: fonts.bodySemibold },
                ]}
              >
                Start chat
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick actions */}
        {whatsappUrl && (
          <>
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.primary, fontFamily: fonts.bodySemibold },
              ]}
            >
              Quick actions
            </Text>
            <View style={styles.quickGrid}>
              {QUICK_ACTIONS.map((a, i) =>
                i % 2 === 0 ? (
                  <View key={a.label} style={styles.quickRow}>
                    <QuickCard
                      action={a}
                      colors={colors}
                      fonts={fonts}
                      onPress={(message) => void handleWhatsAppPress(message)}
                    />
                    {QUICK_ACTIONS[i + 1] && (
                      <QuickCard
                        action={QUICK_ACTIONS[i + 1]}
                        colors={colors}
                        fonts={fonts}
                        onPress={(message) => void handleWhatsAppPress(message)}
                      />
                    )}
                  </View>
                ) : null,
              )}
            </View>
          </>
        )}

        <View style={styles.contactGroup}>
          <SettingsSection title="Deliveries">
            <MenuRow icon="sunny-outline" label="Lunch" detail="8:00 AM – 1:00 PM" />
            <MenuRow icon="moon-outline" label="Dinner" detail="4:00 PM – 8:30 PM" />
            <MenuRow icon="calendar-outline" label="Sunday" detail="Optional, within 3 km" last />
          </SettingsSection>
        </View>

        <View style={styles.contactGroup}>
          <SettingsSection title="Our café">
            <MenuRow icon="time-outline" label={cafe.isOpen ? 'Open now' : 'Closed now'} detail={cafe.timeLabel} />
            <MenuRow
              icon="location-outline"
              label="Directions"
              detail="Prahladnagar"
              last={!swiggyUrl && !zomatoUrl}
              onPress={() => void openMap({ gmapUrl: cafe.mapsUrl })}
            />
            {swiggyUrl ? (
              <MenuRow
                icon="bag-handle-outline"
                label="Order on Swiggy"
                last={!zomatoUrl}
                onPress={() => void Linking.openURL(swiggyUrl)}
              />
            ) : null}
            {zomatoUrl ? (
              <MenuRow icon="restaurant-outline" label="Order on Zomato" last onPress={() => void Linking.openURL(zomatoUrl)} />
            ) : null}
          </SettingsSection>
        </View>

        <View style={styles.contactGroup}>
          <SettingsSection title="Still need help?">
            <MenuRow
              icon="call-outline"
              label="Call us"
              detail={phoneDisplay}
              onPress={() => void Linking.openURL(`tel:${supportPhone.replace(/\D/g, "")}`)}
            />
            <MenuRow
              icon="mail-outline"
              label="Email"
              detail={supportEmail}
              last
              onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
            />
          </SettingsSection>
        </View>

        {socials.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.primary, fontFamily: fonts.bodySemibold },
              ]}
            >
              Follow us
            </Text>
            <View style={styles.socialRow}>
              {socials.map((social) => (
                <TouchableOpacity
                  key={social.key}
                  activeOpacity={0.7}
                  accessibilityLabel={social.label}
                  onPress={() => void Linking.openURL(social.url)}
                  style={[
                    styles.socialBtn,
                    { backgroundColor: colors.surface2, borderColor: 'transparent' },
                  ]}
                >
                  <Ionicons name={social.icon} size={18} color={colors.primary} />
                  <Text style={[styles.socialLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                    {social.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── QuickCard ────────────────────────────────────────────────────────────────

function QuickCard({
  action,
  colors,
  fonts,
  onPress,
}: {
  action: QuickAction;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
  onPress: (message: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickCard, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}
      activeOpacity={0.7}
      onPress={() => onPress(action.message)}
    >
      <View style={[styles.quickIconBox, { backgroundColor: colors.sageSoft }]}>
        <Ionicons name={action.icon} size={17} color={colors.primary} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
        {action.label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: Spacing[4], paddingHorizontal: Spacing[5], gap: 0 },

  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  socialLabel: { fontSize: FontSize.sm },

  heroCard: {
    borderRadius: Radius.xl,
    padding: 18,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroTitle: { fontSize: FontSize.lg, color: "#fff" },
  heroSub: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.85)" },
  chatBtn: {
    width: "100%",
    height: 40,
    marginTop: 14,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtnText: { fontSize: FontSize.sm },

  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: Spacing[2],
    marginTop: Spacing[5],
  },

  quickGrid: { gap: 8 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  quickIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { flex: 1, fontSize: FontSize.sm },
  contactGroup: { marginTop: Spacing[5] },
});
