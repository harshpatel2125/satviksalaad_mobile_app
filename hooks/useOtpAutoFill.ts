import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Android SMS Retriever API — starts listening for an OTP SMS and calls
 * `onCode` with the extracted 4-digit code, then stops listening.
 *
 * On iOS, textContentType="oneTimeCode" on each TextInput handles SMS/WhatsApp
 * autofill via the keyboard toolbar — no extra code needed there.
 *
 * Pass `active = false` to suspend the listener (e.g. while a sheet is hidden).
 *
 * SMS template must end with the 11-char app hash, e.g.:
 *   <#> Your Satvik Salaad OTP is 1234. Valid 10 min.
 *   FA+aBcDeFgHi
 *
 * Run the app in __DEV__ mode on Android to see the hash logged to console.
 */
export function useOtpAutoFill(onCode: (code: string) => void, active = true) {
  const callbackRef = useRef(onCode);
  callbackRef.current = onCode;

  // Log app hash once on dev-mode Android builds
  useEffect(() => {
    if (Platform.OS !== 'android' || !__DEV__) return;
    void import('react-native-otp-verify')
      .then(({ default: OtpVerify }) => OtpVerify.getHash())
      .then((hashes) => console.log('[SatvikSalaad] SMS hash for template:', hashes))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return;

    let cancelled = false;

    void (async () => {
      try {
        const OtpVerify = (await import('react-native-otp-verify')).default;
        if (cancelled) return;

        await OtpVerify.getOtp();

        OtpVerify.addListener((message: string) => {
          // Match exactly 4 digits not surrounded by other digits
          const match = /(?<!\d)(\d{4})(?!\d)/.exec(message);
          if (match) {
            callbackRef.current(match[1]);
            OtpVerify.removeListener();
          }
        });
      } catch {
        // SMS Retriever unavailable (emulator, older device) — silent fail
      }
    })();

    return () => {
      cancelled = true;
      void import('react-native-otp-verify')
        .then(({ default: OtpVerify }) => OtpVerify.removeListener())
        .catch(() => {});
    };
  }, [active]);
}
