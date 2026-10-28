import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { ProfileHeader } from '@/components/screens/profile/profile-header';
import { MenuRow, SettingsSection, SignOutRow } from '@/components/screens/profile/settings-section';
import { FontSize, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useAlert } from '@/context/alert';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { callNumber } from '@/lib/contact-actions';
import { useSupportContact } from '@/lib/support-contact';

export default function DeliveryPartnerProfileScreen() {
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut } = useAuth();
  const { phone: supportPhone, phoneDisplay: supportPhoneDisplay } = useSupportContact();

  async function callSupport() {
    if (!(await callNumber(supportPhone))) {
      showAlert('Unable to call', 'Your device could not open the dialer.');
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : null;

  function handleSignOut() {
    showAlert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        // signOut() can reject on a flaky network; say so instead of doing nothing.
        onPress: () => {
          void signOut().catch((err: unknown) => {
            showAlert('Could not log out', err instanceof Error ? err.message : 'Check your connection and try again.');
          });
        },
      },
    ]);
  }

  return (
    <View style={[styles.root, column(), { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          // Same header offset as the Deliveries tab.
          { backgroundColor: colors.background, paddingTop: insets.top + Spacing[3] },
        ]}
      >
        <Text style={[styles.topBarTitle, { color: colors.text, fontFamily: fonts.display }]}>
          Profile
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing[5] }]}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          name={profile?.full_name ?? null}
          phone={profile?.phone ?? null}
          email={null}
          memberSince={memberSince}
        />

        <SettingsSection title="Support">
          <MenuRow
            icon="call-outline"
            label="Call support"
            detail={supportPhoneDisplay}
            onPress={() => { void callSupport(); }}
            last
          />
        </SettingsSection>

        <SignOutRow onPress={handleSignOut} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2], gap: Spacing[5] },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  topBarTitle: { fontSize: FontSize['1.5xl'], letterSpacing: -0.5 },

});
