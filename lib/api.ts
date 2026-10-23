import type {
  AddressPayload,
  AddressResponse,
  AddressesResponse,
  CreateOrderPayload,
  CreateOrderResponse,
  CreateRazorpayOrderResponse,
  DietaryOptionsResponse,
  DeliveriesActionResponse,
  DeliveriesInitResponse,
  DeliveryHistoryResponse,
  DeliveryLogsResponse,
  DeliverySchedule,
  AppSettingsResponse,
  HomeCriticalResponse,
  HomeStaticResponse,
  InvoicesResponse,
  InvoiceDetailResponse,
  MenuResponse,
  NotificationsResponse,
  OtpSendResponse,
  OtpVerifyResponse,
  MobileSignInResponse,
  PassesResponse,
  PassPurchase,
  PlansResponse,
  SlotsResponse,
  PreferredDaysResponse,
  ProfileResponse,
  VerifyPaymentPayload,
  VerifyPaymentResponse,
  VideosResponse,
} from '@/types/api';
import type { PartnerDeliveriesResponse } from '@/types/delivery-partner';

import { reportNetworkError } from '@/context/network';

import { BASE_URL } from './base-url';
import { clearSession, getAccessToken } from './auth-session';

export { BASE_URL };

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function authHeader(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const auth = await authHeader();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      // The bearer token is the app's only credential. Native networking would
      // otherwise keep the session cookie the backend also sets, and that cookie
      // outlives sign-out: the backend would still see the old account.
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...auth,
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } catch (err) {
    reportNetworkError(err);
    throw err;
  }

  // Only the profile endpoint's 401 means the token is dead. Role-gated
  // endpoints also answer 401 on a role mismatch, which must not sign the
  // user out.
  if (res.status === 401) {
    if (path === '/api/v1/user/profile' && (await getAccessToken())) {
      void clearSession();
    }
    throw new Error('Session expired. Please sign in again.');
  }

  if (res.status >= 500) {
    const serverErr = new Error(`Server error ${res.status} on ${path}`);
    reportNetworkError(serverErr);
    throw serverErr;
  }

  let json: T;
  try {
    json = (await res.json()) as T;
  } catch {
    throw new Error(`Non-JSON response from ${path} (${res.status})`);
  }

  // The auth endpoints answer errors with a non-2xx status and a `message`.
  const asAny = (json ?? {}) as Record<string, unknown>;
  if (asAny.success === false || (!res.ok && asAny.success !== true)) {
    throw new Error(String(asAny.error ?? asAny.message ?? 'Request failed'));
  }

  return json;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  sendOtp: (phone: string, channel: 'whatsapp' | 'sms' = 'whatsapp') =>
    apiFetch<OtpSendResponse>('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, channel }),
    }),

  verifyOtp: (sessionId: string, otp: string) =>
    apiFetch<OtpVerifyResponse>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ sessionId, otp }),
    }),

  /** `nonce` is the raw nonce whose SHA-256 was given to Apple. */
  signInWithApple: (idToken: string, nonce: string, fullName?: string) =>
    apiFetch<MobileSignInResponse>('/api/auth/mobile/apple', {
      method: 'POST',
      body: JSON.stringify({ idToken, nonce, fullName }),
    }),

  googleSignInUrl: (redirect: string) =>
    `${BASE_URL}/api/auth/mobile/google?redirect=${encodeURIComponent(redirect)}`,
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () => apiFetch<ProfileResponse>('/api/v1/user/profile'),

  update: (data: { full_name?: string; phone?: string; email?: string; expo_push_token?: string | null; app_platform?: string }) =>
    apiFetch<{ success: boolean }>('/api/v1/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ─── Account ──────────────────────────────────────────────────────────────────

export const accountApi = {
  requestDeletion: (reason?: string) =>
    apiFetch<{ success: boolean; alreadyRequested?: boolean }>('/api/v1/user/delete-request', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getExportDownloadUrl: () => `${BASE_URL}/api/v1/user/data-export`,

  getAuthHeader: () => authHeader(),
};

// ─── Addresses ────────────────────────────────────────────────────────────────

/** Orders refuse a shorter full_address, even though saving one succeeds. */
export const MIN_FULL_ADDRESS = 10;

export const addressesApi = {
  list: () => apiFetch<AddressesResponse>('/api/v1/user/addresses'),

  create: (payload: AddressPayload) =>
    apiFetch<AddressResponse>('/api/v1/user/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: Partial<AddressPayload>) =>
    apiFetch<AddressResponse>(`/api/v1/user/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/v1/user/addresses/${id}`, {
      method: 'DELETE',
    }),

  setDefault: (id: string) =>
    apiFetch<AddressResponse>(`/api/v1/user/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_default: true }),
    }),
};

// ─── Passes ───────────────────────────────────────────────────────────────────

export const passesApi = {
  list: () => apiFetch<PassesResponse>('/api/v1/user/passes'),

  updatePreferredDays: (id: string, preferred_days: string[]) =>
    apiFetch<PreferredDaysResponse>(`/api/v1/passes/${id}/preferred-days`, {
      method: 'PUT',
      body: JSON.stringify({ preferred_days }),
    }),

  heal: () =>
    apiFetch<{ success: boolean; generated: number }>('/api/v1/passes/heal', { method: 'POST' }),

  changeSlot: (id: string, slot: string) =>
    apiFetch<{ success: boolean; slot: string; updatedLogs: number; applyFrom: string }>(`/api/v1/passes/${id}/change-slot`, {
      method: 'POST',
      body: JSON.stringify({ slot }),
    }),
};

// ─── Plans ────────────────────────────────────────────────────────────────────

export const plansApi = {
  list: () => apiFetch<PlansResponse>('/api/v1/plans'),
};

// ─── Slots ────────────────────────────────────────────────────────────────────

export const slotsApi = {
  list: () => apiFetch<SlotsResponse>('/api/v1/slots'),
};

// ─── Dietary options ──────────────────────────────────────────────────────────

export const dietaryOptionsApi = {
  list: () => apiFetch<DietaryOptionsResponse>('/api/v1/dietary-options'),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersApi = {
  create: (payload: CreateOrderPayload) =>
    apiFetch<CreateOrderResponse>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export const paymentsApi = {
  createRazorpayOrder: (orderId: string, couponCode?: string) =>
    apiFetch<CreateRazorpayOrderResponse>('/api/v1/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ orderId, ...(couponCode ? { couponCode } : {}) }),
    }),

  verify: (payload: VerifyPaymentPayload) =>
    apiFetch<VerifyPaymentResponse>('/api/v1/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelOrder: (orderId: string) =>
    apiFetch<{ success: boolean }>('/api/v1/payments/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),
};

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoicesApi = {
  list:   () => apiFetch<InvoicesResponse>('/api/v1/invoices'),
  detail: (id: string) => apiFetch<InvoiceDetailResponse>(`/api/v1/invoices/${id}`),
};

// ─── Menu (meals + settings combined) ─────────────────────────────────────────

export const menuApi = {
  get: () => apiFetch<MenuResponse>('/api/v1/menu'),
};

// ─── Videos ───────────────────────────────────────────────────────────────────

export const videosApi = {
  list: () => apiFetch<VideosResponse>('/api/v1/videos'),
};

// ─── Delivery areas ───────────────────────────────────────────────────────────

export const zonesApi = {
  list: () => apiFetch<{ success: boolean; data: { name: string; region: string }[] }>('/api/v1/zones'),
};

// ─── Delivery History ─────────────────────────────────────────────────────────

export const deliveryHistoryApi = {
  list: () => apiFetch<DeliveryHistoryResponse>('/api/v1/deliveries/history'),
};

// ─── Delivery Schedules ───────────────────────────────────────────────────────

export const schedulesApi = {
  update: (
    id: string,
    payload: Partial<{
      label: string;
      preferred_days: string[];
      delivery_slot: string;
      delivery_address_id: string | null;
    }>,
  ) =>
    apiFetch<{ success: boolean; data: DeliverySchedule; logs_regenerated?: number }>(
      `/api/v1/schedules/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    ),
};

// ─── Delivery Logs ────────────────────────────────────────────────────────────

export const deliveryLogsApi = {
  list: () => apiFetch<DeliveryLogsResponse>('/api/v1/deliveries/logs'),
};

// ─── Wallet (combined passes + delivery logs) ─────────────────────────────────

export type WalletInitData = {
  balance: { total_purchased: number; total_used: number } | null;
  purchases: PassPurchase[];
  stats: { delivered: number; upcoming: number; skipped: number };
};

export const walletApi = {
  init: async (): Promise<WalletInitData> => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [passesRes, logsRes] = await Promise.all([
      passesApi.list(),
      deliveryLogsApi.list(),
    ]);
    const logs = logsRes.data;
    return {
      balance: {
        total_purchased: passesRes.meta.balance.total_purchased,
        total_used:      passesRes.meta.balance.total_used,
      },
      purchases: passesRes.data,
      stats: {
        delivered: logs.filter(l => l.status === 'delivered').length,
        upcoming:  logs.filter(l => l.delivery_date >= today && (l.status === 'scheduled' || l.status === 'out_for_delivery')).length,
        skipped:   logs.filter(l => l.status === 'skipped').length,
      },
    };
  },
};

// ─── Deliveries ───────────────────────────────────────────────────────────────

export const deliveriesApi = {
  init: () => apiFetch<DeliveriesInitResponse>('/api/v1/deliveries/init'),

  action: (params: {
    action: 'skip' | 'unskip' | 'update' | 'increase_swap' | 'decrease_expand';
    passId?: string;
    date?: string;
    deliveryDate?: string;
    deliverySlot?: string;
    quantity?: number;
  }) => apiFetch<DeliveriesActionResponse>('/api/v1/deliveries/action', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  scheduleExtra: (date: string) =>
    apiFetch<{ success: boolean; log: { id: string; delivery_date: string; delivery_slot: string; status: string; quantity: number }; swappedFrom: string }>(
      '/api/v1/deliveries/schedule-extra',
      { method: 'POST', body: JSON.stringify({ date }) },
    ),
};

// ─── Delivery Partner ─────────────────────────────────────────────────────────

export const deliveryPartnerApi = {
  list: (params: { date?: string; scope?: 'mine' | 'all' }) => {
    const qs = new URLSearchParams();
    if (params.date) qs.set('date', params.date);
    if (params.scope) qs.set('scope', params.scope);
    const queryString = qs.toString();
    return apiFetch<PartnerDeliveriesResponse>(`/api/v1/delivery-partner/deliveries${queryString ? `?${queryString}` : ''}`);
  },

  zones: () => apiFetch<{ success: boolean; data: string[] }>('/api/v1/delivery-partner/zones'),

  updateStatus: (id: string, body: { status: 'out_for_delivery' | 'delivered'; remark?: string }) =>
    apiFetch<{ success: boolean }>(`/api/v1/delivery-partner/deliveries/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reorder: (orderedIds: string[]) =>
    apiFetch<{ success: boolean }>('/api/v1/delivery-partner/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    }),
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export const homeApi = {
  // Per-user critical data: balance, purchase, schedules, logs.
  critical: () => apiFetch<HomeCriticalResponse>('/api/v1/home/init'),

  // Same for every user: meals and slots. No auth required.
  static: async (): Promise<HomeStaticResponse> => {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/v1/home/static`, {
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      reportNetworkError(err);
      throw err;
    }
    if (res.status >= 500) {
      const serverErr = new Error(`Server error ${res.status} on /api/v1/home/static`);
      reportNetworkError(serverErr);
      throw serverErr;
    }
    const json = (await res.json()) as HomeStaticResponse;
    const asAny = json as unknown as Record<string, unknown>;
    if (!asAny.success) {
      throw new Error(String(asAny.error ?? 'Request failed'));
    }
    return json;
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list:        () => apiFetch<NotificationsResponse>('/api/v1/notifications'),
  markRead:    (id: string) => apiFetch<{ success: boolean }>(`/api/v1/notifications/${id}`, { method: 'PATCH' }),
  markAllRead: () => apiFetch<{ success: boolean }>('/api/v1/notifications', { method: 'PATCH' }),
};

// ─── Notification Preferences ─────────────────────────────────────────────────

export type NotifPrefs = {
  notif_push:     boolean;
  notif_email:    boolean;
  notif_sms:      boolean;
  notif_whatsapp: boolean;
};

export const notificationPreferencesApi = {
  get:    () => apiFetch<{ success: boolean; preferences: NotifPrefs }>('/api/v1/user/notification-preferences'),
  update: (prefs: Partial<NotifPrefs>) =>
    apiFetch<{ success: boolean; preferences: NotifPrefs }>('/api/v1/user/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),
};

// ─── App Settings (URLs, store links, support contact) ─────────────────────────

export const appSettingsApi = {
  get: () => apiFetch<AppSettingsResponse>('/api/v1/app-settings'),
};

