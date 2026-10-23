import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertContextValue {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const SHEET_OFFSCREEN = 600;

// ─── Context ──────────────────────────────────────────────────────────────────

const AlertContext = createContext<AlertContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const { colors, fonts } = useTheme();
  // Floored because a modal can be laid out before the inset is known.
  const bottomPad = Math.max(useSafeAreaInsets().bottom, 24) + Spacing[3];

  // A transform rather than an entering animation: the modal window grows once
  // the navigation bar turns translucent, and a transform follows that re-layout
  // where an entering animation stays pinned to the first frame.
  const sheetY = useSharedValue(SHEET_OFFSCREEN);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  useEffect(() => {
    if (!alertState) return;
    sheetY.value = SHEET_OFFSCREEN;
    sheetY.value = withSpring(0, { damping: 22, stiffness: 240 });
  }, [alertState, sheetY]);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      setAlertState({
        title,
        message,
        buttons: buttons?.length ? buttons : [{ text: 'OK', style: 'default' }],
      });
    },
    [],
  );

  function dismiss() {
    setAlertState(null);
  }

  const buttons = alertState?.buttons ?? [];
  // Actions first as full-width pills; a cancel button becomes the quiet text link under them.
  const actions = buttons.filter((b) => b.style !== 'cancel');
  const cancel = buttons.find((b) => b.style === 'cancel');

  function press(btn: AlertButton) {
    dismiss();
    void btn.onPress?.();
  }

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        visible={alertState !== null}
        transparent
        animationType="none"
        onRequestClose={dismiss}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        {alertState && (
          <View style={styles.overlay} pointerEvents="box-none">
            <Animated.View
              style={[styles.sheet, sheetStyle, { backgroundColor: colors.surface }]}
            >
              <View style={[styles.sheetBody, { paddingBottom: bottomPad }]}>
                <View style={[styles.grabber, { backgroundColor: colors.border }]} />

                <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>
                  {alertState.title}
                </Text>
                {alertState.message ? (
                  <Text style={[styles.message, { color: colors.textMuted, fontFamily: fonts.body }]}>
                    {alertState.message}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  {actions.map((btn, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.btn,
                        { backgroundColor: btn.style === 'destructive' ? colors.error : colors.primary },
                      ]}
                      onPress={() => press(btn)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.btnText, { color: colors.textOnPrimary, fontFamily: fonts.bodySemibold }]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {cancel ? (
                    <TouchableOpacity style={styles.cancel} onPress={() => press(cancel)} activeOpacity={0.6}>
                      <Text style={[styles.btnText, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
                        {cancel.text}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          </View>
        )}
      </Modal>
    </AlertContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within <AlertProvider>');
  return ctx;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing[5],
  },
  sheetBody: {
    gap: Spacing[2],
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing[2.5],
    marginBottom: Spacing[3],
  },
  title: {
    fontSize: FontSize.xl,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.55,
  },
  actions: {
    gap: Spacing[1],
    marginTop: Spacing[4],
  },
  btn: {
    height: 50,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
  },
  cancel: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: FontSize.base,
  },
});
