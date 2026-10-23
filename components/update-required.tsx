import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Linking, StyleSheet, TouchableOpacity, useColorScheme, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

// Rendered above the theme providers, so it reads the system scheme directly.
export function UpdateRequired({ storeUrl }: { storeUrl: string }) {
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Update required</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        This version of Satvik Salaad is no longer supported. Please update the app to keep ordering.
      </Text>
      {storeUrl ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => void Linking.openURL(storeUrl).catch(() => {})}
        >
          <Text style={styles.buttonText}>Update now</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Open the App Store or Google Play and update Satvik Salaad from there.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
    gap: Spacing[4],
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.5,
  },
  button: {
    marginTop: Spacing[2],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.full,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
