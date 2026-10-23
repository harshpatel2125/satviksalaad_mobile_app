import type {
  DeliveryAddress,
  DeliveryHistoryLog,
  DeliveryLog,
  DeliverySchedule,
  DietaryOption,
  InitMeal,
  Invoice,
  InvoiceDetailResponse,
  MenuMeal,
  NutritionFlags,
  PassPurchase,
  Plan,
  Profile,
  TimeSlot,
} from "@/types/api";
import { storage } from "./storage";

const KEY_PREFIX = "ss-home-";
const NAME_KEY_PREFIX = "ss-name-";

export function readCachedName(userId: string): string | null {
  try {
    return storage.getString(NAME_KEY_PREFIX + userId) ?? null;
  } catch {
    return null;
  }
}

export function writeCachedName(userId: string, name: string): void {
  try {
    storage.set(NAME_KEY_PREFIX + userId, name);
  } catch {}
}

export interface CachedDeliveryLog {
  id: string;
  deliveryDate: string; // "YYYY-MM-DD"
  deliverySlot: string; // "noon" | "evening"
  status: string; // "scheduled" | "out_for_delivery" | "delivered" | "missed" | "skipped"
  quantity: number; // meals this delivery uses up
  mealId: string | null;
  deliveredAt: string | null;
}

export interface CachedSlot {
  id: string; // "noon" | "evening"
  label: string;
  startMinutes: number; // minutes after midnight IST
  endMinutes: number;
}

export interface HomeCacheData {
  userId: string;
  cachedAt: string; // ISO timestamp
  purchaseId: string | null; // null = no active plan
  planName: string | null;
  logs: CachedDeliveryLog[]; // 37-day window (7 past + 30 future)
  schedule: {
    preferredDays: string[]; // ["Monday","Tuesday",...]
    deliverySlot: string;
  } | null;
  balance: {
    totalPurchased: number;
    totalUsed: number;
  } | null;
  slots: CachedSlot[];
}

