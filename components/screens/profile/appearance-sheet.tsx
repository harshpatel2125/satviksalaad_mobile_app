import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { SHEET_WIDTH, column } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/context/theme-preference';

const OPTIONS: { value: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; sub: string }[] = [
  { value: 'system', label: 'System Default', icon: 'phone-portrait-outline', sub: 'Follows your device setting' },
  { value: 'light',  label: 'Light',          icon: 'sunny-outline',           sub: 'Always use light mode'      },
  { value: 'dark',   label: 'Dark',           icon: 'moon-outline',            sub: 'Always use dark mode'       },
];

interface AppearanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AppearanceSheet({ visible, onClose }: AppearanceSheetProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const { themePreference, setThemePreference } = useThemePreference();

  function handleSelect(value: ThemePreference) {
    setThemePreference(value);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <View style={s.centeredWrap} pointerEvents="box-none">
        <View style={[s.dialog, column(SHEET_WIDTH), { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 24) + Spacing[3] }]}>
          <View style={[s.grabber, { backgroundColor: colors.border }]} />
          {/* Title */}
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>
            Theme
          </Text>

          {/* Options */}
          <View style={s.options}>
            {OPTIONS.map((opt) => {
              const isActive = themePreference === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    s.option,
                    {
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.primaryBg : colors.background,
                    },
                  ]}
                  onPress={() => handleSelect(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={[s.iconWrap, { backgroundColor: isActive ? colors.primary : colors.surface2 }]}>
                    <Ionicons name={opt.icon} size={18} color={isActive ? '#fff' : colors.textMuted} />
                  </View>
                  <View style={s.optionText}>
                    <Text style={[s.optionLabel, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
                      {opt.label}
                    </Text>
                    <Text style={[s.optionSub, { color: colors.textMuted, fontFamily: fonts.body }]}>
                      {opt.sub}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </View>
      </View>
      </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  centeredWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },

  dialog: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing[5],
    gap: Spacing[3],
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: Spacing[2.5], marginBottom: Spacing[1] },

  title: {
    fontSize: FontSize.lg,
    letterSpacing: -0.3,
    marginBottom: Spacing[1],
  },

  options: { gap: Spacing[2] },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  optionText:  { flex: 1 },
  optionLabel: { fontSize: FontSize.sm },
  optionSub:   { fontSize: FontSize.xs, marginTop: 1 },

  cancelBtn: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[1],
  },
  cancelText: { fontSize: FontSize.sm },
});
