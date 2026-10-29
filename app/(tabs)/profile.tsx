import { Ionicons } from '@expo/vector-icons';
import Constants from "expo-constants";
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from "@tanstack/react-query";
import { EditProfileSheet } from '@/components/screens/profile/edit-profile-sheet';
import { ProfileHeader } from '@/components/screens/profile/profile-header';
import { MenuRow, SettingsSection, SignOutRow } from '@/components/screens/profile/settings-section';
import { StatsRow } from '@/components/screens/profile/stats-row';
import { categoryInfo, countOf } from '@/lib/subscription-view';
import type { Categories, CategoryLeft, Subscription } from '@/types/api';

import { FontSize, Spacing } from "@/constants/theme";
import { column } from '@/constants/layout';
import { useAlert } from "@/context/alert";
import { useAuth } from '@/context/auth';
import { useQueryFocusRefetch } from "@/hooks/useQueryFocusRefetch";
import { useTheme } from "@/hooks/use-theme";
import {
  addressesApi,
  appSettingsApi,
  invoicesApi,
  notificationsApi,
  profileApi,
  subscriptionsApi,
} from "@/lib/api";
import { trackLogout } from '@/lib/analytics';
import { CACHE_TTL } from "@/lib/query-client";
import {
  readProfileSubtitlesCache,
  writeProfileSubtitlesCache,
} from "@/lib/home-cache";
import { revalidateSession } from "@/lib/auth-session";
import { isPhoneEmail, phoneFromEmail } from '@/lib/phone-email';

type LeftTile = { value: number; label: string };

/**
 * What the profile says about the customer's subscriptions: one count per
 * category in its own unit words, in menu order, never added across units.
 */
function subscriptionSummary(
  subs: Subscription[],
  left: Record<string, CategoryLeft>,
  categories: Categories,
): { tiles: LeftTile[]; detail: string } {
  const entries = Object.entries(left).sort(
    ([a], [b]) => categoryInfo(categories, a).sort_order - categoryInfo(categories, b).sort_order,
  );
  const sharedUnit = new Set(entries.map(([, l]) => l.unit.plural)).size < entries.length;
  const tiles = entries.map(([slug, l]) => {
    const words = sharedUnit ? categoryInfo(categories, slug).name : `${l.unit.plural.charAt(0).toUpperCase()}${l.unit.plural.slice(1)}`;
    return { value: l.left, label: `${words} left` };
  });
  const anyLeft = entries.some(([, l]) => l.left > 0);
  return {
    tiles: tiles.length > 0 ? tiles : [{ value: 0, label: 'Bowls left' }],
    detail: anyLeft
      ? `${entries.map(([, l]) => countOf(l.left, l.unit)).join(' · ')} left`
      : subs.length > 0
        ? 'Renew'
        : 'Choose a plan',
  };
}

