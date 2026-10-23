import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Chip {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
  /** Overrides the group's default active color. */
  activeColor?: string;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Only decides whether "Clear all" shows; the sheet has no search input. */
  search: string;
  zoneChips: Chip[];
  slotChips: Chip[];
  statusChips: Chip[];
  onClearAll: () => void;
}

export default function FilterSheet({
  visible,
  onClose,
  search,
  zoneChips,
  slotChips,
  statusChips,
  onClearAll,
}: FilterSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(400);
  const opacity = useSharedValue(0);
  // Stays mounted after `visible` turns false until the slide-out finishes.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, { duration: 200, easing });
      translateY.value = withTiming(0, { duration: 220, easing });
    } else {
      opacity.value = withTiming(0, { duration: 150, easing });
      translateY.value = withTiming(400, { duration: 200, easing }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, opacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const hasActiveFilters =
    zoneChips.some((c) => c.active) ||
    slotChips.some((c) => c.active) ||
    statusChips.some((c) => c.active) ||
    search.length > 0;

  if (!mounted) return null;

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="none" visible={mounted} onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdropBase, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing[4] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>Filters</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={onClearAll} hitSlop={8}>
                <Text style={[styles.clearText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                  Clear all
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {zoneChips.length > 0 && (
              <View style={styles.group}>
                <Text style={[styles.groupLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                  Zone
                </Text>
                <View style={styles.chipWrap}>
                  {zoneChips.map((chip) => (
                    <TouchableOpacity
                      key={chip.key}
                      activeOpacity={0.7}
                      onPress={chip.onPress}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: chip.active ? colors.primary : colors.surface,
                          borderColor: chip.active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: chip.active ? colors.textOnPrimary : colors.text, fontFamily: fonts.bodyMedium },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {slotChips.length > 0 && (
              <View style={styles.group}>
                <Text style={[styles.groupLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                  Time slot
                </Text>
                <View style={styles.chipWrap}>
                  {slotChips.map((chip) => {
                    const color = chip.activeColor ?? colors.blue;
                    return (
                      <TouchableOpacity
                        key={chip.key}
                        activeOpacity={0.7}
                        onPress={chip.onPress}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: chip.active ? color : colors.surface,
                            borderColor: chip.active ? color : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: chip.active ? colors.textOnPrimary : colors.text, fontFamily: fonts.bodyMedium },
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {statusChips.length > 0 && (
              <View style={styles.group}>
                <Text style={[styles.groupLabel, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                  Status
                </Text>
                <View style={styles.chipWrap}>
                  {statusChips.map((chip) => (
                    <TouchableOpacity
                      key={chip.key}
                      activeOpacity={0.7}
                      onPress={chip.onPress}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: chip.active ? colors.primary : colors.surface,
                          borderColor: chip.active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: chip.active ? colors.textOnPrimary : colors.text, fontFamily: fonts.bodyMedium },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={[styles.doneText, { fontFamily: fonts.bodySemibold }]}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropBase: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing[5],
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing[2.5], marginBottom: Spacing[3] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  title: { fontSize: FontSize.lg },
  clearText: { fontSize: FontSize.sm },

  // The sheet is capped at 75% of the screen: flexShrink lets long chip lists
  // scroll inside the cap instead of pushing Done off screen, and flexGrow: 0
  // keeps a short list from stretching the sheet.
  scroll: { flexGrow: 0, flexShrink: 1 },
  group: { marginTop: Spacing[3] },
  groupLabel: { fontSize: FontSize.xs, letterSpacing: 0.5, marginBottom: Spacing[2] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  chip: {
    paddingHorizontal: Spacing[3.5],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs },

  doneBtn: {
    marginTop: Spacing[4],
    borderRadius: Radius.md,
    paddingVertical: Spacing[3.5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontSize: FontSize.sm, color: '#fff' },
});
