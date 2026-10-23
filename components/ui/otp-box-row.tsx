import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useOtpAutoFill } from '@/hooks/useOtpAutoFill';
import { Brand, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

export interface OtpBoxRowHandle {
  reset: () => void;
  focusFirst: () => void;
  getCode: () => string;
}

interface OtpBoxRowProps {
  length?: number;
  backgroundColor: string;
  error: string | null;
  onComplete: (code: string) => void;
  onChange?: (code: string, filledCount: number) => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const OtpBoxRow = forwardRef<OtpBoxRowHandle, OtpBoxRowProps>(
  function OtpBoxRow(
    { length = 4, backgroundColor, error, onComplete, onChange, active = true, style },
    ref,
  ) {
    const { colors, fonts } = useTheme();
    const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
    const [focusedIdx, setFocusedIdx] = useState(-1);

    // Always-current ref — eliminates stale-closure bug on fast typing
    const digitsRef = useRef<string[]>(Array(length).fill(''));
    const inputRefs = useRef<(TextInput | null)[]>([]);

    // Keep callback refs fresh so handlers always call the latest parent callbacks
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const completedRef = useRef(false);
    // Android soft keyboards (e.g. MIUI) don't fire onKeyPress for backspace.
    // ZWS sentinel in empty boxes triggers onChangeText('') on backspace instead.
    // This flag prevents double-handling when onKeyPress also fires (hardware kbd).
    const backspaceHandledRef = useRef(false);

    useImperativeHandle(ref, () => ({
      reset() {
        completedRef.current = false;
        const empty = Array(length).fill('') as string[];
        digitsRef.current = empty;
        setDigits(empty);
        setFocusedIdx(-1);
        onChangeRef.current?.('', 0);
      },
      focusFirst() {
        inputRefs.current[0]?.focus();
      },
      getCode() {
        return digitsRef.current.join('');
      },
    }));

    function fireComplete(next: string[]) {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current(next.join(''));
      }
    }

    // Android SMS Retriever autofill
    useOtpAutoFill((code) => {
      const next = Array(length).fill('') as string[];
      for (let i = 0; i < length; i++) next[i] = code[i] ?? '';
      digitsRef.current = next;
      setDigits(next);
      const filled = next.filter(Boolean).length;
      onChangeRef.current?.(next.join(''), filled);
      const lastFilled = Math.min(code.length - 1, length - 1);
      inputRefs.current[lastFilled]?.focus();
      setFocusedIdx(lastFilled);
      if (filled === length) fireComplete(next);
    }, active);

    function handleDigitChange(value: string, idx: number) {
      // Strip ZWS sentinel (Android empty-box placeholder) before processing
      const cleaned = value.replace(/​/g, '').replace(/\D/g, '');

      // iOS oneTimeCode autofill delivers all N digits at once to the focused box.
      // Only treat as full-OTP autofill when exactly N (or more) digits arrive —
      // NOT for the "existing digit + new typed" case (e.g. box had "4", user typed
      // "5" → cleaned="45"), which is 2 chars and must NOT redistribute from box 0.
      if (cleaned.length >= length) {
        const next = Array(length).fill('') as string[];
        for (let i = 0; i < length; i++) next[i] = cleaned[i] ?? '';
        digitsRef.current = next;
        setDigits(next);
        const filled = next.filter(Boolean).length;
        onChangeRef.current?.(next.join(''), filled);
        inputRefs.current[length - 1]?.focus();
        setFocusedIdx(length - 1);
        if (filled === length) fireComplete(next);
        return;
      }

      const digit = cleaned.slice(-1);

      // Empty-box backspace: Android soft keyboards (e.g. MIUI) never fire
      // onKeyPress for backspace. The ZWS sentinel in empty boxes means backspace
      // triggers onChangeText('') instead. If onKeyPress already handled it
      // (hardware keyboard), skip to prevent double navigation.
      if (!digit && !digitsRef.current[idx]) {
        if (backspaceHandledRef.current) {
          backspaceHandledRef.current = false;
          return;
        }
        completedRef.current = false;
        if (idx > 0) {
          const next = [...digitsRef.current];
          next[idx - 1] = '';
          digitsRef.current = next;
          setDigits(next);
          onChangeRef.current?.(next.join(''), next.filter(Boolean).length);
          inputRefs.current[idx - 1]?.focus();
          setFocusedIdx(idx - 1);
        }
        return;
      }

      // Single digit — or "existing digit + new typed" (cleaned.length 2–3).
      // Take only the last character so the newly typed digit wins.
      const next = [...digitsRef.current];
      next[idx] = digit;
      digitsRef.current = next;
      setDigits(next);
      const filled = next.filter(Boolean).length;
      onChangeRef.current?.(next.join(''), filled);

      if (digit) {
        if (idx < length - 1) {
          inputRefs.current[idx + 1]?.focus();
          setFocusedIdx(idx + 1);
        }
        if (filled === length) fireComplete(next);
      } else {
        completedRef.current = false;
        if (idx > 0) {
          inputRefs.current[idx - 1]?.focus();
          setFocusedIdx(idx - 1);
        }
      }
    }

    function handleKeyPress(key: string, idx: number) {
      // Empty-box backspace nav (iOS reliable; Android hardware keyboard only).
      // Sets flag so handleDigitChange skips duplicate handling via ZWS sentinel.
      if (key === 'Backspace' && !digitsRef.current[idx] && idx > 0) {
        backspaceHandledRef.current = true;
        completedRef.current = false;
        const next = [...digitsRef.current];
        next[idx - 1] = '';
        digitsRef.current = next;
        setDigits(next);
        onChangeRef.current?.(next.join(''), next.filter(Boolean).length);
        inputRefs.current[idx - 1]?.focus();
        setFocusedIdx(idx - 1);
      }
    }

    return (
      <View style={[styles.row, style]}>
        {digits.map((d, idx) => (
          <TextInput
            key={idx}
            ref={(r) => { inputRefs.current[idx] = r; }}
            style={[
              styles.box,
              {
                backgroundColor,
                borderColor: error
                  ? colors.error
                  : focusedIdx === idx
                  ? colors.primary
                  : d
                  ? colors.border
                  : colors.borderLight,
                color: colors.text,
                fontFamily: fonts.display,
              },
              focusedIdx === idx && styles.boxFocused,
            ]}
            value={Platform.OS === 'android' && !d ? '​' : d}
            onChangeText={(v) => handleDigitChange(v, idx)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
            autoFocus={idx === 0}
            onFocus={() => setFocusedIdx(idx)}
            keyboardType="number-pad"
            maxLength={Platform.OS === 'android' ? length + 1 : length}
            textContentType="oneTimeCode"
            caretHidden
          />
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[5],
  },
  box: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },
  boxFocused: {
    shadowColor: Brand.forest,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 0,
  },
});
