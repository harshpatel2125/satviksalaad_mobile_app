import { DELIVERY_DAYS } from '@/lib/delivery-rules';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DISPLAY_DAYS: readonly string[] = DELIVERY_DAYS;

// ─── IST helpers ─────────────────────────────────────────────────────────────

export function todayISTStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function tomorrowISTStr(): string {
  return new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Monday-to-Sunday date strings for the week at `offset` from the one holding `todayStr`. */
export function getWeekDates(offset: number, todayStr: string): string[] {
  // IST noon is 06:30 UTC on the same date, so UTC day arithmetic on it gives
  // IST dates whatever the device's timezone.
  const today = new Date(todayStr + 'T12:00:00+05:30');
  const dow = today.getUTCDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + daysToMonday + offset * 7 + i);
    return d.toISOString().slice(0, 10);
  });
}
