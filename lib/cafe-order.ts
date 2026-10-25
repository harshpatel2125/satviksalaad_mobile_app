import { formatGstRate } from './gst';

export type DietMark = 'glutenFree' | 'jain' | 'vegan';

/** Rupees. "MRP" is sold at the printed retail price. */
export type CafePrice = number | { onePiece: number; twoPiece: number } | 'MRP';

export interface CafeItem {
  name: string;
  price: CafePrice;
  /** Every size, in rupees, for items sold in sizes; preferred over the 1 pc / 2 pc `price`. */
  variants?: { label: string; price: number }[];
  kcal?: number;
  proteinG?: number;
  ingredients?: string;
  marks?: DietMark[];
}

export interface CafeAddOn {
  name: string;
  price: number;
}

export interface CafeSection {
  id: string;
  title: string;
  items: CafeItem[];
  addOns?: CafeAddOn[];
}

export interface OpeningHours {
  /** Date#getDay numbering, 0 = Sunday. */
  openDays: number[];
  /** 24-hour "HH:MM", IST. */
  opens: string;
  closes: string;
  daysLabel: string;
  timeLabel: string;
}

export interface CafeMenuData {
  sections: CafeSection[];
  dietMarks: Record<DietMark, { label: string; letter: string }>;
  outlet: {
    name: string;
    addressText: string;
    mapsUrl: string;
    hours: OpeningHours;
  };
  /** GST added on top of menu prices; 0 when none is charged. */
  gstRateBps?: number;
  /** Whether pickup orders can be paid online now. */
  onlinePayment?: boolean;
}

export interface CafeMenuResponse {
  success: boolean;
  data: CafeMenuData;
}

export const MAX_QUANTITY = 20;

/** One thing a customer can put in the cart: a menu item, one size of a toast, or an add-on. */
export interface Orderable {
  key: string;
  name: string;
  /** The size, for items sold in sizes ("1 pc" / "2 pc"). */
  variant?: string;
  /** Rupees; null when sold at MRP. */
  unitPrice: number | null;
}

export interface CartLine extends Orderable {
  quantity: number;
}

export type Fulfilment = 'delivery' | 'pickup';

/** How a pickup is paid in advance: online now, or once the order is confirmed on WhatsApp. */
export type PickupPayment = 'online' | 'whatsapp';

export interface OrderDetails {
  name: string;
  phone: string;
  fulfilment: Fulfilment;
  address: string;
  locationUrl: string | null;
  /** "HH:MM", null for as soon as possible, "" while a time is still to be picked. */
  time: string | null;
  notes: string;
}

export type OrderField = 'name' | 'phone' | 'address' | 'time';

