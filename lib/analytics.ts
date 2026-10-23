import type { Analytics } from '@react-native-firebase/analytics';
import type { Crashlytics } from '@react-native-firebase/crashlytics';

// Firebase native modules are absent in Expo Go and in builds without the
// Firebase config files, so every call degrades to a no-op instead of crashing.

interface AnalyticsModular {
  getAnalytics(): Analytics;
  logEvent(a: Analytics, name: string, params?: Record<string, unknown>): Promise<void>;
  setUserId(a: Analytics, id: string | null): Promise<void>;
  setUserProperties(a: Analytics, props: Record<string, string | null>): Promise<void>;
}

interface CrashlyticsModular {
  getCrashlytics(): Crashlytics;
  setUserId(c: Crashlytics, userId: string): Promise<null>;
  log(c: Crashlytics, message: string): Promise<null>;
}

let am: AnalyticsModular | null = null;
let fa: Analytics | null = null;

let cm: CrashlyticsModular | null = null;
let fc: Crashlytics | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  am = require('@react-native-firebase/analytics') as AnalyticsModular;
  fa = am.getAnalytics();
} catch {}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cm = require('@react-native-firebase/crashlytics') as CrashlyticsModular;
  fc = cm.getCrashlytics();
} catch {}

// ─── Identity ─────────────────────────────────────────────────────────────────

export const identifyUser = (id: string, hasPhone: boolean): void => {
  if (am && fa) void am.setUserId(fa, id);
  if (cm && fc) void cm.setUserId(fc, id);
  if (am && fa && hasPhone) void am.setUserProperties(fa, { has_phone: 'true' });
};

export const clearUser = (): void => {
  if (am && fa) void am.setUserId(fa, null);
  if (cm && fc) void cm.setUserId(fc, '');
};

// ─── Screen view ──────────────────────────────────────────────────────────────

export const trackScreenView = (screenName: string): void => {
  if (am && fa) void am.logEvent(fa, 'screen_view', { screen_name: screenName, screen_class: screenName });
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const trackLogin = (method: 'phone' | 'google' | 'apple'): void => {
  if (am && fa) void am.logEvent(fa, 'login', { method });
};

export const trackSignUp = (method: 'phone' | 'google' | 'apple'): void => {
  if (am && fa) void am.logEvent(fa, 'sign_up', { method });
};

export const trackLogout = (): void => {
  if (am && fa) void am.logEvent(fa, 'logout');
};

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const trackOnboardingCompleted = (): void => {
  if (am && fa) void am.logEvent(fa, 'onboarding_completed');
};

// ─── Critical screen opens ────────────────────────────────────────────────────

type CriticalScreen =
  | 'buy_passes'
  | 'support'
  | 'delivery_history'
  | 'wallet';

export const trackScreenOpened = (screen: CriticalScreen): void => {
  if (am && fa) void am.logEvent(fa, `screen_opened_${screen}`);
};

// ─── Purchase funnel ──────────────────────────────────────────────────────────

export const trackPlanSelected = (planId: string): void => {
  if (am && fa) void am.logEvent(fa, 'plan_selected', { plan_id: planId });
};

export const trackCheckoutStarted = (planId: string, mealCount: number, value: number): void => {
  if (am && fa) void am.logEvent(fa, 'checkout_started', { plan_id: planId, meal_count: mealCount, value });
};

export const trackCouponApplied = (code: string, discount: number): void => {
  if (am && fa) void am.logEvent(fa, 'coupon_applied', { coupon_code: code, discount_amount: discount });
};

export const trackCouponRemoved = (code: string): void => {
  if (am && fa) void am.logEvent(fa, 'coupon_removed', { coupon_code: code });
};

export const trackPaymentInitiated = (planId: string, value: number): void => {
  if (cm && fc) void cm.log(fc, `payment_initiated plan=${planId} value=${value}`);
  if (am && fa) void am.logEvent(fa, 'payment_initiated', { plan_id: planId, value });
};

export const trackPaymentCancelled = (planId: string, value: number): void => {
  if (cm && fc) void cm.log(fc, `payment_cancelled plan=${planId} value=${value}`);
  if (am && fa) void am.logEvent(fa, 'payment_cancelled', { plan_id: planId, value });
};

export const trackPaymentFailed = (planId: string, value: number, reason: string): void => {
  if (cm && fc) void cm.log(fc, `payment_failed plan=${planId} value=${value} reason=${reason}`);
  if (am && fa) void am.logEvent(fa, 'payment_failed', { plan_id: planId, value, reason });
};

export const trackPurchase = (
  orderId: string,
  value: number,
  items: Record<string, unknown>[],
): void => {
  if (am && fa) void am.logEvent(fa, 'purchase', { currency: 'INR', value, transaction_id: orderId, items });
};

// ─── Delivery ─────────────────────────────────────────────────────────────────

export const trackDeliverySkipped = (deliveryId: string, reason: string): void => {
  if (cm && fc) void cm.log(fc, `delivery_skipped id=${deliveryId} reason=${reason}`);
  if (am && fa) void am.logEvent(fa, 'delivery_skipped', { delivery_id: deliveryId, reason });
};

export const trackPreferredDaysUpdated = (days: string[]): void => {
  if (am && fa) void am.logEvent(fa, 'preferred_days_updated', { days: days.join(',') });
};

export const trackDeliverySlotUpdated = (slot: string): void => {
  if (am && fa) void am.logEvent(fa, 'delivery_slot_updated', { slot });
};

// ─── Engagement ───────────────────────────────────────────────────────────────

export const trackAddressAdded = (): void => {
  if (am && fa) void am.logEvent(fa, 'address_added');
};

export const trackAddressDeleted = (): void => {
  if (am && fa) void am.logEvent(fa, 'address_deleted');
};

export const trackInvoiceDownloaded = (invoiceId: string): void => {
  if (am && fa) void am.logEvent(fa, 'invoice_downloaded', { invoice_id: invoiceId });
};

export const trackNotificationToggled = (enabled: boolean): void => {
  if (am && fa) void am.logEvent(fa, 'notification_setting_toggled', { enabled: enabled ? 'true' : 'false' });
};
