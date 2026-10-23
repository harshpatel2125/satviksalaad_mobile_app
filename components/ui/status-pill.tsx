import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { FontSize, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DeliveryStatus } from '@/types/api';

interface StatusPillProps {
  status: DeliveryStatus | string;
}

export function StatusPill({ status }: StatusPillProps) {
  const { colors, fonts } = useTheme();

  const map: Record<string, { bg: string; fg: string; label: string }> = {
    scheduled:        { bg: colors.surface2,   fg: colors.textMuted,   label: 'Scheduled' },
    out_for_delivery: { bg: colors.blueBg,     fg: colors.blue,        label: 'On route'  },
    delivered:        { bg: colors.successBg,  fg: colors.success,     label: 'Delivered' },
    missed:           { bg: colors.errorBg,    fg: colors.error,       label: 'Missed'    },
    skipped:          { bg: colors.surface2,   fg: colors.textMuted,   label: 'Skipped'   },
    cancelled:        { bg: colors.errorBg,    fg: colors.error,       label: 'Cancelled' },
    preparing:        { bg: colors.orangeBg,   fg: colors.orange,      label: 'Preparing' },
  };

  const cfg = map[status] ?? map.scheduled;

  return (
    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[s.text, { color: cfg.fg, fontFamily: fonts.bodySemibold }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  text: {
    fontSize: FontSize.xs,
    letterSpacing: 0.1,
  },
});