const IST_OFFSET_MS = 330 * 60_000;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "08:00" → "8 AM", "12:30" → "12:30 PM". */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const time = m ? `${h % 12 || 12}:${String(m).padStart(2, '0')}` : `${h % 12 || 12}`;
  return `${time} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Minutes since midnight and the weekday on the IST wall clock, whatever the device's time zone. */
export function istClock(now: Date): { day: number; minute: number } {
  // IST has no daylight saving, so a fixed offset is exact.
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return { day: ist.getUTCDay(), minute: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}

/** "until 8 PM" while open, otherwise when it next opens: "opens at 8 AM", "opens Monday 8 AM". */
export function openStatus(now: Date, hours: Pick<OpeningHours, 'openDays' | 'opens' | 'closes'>) {
  const { day, minute } = istClock(now);
  const openToday = hours.openDays.includes(day);

  if (openToday && minute >= toMinutes(hours.opens) && minute < toMinutes(hours.closes)) {
    return { isOpen: true, detail: `until ${formatClock(hours.closes)}` };
  }

  const opensAt = formatClock(hours.opens);
  if (openToday && minute < toMinutes(hours.opens)) return { isOpen: false, detail: `opens at ${opensAt}` };

  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = (day + ahead) % 7;
    if (hours.openDays.includes(next)) return { isOpen: false, detail: `opens ${DAY_NAMES[next]} ${opensAt}` };
  }
  return { isOpen: false, detail: '' };
}

export function itemOrderables(sectionId: string, item: CafeItem): Orderable[] {
  const key = `${sectionId}/${item.name}`;
  if (item.variants?.length) {
    return item.variants.map((v) => ({
      key: `${key}/${v.label.replace(/\s+/g, '')}`,
      name: `${item.name} (${v.label})`,
      variant: v.label,
      unitPrice: v.price,
    }));
  }
  if (typeof item.price === 'number') return [{ key, name: item.name, unitPrice: item.price }];
  if (item.price === 'MRP') return [{ key, name: item.name, unitPrice: null }];
  return [
    { key: `${key}/1pc`, name: `${item.name} (1 pc)`, variant: '1 pc', unitPrice: item.price.onePiece },
    { key: `${key}/2pc`, name: `${item.name} (2 pc)`, variant: '2 pc', unitPrice: item.price.twoPiece },
  ];
}

export function addOnOrderable(section: CafeSection, addOn: CafeAddOn): Orderable {
  return {
    key: `${section.id}/add-on/${addOn.name}`,
    name: `${addOn.name} (add-on for ${section.title.toLowerCase()})`,
    unitPrice: addOn.price,
  };
}

const orderablesByMenu = new WeakMap<CafeSection[], Map<string, Orderable>>();

/** Everything orderable from `menu`, in menu order, keyed by cart key. */
export function menuOrderables(menu: CafeSection[]): Map<string, Orderable> {
  let orderables = orderablesByMenu.get(menu);
  if (!orderables) {
    orderables = new Map(
      menu
        .flatMap((section) => [
          ...section.items.flatMap((item) => itemOrderables(section.id, item)),
          ...(section.addOns ?? []).map((addOn) => addOnOrderable(section, addOn)),
        ])
        .map((orderable) => [orderable.key, orderable]),
    );
    orderablesByMenu.set(menu, orderables);
  }
  return orderables;
}

/** Keeps only known keys with a whole quantity in range, so stale or tampered storage cannot break the cart. */
export function parseCart(raw: string, menu: CafeSection[]): Record<string, number> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const orderables = menuOrderables(menu);
  const cart: Record<string, number> = {};
  for (const [key, quantity] of Object.entries(data)) {
    if (orderables.has(key) && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY) {
      cart[key] = quantity;
    }
  }
  return cart;
}

/** Lines in menu order, whatever order they were added in. */
export function cartLines(quantities: Record<string, number>, menu: CafeSection[]): CartLine[] {
  return [...menuOrderables(menu).values()]
    .filter((orderable) => (quantities[orderable.key] ?? 0) > 0)
    .map((orderable) => ({ ...orderable, quantity: quantities[orderable.key] }));
}

export function lineTotal(line: CartLine): number | null {
  return line.unitPrice === null ? null : line.unitPrice * line.quantity;
}

/** Sum of priced lines; MRP lines are settled at the counter. */
export function itemsTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + (lineTotal(line) ?? 0), 0);
}

export function rupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** The 10 digits of an Indian mobile number, accepting a +91 or 0 prefix and any spacing; null if invalid. */
export function indianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function validateOrder(
  order: OrderDetails,
  hours: { opens: string; closes: string },
): Partial<Record<OrderField, string>> {
  const errors: Partial<Record<OrderField, string>> = {};
  if (order.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!indianMobile(order.phone)) errors.phone = 'Enter a 10-digit mobile number.';
  if (order.fulfilment === 'delivery' && order.address.trim().length < 5) {
    errors.address = 'Enter the full delivery address.';
  }
  if (order.time !== null) {
    if (!/^\d{2}:\d{2}$/.test(order.time)) errors.time = 'Choose a time, or pick as soon as possible.';
    else if (order.time < hours.opens || order.time > hours.closes) {
      errors.time = `Choose a time between ${formatClock(hours.opens)} and ${formatClock(hours.closes)}.`;
    }
  }
  return errors;
}

/** Why `lines` can't be paid online at `now`, or null when they can. */
export function onlinePaymentBlock(lines: CartLine[], now: Date, hours: OpeningHours): string | null {
  if (lines.length === 0) return 'Your order is empty.';
  if (lines.some((line) => line.unitPrice === null)) {
    return 'Items sold at MRP are paid at the counter, so send this order on WhatsApp.';
  }
  const status = openStatus(now, hours);
  if (!status.isOpen) return `Online payment opens with the café: ${status.detail}.`;
  return null;
}

/** A chosen pickup time must still be ahead today; the order is being paid for now. */
export function pickupTimeError(time: string | null, now: Date): string | null {
  if (time && toMinutes(time) <= istClock(now).minute) return 'Choose a time later today, or pick as soon as possible.';
  return null;
}

/** A café order paid online, with the message to send the café about it. */
export interface PaidCafeOrder {
  orderNumber: string;
  amountPaise: number;
  message: string;
}

/** What starting an online payment returns. */
export interface StartedCafeOrder {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  amountPaise: number;
  keyId: string;
}

const oneLine = (text: string) => text.trim().replace(/\s*\n\s*/g, ', ');

/** Plain-text WhatsApp message for a validated order. */
export function buildOrderMessage(lines: CartLine[], order: OrderDetails, gstRateBps = 0): string {
  const rate = gstRateBps > 0 ? formatGstRate(gstRateBps) : null;
  const delivery = order.fulfilment === 'delivery';
  const phone = indianMobile(order.phone);
  const hasMrp = lines.some((line) => line.unitPrice === null);
  const total = rupees(itemsTotal(lines));

  const message = [
    'New café order for Satvik Salaad',
    '',
    `Name: ${oneLine(order.name)}`,
    `Phone: ${phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : oneLine(order.phone)}`,
    `Order type: ${delivery ? 'Delivery' : 'Pickup at the café'}`,
    ...(delivery ? [`Address: ${oneLine(order.address)}`] : []),
    ...(delivery && order.locationUrl ? [`Location: ${order.locationUrl}`] : []),
    `Preferred time: ${order.time ? formatClock(order.time) : 'As soon as possible'}`,
    '',
    ...lines.map((line) => {
      const amount = lineTotal(line);
      return `${line.quantity} × ${line.name}: ${amount === null ? 'MRP' : rupees(amount)}`;
    }),
    '',
    `Items total: ${hasMrp ? `${total} + MRP items` : total}`,
    ...(rate ? [`Plus ${rate} GST.`] : []),
    ...(order.notes.trim() ? [`Notes: ${oneLine(order.notes)}`] : []),
    '',
    delivery
      ? 'Payment in advance: please share the payment details. Delivery charges, if any, to be confirmed on WhatsApp.'
      : 'Payment in advance: please share the payment details.',
  ];
  return message.join('\n');
}

export function whatsappOrderUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
