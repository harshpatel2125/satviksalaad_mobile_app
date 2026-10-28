import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ScreenHeader } from '@/components/ui/screen-header';

import { AppearanceSheet } from '@/components/screens/profile/appearance-sheet';
import { DeleteAccountModal } from '@/components/screens/profile/delete-account-modal';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useThemePreference } from '@/context/theme-preference';
import { useTheme } from '@/hooks/use-theme';
import { useAlert } from '@/context/alert';
import { useAuth } from '@/context/auth';
import { trackNotificationToggled } from '@/lib/analytics';
import { accountApi, appSettingsApi, notificationPreferencesApi, type NotifPrefs } from "@/lib/api";
import { policyUrls } from '@/lib/policy-urls';
import { CACHE_TTL } from "@/lib/query-client";
import { clearPushToken, registerPushToken } from '@/lib/push-notifications';
import { goalsPopupEnabled, setGoalsPopupEnabled } from '@/lib/daily-goals';
import { deleteSharedFile, shareFileUri } from '@/lib/share-files';

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  value,
  onToggle,
  colors,
}: {
  value: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      style={[
        toggleStyles.track,
        { backgroundColor: value ? colors.primary : colors.surface2, borderColor: value ? colors.primary : colors.border },
      ]}>
      <View
        style={[
          toggleStyles.thumb,
          {
            backgroundColor: '#FFFFFF',
            transform: [{ translateX: value ? 18 : 2 }],
          },
        ]}
      />
    </TouchableOpacity>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});

// ─── SectionHead ──────────────────────────────────────────────────────────────

function SectionHead({
  label,
  colors,
  fonts,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
}) {
  return (
    <Text style={[sectionHeadStyles.text, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
      {label}
    </Text>
  );
}

const sectionHeadStyles = StyleSheet.create({
  text: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: Spacing[5],
    marginBottom: Spacing[2],
    paddingHorizontal: Spacing[5],
  },
});

// ─── SettingRow ───────────────────────────────────────────────────────────────

type SettingRowConfig = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail?: string;
  rightType: "toggle" | "chevron" | "none";
  toggleKey?: string;
  danger?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

function SettingRow({
  item,
  isFirst,
  toggleState,
  onToggle,
  colors,
  fonts,
}: {
  item: SettingRowConfig;
  isFirst: boolean;
  toggleState?: boolean;
  onToggle?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
}) {
  const iconColor = item.danger ? colors.error : colors.primary;
  const handlePress = item.rightType === 'toggle' ? onToggle : item.onPress;

  return (
    <TouchableOpacity
      activeOpacity={item.disabled ? 1 : item.rightType === 'toggle' ? 1 : 0.7}
      onPress={item.disabled ? undefined : handlePress}
      style={[
        rowStyles.row,
        item.disabled && { opacity: 0.4 },
      ]}>
      {!isFirst ? <View style={[rowStyles.separator, { backgroundColor: colors.border }]} pointerEvents="none" /> : null}
      <Ionicons name={item.icon} size={ROW_ICON} color={iconColor} />

      {/* Label + detail */}
      <View style={rowStyles.textGroup}>
        <Text
          style={[
            rowStyles.label,
            { color: item.danger ? colors.error : colors.text, fontFamily: fonts.bodyMedium },
          ]}>
          {item.label}
        </Text>
        {item.detail ? (
          <Text style={[rowStyles.detail, { color: colors.textMuted, fontFamily: fonts.body }]}>
            {item.detail}
          </Text>
        ) : null}
      </View>

      {/* Right element */}
      {item.rightType === 'toggle' && toggleState !== undefined && onToggle ? (
        <Toggle value={toggleState} onToggle={onToggle} colors={colors} />
      ) : item.rightType === 'chevron' ? (
        <Ionicons name="chevron-forward" size={14} color={colors.textDisabled} />
      ) : null}
    </TouchableOpacity>
  );
}

const ROW_ICON = 20;

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3.5],
    gap: Spacing[3.5],
  },
  // Inset under the label, past the icon, like the profile list.
  separator: {
    position: "absolute",
    top: 0,
    right: 0,
    left: Spacing[4] + ROW_ICON + Spacing[3.5],
    height: StyleSheet.hairlineWidth,
  },
  textGroup: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: FontSize.sm,
  },
  detail: {
    fontSize: FontSize.xs,
  },
});

// ─── Notification row definitions ─────────────────────────────────────────────

