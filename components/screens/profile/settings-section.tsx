import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ICON_SIZE = 20;
const ROW_PADDING = Spacing[4];
/** Separators start under the label, past the icon, as in an inset grouped list. */
const SEPARATOR_INSET = ROW_PADDING + ICON_SIZE + Spacing[3.5];

// ─── Menu Row ─────────────────────────────────────────────────────────────────

export interface MenuRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  /** Short value shown on the right, e.g. "24 left". */
  detail?: string;
  disabled?: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  /** Drops the separator under the final row of a group. */
  last?: boolean;
}

export function MenuRow({ icon, label, detail, disabled, rightElement, onPress, last }: MenuRowProps) {
  const { colors, fonts } = useTheme();

  return (
    <TouchableOpacity
      style={[s.row, disabled && { opacity: 0.45 }]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.6}
      disabled={disabled || !onPress}
    >
      <Ionicons name={icon} size={ICON_SIZE} color={disabled ? colors.textMuted : colors.primary} />
      <Text style={[s.label, { color: colors.text, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>
        {label}
      </Text>
      {rightElement ?? (
        <>
          {detail ? (
            <Text style={[s.detail, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textDisabled} /> : null}
        </>
      )}
      {!last ? (
        <View style={[s.separator, { backgroundColor: colors.border }]} pointerEvents="none" />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Section Group ────────────────────────────────────────────────────────────

export function SettingsSection({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={s.group}>
      {title ? (
        <Text style={[s.groupTitle, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[s.card, CardEdge, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

/** Plain red text at the foot of the list; no card and no icon. */
export function SignOutRow({ onPress, busy = false }: { onPress: () => void; busy?: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.6} style={s.signOut}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.error} />
      ) : (
        <Text style={[s.signOutText, { color: colors.error, fontFamily: fonts.bodySemibold }]}>Log out</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  group: { gap: Spacing[2] },
  groupTitle: { fontSize: 11, letterSpacing: 1.1, paddingHorizontal: Spacing[1] },
  card: { borderRadius: Radius.xl },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3.5],
    paddingHorizontal: ROW_PADDING,
    minHeight: 52,
  },
  label: { flex: 1, fontSize: FontSize.base },
  detail: { fontSize: FontSize.sm, maxWidth: '45%' },
  separator: {
    position: 'absolute',
    left: SEPARATOR_INSET,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },

  signOut: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing[4] },
  signOutText: { fontSize: FontSize.base },
});
