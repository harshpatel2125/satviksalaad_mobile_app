// The words and groupings a customer sees for their subscriptions and
// deliveries, the same as the website says them. Pure: no React or screens.
import { DELIVERY_DAYS, DINNER_SLOT, canChangeDelivery, cutoffLabel } from './delivery-rules';
import type { Categories, CategoryInfo, DeliveryHistoryLog, DeliveryLog, Subscription, Units } from '@/types/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DEFAULT_UNITS: Units = { singular: 'bowl', plural: 'bowls' };

/** "Mon 2 Nov", read from the YYYY-MM-DD parts so the device's timezone never shifts the day. */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_NAMES[weekday].slice(0, 3)} ${d} ${MONTHS[m - 1]}`;
}

/** "1 bowl", "6 bowls". */
export function countOf(n: number, unit: Units = DEFAULT_UNITS): string {
  return `${n} ${n === 1 ? unit.singular : unit.plural}`;
}

/** A category's details, or a stand-in named after its slug when it is unknown. */
export function categoryInfo(categories: Readonly<Categories>, slug: string | null | undefined): CategoryInfo {
  const key = slug || 'salad';
  return (
    categories[key] ?? {
      slug: key,
      name: key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' '),
      unit: DEFAULT_UNITS,
      image_url: null,
      sort_order: Number.MAX_SAFE_INTEGER,
    }
  );
}

/** "Salad Bowl" for "Salad Bowls" counted in bowls; any other category keeps its own name. */
export function itemName(category: Pick<CategoryInfo, 'name' | 'unit'>): string {
  const { name, unit } = category;
  const plural = unit.plural.toLowerCase();
  if (plural && name.toLowerCase().endsWith(plural)) {
    const stem = name.slice(0, name.length - plural.length);
    const word = name.slice(name.length - plural.length);
    const singular =
      word[0] === word[0].toUpperCase() ? unit.singular.charAt(0).toUpperCase() + unit.singular.slice(1) : unit.singular;
    return `${stem}${singular}`;
  }
  return name;
}

export type MealInfo = { name: string; image_url: string | null };

/** The meal the server named on the delivery, else the item its category delivers. */
export function mealForLog(
  log: { meal_name?: string | null; meal_image_url?: string | null; category?: string | null },
  categories: Categories,
): MealInfo {
  if (log.meal_name) return { name: log.meal_name, image_url: log.meal_image_url ?? null };
  return { name: itemName(categoryInfo(categories, log.category)), image_url: null };
}

export type UnitIcon = 'bowl' | 'cup' | 'leaf';

/** The neutral picture for an item with no photo, by the word its category counts in. */
export function unitIcon(unitSingular: string): UnitIcon {
  // The last word decides, so "glass bottle" is a bottle.
  const word = unitSingular.trim().toLowerCase().split(/\s+/).pop() ?? '';
  if (word === 'bowl') return 'bowl';
  if (word === 'bottle' || word === 'glass' || word === 'cup') return 'cup';
  return 'leaf';
}

type SubscriptionFacts = Pick<
  Subscription,
  'status' | 'plan' | 'unit' | 'bowls_total' | 'bowls_left' | 'bowls_expired' | 'starts_on' | 'ends_on'
>;

/** "4 of 6 bowls left" */
export function bowlsLeftText(sub: Pick<Subscription, 'bowls_left' | 'bowls_total' | 'unit'>): string {
  return `${sub.bowls_left} of ${sub.bowls_total} ${sub.bowls_total === 1 ? sub.unit.singular : sub.unit.plural} left`;
}

/** "Salad Bowls · Weekly" when the category is named, else "Weekly". */
export function subscriptionTitle(sub: Pick<Subscription, 'plan'>, categoryName?: string | null): string {
  return categoryName ? `${categoryName} · ${sub.plan.name}` : sub.plan.name;
}

/** "4 of 6 bowls left · valid till Sat 7 Nov", or "6 bowls · starts Mon 2 Nov · valid till Sat 7 Nov" before it starts. */
export function subscriptionDetail(sub: SubscriptionFacts, today: string): string {
  const valid = `valid till ${formatDay(sub.ends_on)}`;
  return sub.starts_on > today
    ? `${countOf(sub.bowls_total, sub.unit)} · starts ${formatDay(sub.starts_on)} · ${valid}`
    : `${bowlsLeftText(sub)} · ${valid}`;
}

/** "Weekly · 4 of 6 bowls left · valid till Sat 7 Nov", led by the category's name when given. */
export function subscriptionLine(sub: SubscriptionFacts, today: string, categoryName?: string | null): string {
  return `${subscriptionTitle(sub, categoryName)} · ${subscriptionDetail(sub, today)}`;
}

/** "Next: Monthly, starts Mon 9 Nov" */
export function nextLine(sub: Pick<Subscription, 'plan' | 'starts_on'>): string {
  return `Next: ${sub.plan.name}, starts ${formatDay(sub.starts_on)}`;
}

function extraDays(n: number): string {
  return `${n} extra ${n === 1 ? 'day' : 'days'}`;
}

/**
 * How skipping works for these subscriptions, each with its own extra days
 * and unit words; null with none.
 */
export function skipRuleText(subs: readonly Pick<Subscription, 'plan' | 'unit' | 'extension_days_allowed'>[]): string | null {
  if (subs.length === 0) return null;
  const [first] = subs;
  const alike = subs.every((s) => s.unit.singular === first.unit.singular && s.extension_days_allowed === first.extension_days_allowed);
  if (alike) {
    const unit = first.unit.singular;
    return `A subscription is valid till the day its last ${unit} is due. Skip a day and that ${unit} moves to the end, up to ${extraDays(first.extension_days_allowed)}; anything not delivered by then expires.`;
  }
  const limits = subs.map((s, i) => `${i === 0 ? extraDays(s.extension_days_allowed) : s.extension_days_allowed} for your ${s.plan.name}`);
  const listed = `${limits.slice(0, -1).join(', ')} and ${limits.at(-1)}`;
  return `A subscription is valid till the day its last delivery is due. Skip a day and each item moves to the end of its own subscription, up to ${listed}. Anything not delivered by then expires.`;
}

/** "Extension used: 2 of 15 days" */
export function extensionLine(sub: Pick<Subscription, 'extension_days_used' | 'extension_days_allowed'>): string {
  const allowed = sub.extension_days_allowed;
  return `Extension used: ${sub.extension_days_used} of ${allowed} ${allowed === 1 ? 'day' : 'days'}`;
}

/** What happened to an ended subscription, in a few words. */
export function endedLine(sub: SubscriptionFacts): string {
  switch (sub.status) {
    case 'completed':
      return `Completed on ${formatDay(sub.ends_on)}`;
    case 'expired':
      return sub.bowls_expired > 0
        ? `${countOf(sub.bowls_expired, sub.unit)} expired on ${formatDay(sub.ends_on)}`
        : `Ended on ${formatDay(sub.ends_on)}`;
    case 'refunded':
      return 'Refunded';
    default:
      return `Valid till ${formatDay(sub.ends_on)}`;
  }
}

/** "Active", "Starts Mon 2 Nov", "Completed", "Expired" or "Refunded". */
export function statusLabel(sub: Pick<Subscription, 'status' | 'starts_on'>, today: string): string {
  switch (sub.status) {
    case 'active':
      return sub.starts_on > today ? `Starts ${formatDay(sub.starts_on)}` : 'Active';
    case 'upcoming':
      return `Starts ${formatDay(sub.starts_on)}`;
    case 'completed':
      return 'Completed';
    case 'expired':
      return 'Expired';
    case 'refunded':
      return 'Refunded';
    default:
      return sub.status;
  }
}

/** A running subscription near its end with nothing queued after it: time to offer a renewal. */
export function isEnding(sub: Pick<Subscription, 'status' | 'bowls_left'>, hasNext: boolean): boolean {
  return sub.status === 'active' && !hasNext && sub.bowls_left <= 2;
}

/** The plan Renew offers again, by slug: the same one, except a trial, which is had once. */
export function renewPlanSlug(sub: Pick<Subscription, 'plan'>): string | null {
  return sub.plan.slug && !sub.plan.is_trial ? sub.plan.slug : null;
}

export function renewLabel(sub: Pick<Subscription, 'plan'>): string {
  return sub.plan.is_trial ? 'Choose a plan' : 'Renew';
}

/** "Changes closed (lunch closes at 10 PM the night before)" */
export function changesClosedText(slot: string): string {
  return `Changes closed (${slot === DINNER_SLOT ? 'dinner' : 'lunch'} closes at ${cutoffLabel(slot)})`;
}

export type DayItem = Pick<DeliveryLog, 'id' | 'delivery_date' | 'delivery_slot' | 'status' | 'category'>;

/** A delivery ready to show on a day card. */
export interface DayItemView extends DayItem {
  quantity: number;
  unit: Units;
  /** The meal on it, else what its category delivers. */
  name: string;
  image_url: string | null;
  /** The category's menu name, e.g. "Salad Bowls". */
  categoryName: string;
  categoryImageUrl: string | null;
  subscription_id: string | null;
}

export function toDayItem(log: DeliveryLog, categories: Categories): DayItemView {
  const meal = mealForLog(log, categories);
  const category = categoryInfo(categories, log.category);
  return {
    id: log.id,
    delivery_date: log.delivery_date,
    delivery_slot: log.delivery_slot,
    status: log.status,
    category: log.category,
    quantity: log.quantity,
    unit: log.unit ?? category.unit,
    name: meal.name,
    image_url: meal.image_url,
    categoryName: category.name,
    categoryImageUrl: category.image_url,
    subscription_id: log.subscription_id,
  };
}

/** A past delivery as its history row names it, ready to show like a day card's item. */
export function historyItem(log: DeliveryHistoryLog): DayItemView {
  const unit = log.unit ?? DEFAULT_UNITS;
  const categoryName = log.category_name ?? 'Salad Bowls';
  return {
    id: log.id,
    delivery_date: log.delivery_date,
    delivery_slot: log.delivery_slot,
    status: log.status as DeliveryLog['status'],
    category: log.category ?? 'salad',
    quantity: log.quantity ?? 1,
    unit,
    name: log.meal_name || itemName({ name: categoryName, unit }),
    image_url: log.meal_image_url ?? null,
    categoryName,
    categoryImageUrl: null,
    subscription_id: null,
  };
}

export interface DeliveryDay<T extends DayItem> {
  date: string;
  items: T[];
}

const SLOT_ORDER: Record<string, number> = { noon: 0, evening: 1 };

/** Deliveries by day, earliest first; within a day by time, then by the category's menu order. */
export function groupByDay<T extends DayItem>(
  logs: readonly T[],
  categoryOrder: (slug: string) => number = () => 0,
): DeliveryDay<T>[] {
  const days = new Map<string, T[]>();
  for (const log of logs) {
    const list = days.get(log.delivery_date);
    if (list) list.push(log);
    else days.set(log.delivery_date, [log]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.sort(
        (a, b) =>
          (SLOT_ORDER[a.delivery_slot] ?? 9) - (SLOT_ORDER[b.delivery_slot] ?? 9) ||
          categoryOrder(a.category) - categoryOrder(b.category),
      ),
    }));
}

export interface DayActions {
  /** One tap skips every delivery still on that day. */
  canSkipDay: boolean;
  /** One tap brings the whole skipped day back. */
  canUndoDay: boolean;
  /** Per-item buttons, only for a day with several items. */
  perItem: boolean;
  /** The slot whose cutoff has passed for a delivery that could otherwise still change. */
  closedSlot: string | null;
}

/** What a customer may do with a day's deliveries at `now`. */
export function dayActions(items: readonly DayItem[], now: Date = new Date()): DayActions {
  const live = items.filter((i) => i.status === 'scheduled' || i.status === 'skipped');
  const open = live.filter((i) => canChangeDelivery(i.delivery_date, i.delivery_slot, now));
  const closed = live.find((i) => !canChangeDelivery(i.delivery_date, i.delivery_slot, now));
  const scheduled = live.filter((i) => i.status === 'scheduled');
  const skipped = live.filter((i) => i.status === 'skipped');
  const allOpen = open.length === live.length;
  return {
    canSkipDay: allOpen && scheduled.length > 0,
    canUndoDay: allOpen && scheduled.length === 0 && skipped.length > 0,
    perItem: items.length > 1 && open.length > 0,
    closedSlot: closed ? closed.delivery_slot : null,
  };
}

const isLive = (l: Pick<DeliveryLog, 'status'>) => l.status === 'scheduled' || l.status === 'out_for_delivery';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/** Today while anything is still coming or was delivered in the last two hours, else the next day with a delivery. */
export function nextDeliveryDate(
  logs: readonly Pick<DeliveryLog, 'delivery_date' | 'status' | 'delivered_at'>[],
  today: string,
  nowMs: number,
): string | null {
  const todays = logs.filter((l) => l.delivery_date === today);
  const justDelivered = todays.some(
    (l) => l.status === 'delivered' && l.delivered_at && nowMs - new Date(l.delivered_at).getTime() < TWO_HOURS_MS,
  );
  if (todays.some(isLive) || justDelivered) return today;
  return (
    logs
      .filter((l) => l.delivery_date > today && isLive(l))
      .map((l) => l.delivery_date)
      .sort()[0] ?? null
  );
}

/** Whether the subscriptions span more than one category. */
export function namesCategories(subs: readonly Pick<Subscription, 'category'>[]): boolean {
  return new Set(subs.map((s) => s.category)).size > 1;
}

/** Each running subscription with the one waiting after it in its category. */
export function runningWithNext(open: readonly Subscription[]): { sub: Subscription; next: Subscription | null }[] {
  return open
    .filter((s) => s.status === 'active')
    .map((sub) => ({
      sub,
      next: open.find((s) => s.status === 'upcoming' && s.category === sub.category) ?? null,
    }));
}

/** "Monday to Saturday", "Every day", or "Mon, Wed, Fri". */
export function daysText(days: readonly string[]): string {
  const ordered = DELIVERY_DAYS.filter((d) => days.includes(d));
  if (ordered.length === DELIVERY_DAYS.length) return 'Every day';
  if (ordered.length === 6 && !ordered.includes('Sunday')) return 'Monday to Saturday';
  return ordered.map((d) => d.slice(0, 3)).join(', ');
}