export function readHomeCache(userId: string): HomeCacheData | null {
  try {
    const raw = storage.getString(KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as HomeCacheData;
  } catch {
    return null;
  }
}

export function writeHomeCache(userId: string, data: HomeCacheData): void {
  try {
    storage.set(KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Menu cache ───────────────────────────────────────────────────────────────
// Global key — menu data is not user-specific.

const MENU_KEY = "ss-menu-v1";

export interface CachedMenuData {
  meals: MenuMeal[];
  showFruits: boolean;
  nutritionFlags: NutritionFlags;
}

export function readMenuCache(): CachedMenuData | null {
  try {
    const raw = storage.getString(MENU_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedMenuData;
  } catch {
    return null;
  }
}

export function writeMenuCache(data: CachedMenuData): void {
  try {
    storage.set(MENU_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Wallet cache ─────────────────────────────────────────────────────────────

const WALLET_KEY_PREFIX = "ss-wallet-";

export interface CachedWalletData {
  balance: { totalPurchased: number; totalUsed: number } | null;
  purchases: PassPurchase[];
  stats: { delivered: number; upcoming: number; skipped: number };
}

export function readWalletCache(userId: string): CachedWalletData | null {
  try {
    const raw = storage.getString(WALLET_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedWalletData;
  } catch {
    return null;
  }
}

export function writeWalletCache(userId: string, data: CachedWalletData): void {
  try {
    storage.set(WALLET_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Addresses cache ──────────────────────────────────────────────────────────

const ADDRESSES_KEY_PREFIX = "ss-addr-";

export function readAddressesCache(userId: string): DeliveryAddress[] | null {
  try {
    const raw = storage.getString(ADDRESSES_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as DeliveryAddress[];
  } catch {
    return null;
  }
}

export function writeAddressesCache(
  userId: string,
  data: DeliveryAddress[],
): void {
  try {
    storage.set(ADDRESSES_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Invoices cache ───────────────────────────────────────────────────────────

const INVOICES_KEY_PREFIX = "ss-inv-";

export function readInvoicesCache(userId: string): Invoice[] | null {
  try {
    const raw = storage.getString(INVOICES_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as Invoice[];
  } catch {
    return null;
  }
}

export function writeInvoicesCache(userId: string, data: Invoice[]): void {
  try {
    storage.set(INVOICES_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Delivery History cache ───────────────────────────────────────────────────

const HISTORY_KEY_PREFIX = "ss-history-";

export interface CachedDeliveryHistoryData {
  logs: DeliveryHistoryLog[];
}

export function readDeliveryHistoryCache(
  userId: string,
): CachedDeliveryHistoryData | null {
  try {
    const raw = storage.getString(HISTORY_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedDeliveryHistoryData;
  } catch {
    return null;
  }
}

export function writeDeliveryHistoryCache(
  userId: string,
  data: CachedDeliveryHistoryData,
): void {
  try {
    storage.set(HISTORY_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Invoice Detail cache ─────────────────────────────────────────────────────

const INVOICE_DETAIL_KEY_PREFIX = "ss-inv-detail-";

export function readInvoiceDetailCache(
  invoiceId: string,
): InvoiceDetailResponse["data"] | null {
  try {
    const raw = storage.getString(INVOICE_DETAIL_KEY_PREFIX + invoiceId);
    if (!raw) return null;
    return JSON.parse(raw) as InvoiceDetailResponse["data"];
  } catch {
    return null;
  }
}

export function writeInvoiceDetailCache(
  invoiceId: string,
  data: InvoiceDetailResponse["data"],
): void {
  try {
    storage.set(INVOICE_DETAIL_KEY_PREFIX + invoiceId, JSON.stringify(data));
  } catch {}
}

// ─── Plans cache ─────────────────────────────────────────────────────────────
// Global key — plan catalogue is not user-specific.

const PLANS_KEY = "ss-plans-v1";

export function readPlansCache(): Plan[] | null {
  try {
    const raw = storage.getString(PLANS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Plan[];
  } catch {
    return null;
  }
}

export function writePlansCache(data: Plan[]): void {
  try {
    storage.set(PLANS_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Slots cache ──────────────────────────────────────────────────────────────
// Global key — delivery slots are not user-specific.

const SLOTS_KEY = "ss-slots-v1";

export function readSlotsCache(): TimeSlot[] | null {
  try {
    const raw = storage.getString(SLOTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimeSlot[];
  } catch {
    return null;
  }
}

export function writeSlotsCache(data: TimeSlot[]): void {
  try {
    storage.set(SLOTS_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Dietary options cache ────────────────────────────────────────────────────
// Global key — dietary options are not user-specific.

const DIETARY_OPTIONS_KEY = "ss-dietary-options-v1";

export function readDietaryOptionsCache(): DietaryOption[] | null {
  try {
    const raw = storage.getString(DIETARY_OPTIONS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DietaryOption[];
  } catch {
    return null;
  }
}

export function writeDietaryOptionsCache(data: DietaryOption[]): void {
  try {
    storage.set(DIETARY_OPTIONS_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Deliveries cache ─────────────────────────────────────────────────────────
// The full deliveries init payload, per user.

const DELIVERIES_KEY_PREFIX = "ss-deliv-";

export interface CachedDeliveriesData {
  purchase: PassPurchase | null;
  balance: { total_purchased: number; total_used: number } | null;
  addresses: DeliveryAddress[];
  meals: InitMeal[];
  schedules: DeliverySchedule[];
  slots: TimeSlot[];
  logs: DeliveryLog[];
  deliveriesPaused?: boolean;
}

export function readDeliveriesCache(userId: string): CachedDeliveriesData | null {
  try {
    const raw = storage.getString(DELIVERIES_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedDeliveriesData;
  } catch {
    return null;
  }
}

export function writeDeliveriesCache(
  userId: string,
  data: CachedDeliveriesData,
): void {
  try {
    storage.set(DELIVERIES_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Profile identity cache ───────────────────────────────────────────────────

const PROFILE_IDENTITY_KEY_PREFIX = "ss-prof-id-";

export interface CachedProfileIdentity {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role?: Profile['role'];
}

export function readProfileIdentityCache(
  userId: string,
): CachedProfileIdentity | null {
  try {
    const raw = storage.getString(PROFILE_IDENTITY_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedProfileIdentity;
  } catch {
    return null;
  }
}

export function writeProfileIdentityCache(
  userId: string,
  data: CachedProfileIdentity,
): void {
  try {
    storage.set(PROFILE_IDENTITY_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Profile subtitles cache ──────────────────────────────────────────────────
// Per-user key — counts change per account.

const PROFILE_SUBTITLES_KEY_PREFIX = "ss-prof-sub-";

export interface CachedProfileSubtitles {
  passesLeft: number;
  addressCount: number;
  invoiceCount: number;
  unreadCount: number;
}

export function readProfileSubtitlesCache(
  userId: string,
): CachedProfileSubtitles | null {
  try {
    const raw = storage.getString(PROFILE_SUBTITLES_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedProfileSubtitles;
  } catch {
    return null;
  }
}

export function writeProfileSubtitlesCache(
  userId: string,
  data: CachedProfileSubtitles,
): void {
  try {
    storage.set(PROFILE_SUBTITLES_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

// ─── Time-range parser ────────────────────────────────────────────────────────

const UNKNOWN_RANGE = { startMinutes: 24 * 60, endMinutes: 24 * 60 };

function parseClock(t: string): { hours: number; minutes: number; meridiem?: "AM" | "PM" } | null {
  const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  return {
    hours: parseInt(m[1], 10),
    minutes: parseInt(m[2] ?? "0", 10),
    meridiem: m[3]?.toUpperCase() as "AM" | "PM" | undefined,
  };
}

function toMinutes(c: { hours: number; minutes: number }, meridiem?: "AM" | "PM"): number {
  const h = meridiem ? (c.hours % 12) + (meridiem === "PM" ? 12 : 0) : c.hours;
  return h * 60 + c.minutes;
}

/**
 * "8 AM–1 PM" → 480–780; "4–8:30 PM" → 960–1230. A start without AM/PM takes
 * the end's. An unreadable range sits at midnight, so nothing is predicted as
 * under way or delivered from it.
 */
export function parseTimeRange(timeRange: string): {
  startMinutes: number;
  endMinutes: number;
} {
  const parts = timeRange.split(/\s*[-–]\s*/);
  if (parts.length !== 2) return UNKNOWN_RANGE;
  const start = parseClock(parts[0]);
  const end = parseClock(parts[1]);
  if (!start || !end) return UNKNOWN_RANGE;
  return {
    startMinutes: toMinutes(start, start.meridiem ?? end.meridiem),
    endMinutes: toMinutes(end, end.meridiem),
  };
}
