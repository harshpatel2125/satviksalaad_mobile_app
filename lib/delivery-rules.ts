// Which days deliveries run, and until when a customer may still change one.
// The server holds the same rules and refuses anything past them. Times are
// IST, always UTC+5:30, worked out from the real instant rather than the
// device's timezone.

/** Days with deliveries, in week order. */
export const DELIVERY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DeliveryDay = (typeof DELIVERY_DAYS)[number];

/** What a new plan delivers on; Sunday is opt-in. */
export const DEFAULT_DELIVERY_DAYS: readonly DeliveryDay[] = DELIVERY_DAYS.slice(0, 6);

/** Shown wherever a customer can pick Sunday. Distance is not checked anywhere. */
export const SUNDAY_DELIVERY_NOTE =
  'Sunday delivery is free within 3 km of our Prahladnagar outlet. Further away, book a Porter from the outlet at your own cost.';

export const CHANGE_CUTOFFS_NOTE =
  'Lunch changes close at 10 PM the night before; dinner changes close at 12 PM the same day.';

export const LUNCH_SLOT = 'noon';
/** The only slot on the dinner cutoff. Any other id, known or not, gets the stricter lunch one. */
export const DINNER_SLOT = 'evening';

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

const LUNCH_CUTOFF = { daysBefore: 1, hourIST: 22 };
const DINNER_CUTOFF = { daysBefore: 0, hourIST: 12 };

function cutoffRule(slot: string) {
  return slot === DINNER_SLOT ? DINNER_CUTOFF : LUNCH_CUTOFF;
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The IST calendar date of an instant, as YYYY-MM-DD. */
export function istDate(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant changes close for the delivery on `date` (IST YYYY-MM-DD) in `slot`. */
export function changeCutoff(date: string, slot: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const { daysBefore, hourIST } = cutoffRule(slot);
  return new Date(Date.UTC(y, m - 1, d - daysBefore, hourIST) - IST_OFFSET_MS);
}

/**
 * Whether a customer may still skip, restore or change this delivery at `now`.
 * Never for anything but a real YYYY-MM-DD date.
 */
export function canChangeDelivery(date: string, slot: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== date) return false;
  return now.getTime() < changeCutoff(date, slot).getTime();
}

/**
 * The first date whose deliveries in `slot` can still change at `now`. Given
 * several slots, the first date on which all of them can.
 */
export function firstChangeableDate(slot: string | readonly string[], now: Date = new Date()): string {
  const slots = typeof slot === 'string' ? [slot] : slot.length > 0 ? slot : [LUNCH_SLOT];
  let date = istDate(now);
  while (slots.some((s) => !canChangeDelivery(date, s, now))) date = addDays(date, 1);
  return date;
}

/** When changes close for a delivery in `slot`, e.g. "10 PM the night before". */
export function cutoffLabel(slot: string): string {
  return slot === DINNER_SLOT ? '12 PM the same day' : '10 PM the night before';
}

/** Why a customer can no longer change a delivery in `slot`. */
export function changeClosedMessage(slot: string): string {
  return slot === DINNER_SLOT
    ? 'Dinner changes close at 12 PM the same day, so this delivery can no longer be changed.'
    : 'Lunch changes close at 10 PM the night before, so this delivery can no longer be changed.';
}