const NOTIF_ROWS: SettingRowConfig[] = [
  { icon: 'logo-whatsapp',          label: 'WhatsApp',           detail: 'Delivery updates & order alerts', rightType: 'toggle', toggleKey: 'notif_whatsapp' },
  { icon: 'notifications-outline',  label: 'Push notifications', detail: 'Alerts directly on your device',  rightType: 'toggle', toggleKey: 'notif_push' },
  { icon: 'phone-portrait-outline', label: 'SMS',                detail: 'Text message reminders',          rightType: 'toggle', toggleKey: 'notif_sms' },
  { icon: 'mail-outline',           label: 'Email',              detail: 'Updates sent to your inbox',      rightType: 'toggle', toggleKey: 'notif_email' },
];

const GOALS_ROW: SettingRowConfig = {
  icon: 'checkmark-done-outline',
  label: 'Daily goals on open',
  detail: "Show today's goals once a day",
  rightType: 'toggle',
};

const APPEARANCE_ROWS: SettingRowConfig[] = [
  {
    icon: "globe-outline",
    label: "Language",
    detail: "English only",
    rightType: "chevron",
    disabled: true,
  },
];


// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MSettings() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themePreference } = useThemePreference();
  const { showAlert } = useAlert();
  const [goalsPopup, setGoalsPopup] = useState(goalsPopupEnabled);
  const { signOut } = useAuth();
  const [showAppearance, setShowAppearance] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: appSettingsApi.get,
    staleTime: CACHE_TTL.appSettings,
  });
  const privacyPolicyUrl  = policyUrls(appSettings?.data).privacy;
  const showBuiltByCard   = appSettings?.data.showBuiltByCard ?? false;

  const privacyRows: SettingRowConfig[] = [
    {
      icon: 'lock-closed-outline',
      label: 'Privacy policy',
      detail: 'How we collect, use and protect your data',
      rightType: 'chevron',
      onPress: () => { router.push({ pathname: '/policy-webview', params: { url: privacyPolicyUrl, title: 'Privacy Policy' } }); },
    },
    { icon: 'download-outline', label: 'Download my data', detail: exportingData ? 'Preparing…' : 'DPDP compliant', rightType: exportingData ? 'none' : 'chevron', onPress: () => void handleExportData(), disabled: exportingData },
    { icon: 'trash-outline', label: 'Delete account', detail: 'Permanently remove your account', rightType: 'chevron', danger: true, onPress: () => setShowDeleteModal(true) },
  ];

  const themeLabel =
    themePreference === 'system' ? 'System Default'
    : themePreference === 'dark'  ? 'Dark'
    : 'Light';

  const qc = useQueryClient();

  const { data: prefsData } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: notificationPreferencesApi.get,
    staleTime: CACHE_TTL.notificationPrefs,
  });

  const updatePrefsMutation = useMutation({
    mutationFn: notificationPreferencesApi.update,
    onMutate: async (newPref: Partial<NotifPrefs>) => {
      await qc.cancelQueries({ queryKey: ['notification-prefs'] });
      const prev = qc.getQueryData<{ success: boolean; preferences: NotifPrefs }>(['notification-prefs']);
      qc.setQueryData(['notification-prefs'], (old: typeof prev) =>
        old ? { ...old, preferences: { ...old.preferences, ...newPref } } : old,
      );
      return { prev };
    },
    onError: (_err: unknown, _vars: Partial<NotifPrefs>, context: { prev: unknown } | undefined) => {
      if (context?.prev) qc.setQueryData(['notification-prefs'], context.prev);
    },
  });

  const toggles: Record<string, boolean> = {
    notif_whatsapp: prefsData?.preferences.notif_whatsapp ?? true,
    notif_push:     prefsData?.preferences.notif_push     ?? true,
    notif_sms:      prefsData?.preferences.notif_sms      ?? true,
    notif_email:    prefsData?.preferences.notif_email    ?? false,
  };

  async function handleExportData() {
    if (exportingData) return;
    setExportingData(true);
    let tempUri: string | null = null;
    try {
      const dateSlug = new Date().toISOString().slice(0, 10);
      tempUri = await shareFileUri(`satviksalaad-data-${dateSlug}.zip`);
      const downloadUrl = accountApi.getExportDownloadUrl();
      const authHeaders = await accountApi.getAuthHeader();

      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        tempUri,
        { headers: authHeaders },
      );

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      await Sharing.shareAsync(tempUri, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
        dialogTitle: 'Save your Satvik Salaad data',
      });
    } catch (err) {
      console.error('[exportData] error:', err);
      showAlert('Export failed', 'Could not export your data. Please try again.', [{ text: 'OK' }]);
    } finally {
      if (tempUri) void deleteSharedFile(tempUri);
      setExportingData(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      await accountApi.requestDeletion();
      setShowDeleteModal(false);
      showAlert(
        'Account deleted',
        'Your account has been deleted and you have been signed out.',
        [{ text: 'OK', onPress: () => void signOut() }],
      );
    } catch {
      setShowDeleteModal(false);
      showAlert(
        'Something went wrong',
        'Could not delete your account. Please try again or contact support.',
        [{ text: 'OK' }],
      );
    }
  }

  function toggle(key: string) {
    const newVal = !toggles[key];
    updatePrefsMutation.mutate({ [key]: newVal } as Partial<NotifPrefs>);

    if (key === 'notif_push') {
      trackNotificationToggled(newVal);
      void (newVal ? registerPushToken() : clearPushToken());
    }
  }

  function renderCard(rows: SettingRowConfig[]) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderWidth: 0 },
          CardEdge,
        ]}>
        {rows.map((item, index) => (
          <SettingRow
            key={item.label}
            item={item}
            isFirst={index === 0}
            toggleState={item.toggleKey !== undefined ? toggles[item.toggleKey] : undefined}
            onToggle={item.toggleKey ? () => toggle(item.toggleKey!) : undefined}
            colors={colors}
            fonts={fonts}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          column(),
          styles.scrollContent,
          {
            paddingTop: 0,
            paddingBottom: insets.bottom + Spacing[5],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications */}
        <SectionHead label="Notifications" colors={colors} fonts={fonts} />
        <View style={styles.cardWrapper}>{renderCard(NOTIF_ROWS)}</View>

        {/* Daily goals */}
        <SectionHead label="Daily goals" colors={colors} fonts={fonts} />
        <View style={styles.cardWrapper}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}>
            <SettingRow
              item={GOALS_ROW}
              isFirst
              toggleState={goalsPopup}
              onToggle={() => {
                setGoalsPopupEnabled(!goalsPopup);
                setGoalsPopup(!goalsPopup);
              }}
              colors={colors}
              fonts={fonts}
            />
          </View>
        </View>

        {/* Appearance */}
        <SectionHead label="Appearance" colors={colors} fonts={fonts} />
        <View style={styles.cardWrapper}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderWidth: 0 },
              CardEdge,
            ]}
          >
            {/* Theme row — opens AppearanceSheet */}
            <TouchableOpacity
              style={rowStyles.row}
              onPress={() => setShowAppearance(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="moon-outline" size={ROW_ICON} color={colors.primary} />
              <View style={rowStyles.textGroup}>
                <Text
                  style={[
                    rowStyles.label,
                    { color: colors.text, fontFamily: fonts.bodySemibold },
                  ]}
                >
                  Theme
                </Text>
                <Text
                  style={[
                    rowStyles.detail,
                    { color: colors.textMuted, fontFamily: fonts.body },
                  ]}
                >
                  {themeLabel}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.textDisabled}
              />
            </TouchableOpacity>
            {/* Language row — in the same card as Theme */}
            <SettingRow
              item={APPEARANCE_ROWS[0]}
              isFirst={false}
              colors={colors}
              fonts={fonts}
            />
          </View>
        </View>

        {/* Privacy & Security */}
        <SectionHead label="Privacy & Security" colors={colors} fonts={fonts} />
        <View style={styles.cardWrapper}>{renderCard(privacyRows)}</View>

        {/* Infynix Labs footer */}
        {showBuiltByCard && (
          <TouchableOpacity
            style={styles.footer}
            onPress={() => { void Linking.openURL('https://infynixlabs.com').catch(() => {}); }}
            activeOpacity={0.55}
            accessibilityLabel="Visit Infynix Labs website"
            accessibilityRole="link"
          >
            <Text style={[styles.footerAttrib, { color: colors.textMuted, fontFamily: fonts.body }]}>
              Designed & built in India by
            </Text>
            <Text style={[styles.footerBrand, { color: colors.primaryDark, fontFamily: fonts.bodySemibold }]}>
              INFYNIX LABS
            </Text>
            <Text style={[styles.footerVersion, { color: colors.textMuted, fontFamily: fonts.body }]}>
              {`Satvik Salaad · v${Constants.expoConfig?.version ?? '1.0'} · ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AppearanceSheet
        visible={showAppearance}
        onClose={() => setShowAppearance(false)}
      />
      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },

  // Card
  cardWrapper: {
    paddingHorizontal: Spacing[5],
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Footer
  footer:          { alignItems: 'center', paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[4], marginTop: Spacing[4], gap: Spacing[1] },
  footerDivider:   { width: '40%', height: StyleSheet.hairlineWidth, marginBottom: Spacing[4] },
  footerBrand:     { fontSize: 10, letterSpacing: 1.8, marginBottom: 3 },
  footerAttrib:    { fontSize: 11, letterSpacing: 0.1 },
  footerVersion:   { fontSize: 10, letterSpacing: 0.2, opacity: 0.8, marginTop: 2 },
});
