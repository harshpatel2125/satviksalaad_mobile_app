import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/alert';
import { useTheme } from '@/hooks/use-theme';
import { callNumber, openMap } from '@/lib/contact-actions';
import { useCafeInfo, useSupportContact } from '@/lib/support-contact';

export function CafeCard() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { phone, phoneDisplay } = useSupportContact();
  const cafe = useCafeInfo();
  const open = cafe.isOpen;

  async function openDirections() {
    if (!(await openMap({ gmapUrl: cafe.mapsUrl }))) {
      showAlert('Unable to open maps', 'Your device could not open a maps app.');
    }
  }

  async function callCafe() {
    if (!(await callNumber(phone))) {
      showAlert('Unable to call', 'Your device could not open the dialer.');
    }
  }

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
      <Image
        source={require('@/assets/images/cafe.jpg')}
        style={s.photo}
        contentFit="cover"
        accessibilityLabel="A wrap platter held over the café counter"
      />

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>
            Visit our café
          </Text>
          <View style={[s.pill, { backgroundColor: open ? colors.successBg : colors.surface2 }]}>
            <Text
              style={[
                s.pillText,
                { color: open ? colors.success : colors.textMuted, fontFamily: fonts.bodySemibold },
              ]}
            >
              {open ? 'Open now' : 'Closed'}
            </Text>
          </View>
        </View>

        <View style={s.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} style={s.infoIcon} />
          <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {cafe.address}
          </Text>
        </View>
        <View style={s.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} style={s.infoIcon} />
          <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {cafe.hoursLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[s.btn, s.orderBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.navigate('/(tabs)/cafe' as Href)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name="restaurant-outline" size={15} color={colors.textOnPrimary} />
          <Text style={[s.btnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
            Café menu & order
          </Text>
        </TouchableOpacity>

        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primaryBg }]}
            onPress={() => void openDirections()}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="navigate-outline" size={15} color={colors.onPrimaryBg} />
            <Text style={[s.btnText, { color: colors.onPrimaryBg, fontFamily: fonts.bodySemibold }]}>
              Directions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primaryBg }]}
            onPress={() => void callCafe()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Call ${phoneDisplay}`}
          >
            <Ionicons name="call-outline" size={15} color={colors.onPrimaryBg} />
            <Text style={[s.btnText, { color: colors.onPrimaryBg, fontFamily: fonts.bodySemibold }]}>
              Call
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    aspectRatio: 900 / 506,
  },
  body: {
    padding: Spacing[4],
    gap: Spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  title: {
    flexShrink: 1,
    fontSize: FontSize.lg,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: FontSize.xs,
    letterSpacing: 0.1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[2],
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.snug,
  },
  orderBtn: {
    flex: 0,
    marginTop: Spacing[1],
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing[2.5],
  },
  btn: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.full,
  },
  btnText: {
    fontSize: FontSize.sm,
  },
});
