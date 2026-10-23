import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getInitials(name: string | null): string {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function fmtPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `+91 ${digits}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  name: string | null;
  phone: string | null;
  email: string | null;
  memberSince: string | null;
  /** Omit to hide the edit link (e.g. roles whose name/phone are admin-managed). */
  onEditPress?: () => void;
}

/** Centered identity block: initials avatar, name, contact and an edit link. */
export function ProfileHeader({ name, phone, email, memberSince, onEditPress }: ProfileHeaderProps) {
  const { colors, fonts } = useTheme();
  const contact = [fmtPhone(phone), email].filter(Boolean).join('  ·  ');

  return (
    <View style={s.root}>
      <View style={[s.avatar, { backgroundColor: colors.sageSoft }]}>
        <Text style={[s.avatarText, { color: colors.primary, fontFamily: fonts.display }]}>
          {getInitials(name ?? phone)}
        </Text>
      </View>

      <Text style={[s.name, { color: colors.text, fontFamily: fonts.display }]} numberOfLines={1}>
        {name ?? 'Add your name'}
      </Text>
      {contact ? (
        <Text style={[s.contact, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={1}>
          {contact}
        </Text>
      ) : null}
      {memberSince ? (
        <Text style={[s.since, { color: colors.textMuted, fontFamily: fonts.body }]}>
          Member since {memberSince}
        </Text>
      ) : null}

      {onEditPress ? (
        <TouchableOpacity
          onPress={onEditPress}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={s.edit}
        >
          <Text style={[s.editText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
            Edit profile
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[1], gap: 2 },
  avatar:     { width: 84, height: 84, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[3] },
  avatarText: { fontSize: FontSize['3xl'], letterSpacing: 0.5 },
  name:       { fontSize: FontSize['1.5xl'], letterSpacing: -0.3 },
  contact:    { fontSize: FontSize.sm, marginTop: 2 },
  since:      { fontSize: FontSize.xs, marginTop: 2 },
  edit:       { marginTop: Spacing[2] },
  editText:   { fontSize: FontSize.sm },
});