export default function ProfileScreen() {
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const userId = user?.id ?? null;

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [signingOut, setSigningOut]       = useState(false);

  // Synchronous MMKV read before first render (fast path: tab navigation with session already resolved)
  const [cachedSubtitles, setCachedSubtitles] = useState<ReturnType<typeof readProfileSubtitlesCache>>(
    () => (userId ? readProfileSubtitlesCache(userId) : null),
  );
  // Deeplink path: userId is null on mount because auth resolves asynchronously.
  const cacheInitRef = useRef(userId !== null);
  useEffect(() => {
    if (cacheInitRef.current || !userId) return;
    cacheInitRef.current = true;
    const cached = readProfileSubtitlesCache(userId);
    if (cached) setCachedSubtitles(cached);
  }, [userId]);

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const [subscriptionsRes, addressesRes, invoicesRes, notificationsRes] = await Promise.all([
        subscriptionsApi.list(),
        addressesApi.list(),
        invoicesApi.list(),
        notificationsApi.list(),
      ]);
      return { subscriptionsRes, addressesRes, invoicesRes, notificationsRes };
    },
    staleTime: CACHE_TTL.profile,
  });
  useQueryFocusRefetch(["profile"]);

  const summary = React.useMemo(
    () =>
      data
        ? subscriptionSummary(data.subscriptionsRes.data, data.subscriptionsRes.meta.left_by_category ?? {}, data.subscriptionsRes.meta.categories)
        : null,
    [data],
  );

  React.useEffect(() => {
    if (!data || !summary || !userId) return;
    writeProfileSubtitlesCache(userId, {
      bowlsLeft:    summary.tiles[0].value,
      leftLabel:    summary.tiles[0].label,
      detail:       summary.detail,
      addressCount: data.addressesRes.data.length,
      invoiceCount: data.invoicesRes.data.length,
      unreadCount:  data.notificationsRes.unread_count,
    });
  }, [data, summary, userId]);

  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: appSettingsApi.get,
    staleTime: CACHE_TTL.appSettings,
  });

  // API data takes priority; cache fills in before first API response
  const addressCount = data?.addressesRes.data.length            ?? cachedSubtitles?.addressCount ?? 0;
  const invoiceCount = data?.invoicesRes.data.length             ?? cachedSubtitles?.invoiceCount ?? 0;
  const unreadCount  = data?.notificationsRes.unread_count       ?? cachedSubtitles?.unreadCount  ?? 0;
  const appStoreUrl = appSettings?.data.appStoreUrl ?? null;
  const playStoreUrl = appSettings?.data.playStoreUrl ?? null;
  const showBuiltByCard = appSettings?.data.showBuiltByCard ?? false;
  // Skeleton only on very first open — once cached, subtitles show immediately
  const loading = cachedSubtitles === null && isLoading;
  const subscriptions = data?.subscriptionsRes.data;
  const bowlsScheduled = subscriptions
    ?.filter((sub) => sub.status === 'active' || sub.status === 'upcoming')
    .reduce((sum, sub) => sum + sub.bowls_scheduled, 0);
  const shown = summary ?? {
    tiles: [{ value: cachedSubtitles?.bowlsLeft ?? 0, label: cachedSubtitles?.leftLabel ?? 'Bowls left' }],
    detail: cachedSubtitles?.detail ?? 'Choose a plan',
  };

  function handleRateApp() {
    const url = Platform.OS === "ios" ? appStoreUrl : playStoreUrl;
    if (url) void Linking.openURL(url);
  }

  async function handleSaveProfile(data: { full_name?: string; phone?: string; email?: string }) {
    await profileApi.update(data);
    // A new phone or email changes the login itself; pick that up too.
    await Promise.all([refreshProfile(), revalidateSession()]);
  }

  async function handleSignOut() {
    showAlert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          trackLogout();
          await signOut();
        },
      },
    ]);
  }

  const isPhoneUser = isPhoneEmail(user?.email);
  const name  = profile?.full_name ?? null;
  const phone = profile?.phone
    ?? phoneFromEmail(user?.email)
    ?? null;
  const email = profile?.email
    ?? (user?.email && !isPhoneEmail(user.email) ? user.email : null)
    ?? null;

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          column(),
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "android" ? 12 : 0),
          },
        ]}
      >
        <Text
          style={[
            styles.topBarTitle,
            { color: colors.text, fontFamily: fonts.display },
          ]}
        >
          Profile
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            column(),
            styles.content,
            { paddingBottom: Spacing[5] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ProfileHeader
            name={name}
            phone={phone}
            email={email}
            memberSince={memberSince}
            onEditPress={() => setShowEditSheet(true)}
          />

          <StatsRow
            loading={loading}
            tiles={[
              ...shown.tiles.map((tile) => ({ ...tile, onPress: () => router.push('/subscriptions') })),
              // A count across different units would mean nothing.
              ...(shown.tiles.length === 1
                ? [{ value: bowlsScheduled ?? '–', label: 'Scheduled', onPress: () => router.push('/(tabs)/deliveries') }]
                : []),
              { value: invoiceCount, label: 'Invoices', onPress: () => router.push('/invoices') },
            ]}
          />

          <SettingsSection title="Account">
            <MenuRow
              icon="leaf-outline"
              label="My subscription"
              detail={loading ? undefined : shown.detail}
              onPress={() => router.push("/subscriptions")}
            />
            <MenuRow
              icon="receipt-outline"
              label="Invoices"
              detail={loading || invoiceCount === 0 ? undefined : String(invoiceCount)}
              onPress={() => router.push("/invoices")}
            />
            <MenuRow
              icon="location-outline"
              label="Saved addresses"
              detail={loading || addressCount === 0 ? undefined : String(addressCount)}
              last
              onPress={() => router.push("/addresses")}
            />
          </SettingsSection>

          <SettingsSection title="Preferences">
            <MenuRow
              icon="checkmark-done-outline"
              label="Daily goals"
              onPress={() => router.push("/goals")}
            />
            <MenuRow
              icon="calendar-outline"
              label="Delivery schedule"
              onPress={() => router.push("/(tabs)/deliveries")}
            />
            <MenuRow
              icon="notifications-outline"
              label="Notifications"
              detail={loading || unreadCount === 0 ? undefined : `${unreadCount} new`}
              last
              onPress={() => router.push("/notifications")}
            />
          </SettingsSection>

          <SettingsSection title="More from Satvik Salaad">
            <MenuRow
              icon="play-circle-outline"
              label="Videos"
              onPress={() => router.push("/videos")}
            />
            <MenuRow
              icon="nutrition-outline"
              label="Diet consultation"
              onPress={() => router.push("/diet-consultation")}
            />
            <MenuRow
              icon="business-outline"
              label="Office Salaad for your team"
              last
              onPress={() =>
                router.push({
                  pathname: "/policy-webview",
                  params: { url: "https://satviksalaad.com/corporate", title: "Office Salaad" },
                })
              }
            />
          </SettingsSection>

          <SettingsSection title="Support">
            <MenuRow
              icon="chatbubble-ellipses-outline"
              label="Help & support"
              onPress={() => router.push("/support")}
            />
            {(appStoreUrl || playStoreUrl) && (
              <MenuRow
                icon="star-outline"
                label="Rate the app"
                onPress={handleRateApp}
              />
            )}
            <MenuRow
              icon="document-text-outline"
              label="Policies"
              last
              onPress={() => router.push("/policies")}
            />
          </SettingsSection>

          <SignOutRow onPress={handleSignOut} busy={signingOut} />

          {showBuiltByCard ? (
            <TouchableOpacity
              style={styles.footer}
              onPress={() => {
                void Linking.openURL("https://infynixlabs.com").catch(() => {});
              }}
              activeOpacity={0.55}
              accessibilityLabel="Visit Infynix Labs website"
              accessibilityRole="link"
            >
              <Text
                style={[
                  styles.footerAttrib,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                Designed & built in India by
              </Text>
              <Text
                style={[
                  styles.footerBrand,
                  { color: colors.primaryDark, fontFamily: fonts.bodySemibold },
                ]}
              >
                INFYNIX LABS
              </Text>
              <Text
                style={[
                  styles.footerVersion,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {`Satvik Salaad · v${Constants.expoConfig?.version ?? "1.0"} · ${Platform.OS === "ios" ? "iOS" : "Android"}`}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerSimple}>
              <Text
                style={[
                  styles.footerVersion,
                  { color: colors.textMuted, fontFamily: fonts.body },
                ]}
              >
                {`Satvik Salaad · v${Constants.expoConfig?.version ?? "1.0"} · ${Platform.OS === "ios" ? "iOS" : "Android"}`}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <EditProfileSheet
        visible={showEditSheet}
        isPhoneUser={isPhoneUser}
        currentName={name ?? ""}
        currentPhone={phone}
        currentEmail={email}
        onClose={() => setShowEditSheet(false)}
        onSave={handleSaveProfile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[2],
    gap: Spacing[5],
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
    paddingTop: Spacing[3],
  },
  topBarTitle: { fontSize: FontSize["1.5xl"], letterSpacing: -0.5 },


  footer: {
    alignItems: "center",
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[3],
    gap: Spacing[1],
  },
  footerSimple: { alignItems: "center", paddingVertical: Spacing[4] },
  footerDivider: {
    width: "40%",
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing[4],
  },
  footerBrand: { fontSize: 10, letterSpacing: 1.8, marginBottom: 3 },
  footerAttrib: { fontSize: 11, letterSpacing: 0.1 },
  footerVersion: {
    fontSize: 10,
    letterSpacing: 0.2,
    opacity: 0.8,
    marginTop: 2,
  },
});
