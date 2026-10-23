import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WHAT_GETS_DELETED = [
  'Profile & personal details',
  'All saved addresses',
  'Delivery history & logs',
  'Active plans & wallet balance',
  'Dietary preferences',
];

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({ visible, onClose, onConfirm }: DeleteAccountModalProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={loading ? undefined : onClose}>
      <TouchableWithoutFeedback onPress={loading ? undefined : onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <View style={s.centeredWrap} pointerEvents="box-none">
        <View style={[s.dialog, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 24) + Spacing[3] }]}>
          <View style={[s.grabber, { backgroundColor: colors.border }]} />
          {/* Icon + title */}
          <View style={[s.iconWrap, { backgroundColor: colors.errorBg }]}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </View>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>
            Delete account?
          </Text>
          <Text style={[s.subtitle, { color: colors.textMuted, fontFamily: fonts.body }]}>
            This is immediate and cannot be undone. Your account will be deleted now:
          </Text>

          {/* What gets deleted */}
          <View style={s.list}>
            {WHAT_GETS_DELETED.map((item) => (
              <View key={item} style={s.listRow}>
                <Ionicons name="close-circle" size={14} color={colors.error} style={s.listIcon} />
                <Text style={[s.listText, { color: colors.textSecondary ?? colors.text, fontFamily: fonts.body }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          {/* Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.btn, s.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[s.btnText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, s.deleteBtn, { backgroundColor: colors.error, opacity: loading ? 0.7 : 1 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[s.btnText, { color: '#fff', fontFamily: fonts.bodySemibold }]}>Delete my account</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
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

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  list: { gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listIcon: { flexShrink: 0 },
  listText: { fontSize: FontSize.sm, flex: 1 },

  btnRow: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[1] },
  btn: { flex: 1, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { borderWidth: 1 },
  deleteBtn: {},
  btnText: { fontSize: FontSize.sm },
});
