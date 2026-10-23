import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Sits directly on the page, without a card around it. */
export function EmptyState({ icon, title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors, fonts } = useTheme();
  return (
    <View style={s.root}>
      <View style={[s.iconCircle, { backgroundColor: colors.sageSoft }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>{title}</Text>
      {body ? <Text style={[s.body, { color: colors.textMuted, fontFamily: fonts.body }]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.85}
          style={[s.action, { backgroundColor: colors.primary }]}
        >
          <Text style={[s.actionText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: Spacing[10], paddingHorizontal: Spacing[6], gap: Spacing[2] },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  title: { fontSize: FontSize.lg, textAlign: 'center' },
  body: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  action: {
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    borderRadius: Radius.full,
  },
  actionText: { fontSize: FontSize.sm },
});
