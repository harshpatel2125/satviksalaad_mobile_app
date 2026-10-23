import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { slotsApi } from '@/lib/api';
import { readSlotsCache, writeSlotsCache } from '@/lib/home-cache';
import { CACHE_TTL } from '@/lib/query-client';
import type { ThemeColors } from '@/constants/theme';
import type { TimeSlot } from '@/types/api';

// Single source of truth for delivery slots. Data comes from the
// delivery_time_slots table via /api/v1/slots — labels, time ranges and icons
// must never be hardcoded in the UI. MMKV keeps the last successful fetch so
// screens render instantly offline; the query refetches (and rewrites MMKV)
// on every app open and at most every CACHE_TTL.slots while the app is in use.

export function useSlots(): TimeSlot[] {
  const [cached] = React.useState(() => readSlotsCache());
  const { data } = useQuery({
    queryKey: ['slots'],
    queryFn: slotsApi.list,
    staleTime: CACHE_TTL.slots,
  });
  React.useEffect(() => {
    if (data?.data) writeSlotsCache(data.data);
  }, [data]);
  return data?.data ?? cached ?? [];
}

// "8:00 AM - 1:00 PM" → "8 AM–1 PM"; "4:00 PM - 8:30 PM" → "4–8:30 PM".
// The start keeps its AM/PM only when the range crosses noon.
export function formatTimeRange(range: string | null | undefined): string {
  if (!range) return '';
  const parts = range.split(/\s*[-–]\s*/);
  if (parts.length !== 2) return range;
  const [start, end] = parts.map((t) => t.trim().replace(/:00\b/, ''));
  const meridiem = (t: string) => t.match(/\s?(AM|PM)$/i)?.[1]?.toUpperCase();
  const sameHalf = meridiem(start) && meridiem(start) === meridiem(end);
  return `${sameHalf ? start.replace(/\s?(AM|PM)$/i, '') : start}–${end}`;
}

function findSlot(id: string, slots: TimeSlot[]): TimeSlot | undefined {
  return slots.find((s) => s.id === id);
}

// Slot data unavailable (first launch offline) — show the id itself rather
// than invent a label or time range that may not match the DB.
function fallbackName(id: string): string {
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : '';
}

// "🌤️ Lunch · 8 AM–1 PM"
export function slotLabel(id: string, slots: TimeSlot[]): string {
  const s = findSlot(id, slots);
  if (s) return `${s.icon ?? '⏰'} ${s.label}${s.time_range ? ` · ${formatTimeRange(s.time_range)}` : ''}`;
  return fallbackName(id);
}

// "Lunch · 8 AM–1 PM" — for rows that render their own icon
export function slotLabelPlain(id: string, slots: TimeSlot[]): string {
  const s = findSlot(id, slots);
  if (s) return `${s.label}${s.time_range ? ` · ${formatTimeRange(s.time_range)}` : ''}`;
  return fallbackName(id);
}

// "🌤️ 8 AM–1 PM" — compact, time only
export function slotTime(id: string, slots: TimeSlot[]): string {
  const s = findSlot(id, slots);
  if (s) return `${s.icon ?? '⏰'} ${formatTimeRange(s.time_range)}`;
  return fallbackName(id);
}

// "Lunch" — bare name, trailing "Slot" stripped for prose like "Lunch bowl"
export function slotName(id: string, slots: TimeSlot[]): string {
  const s = findSlot(id, slots);
  return s?.label.replace(/\s*slot\s*$/i, '') || fallbackName(id);
}

// Falls back to blue for any slot beyond noon and evening.
export function slotColor(id: string, colors: ThemeColors): { fg: string; bg: string } {
  if (id === 'noon') return { fg: colors.orange, bg: colors.orangeBg };
  if (id === 'evening') return { fg: colors.purple, bg: colors.purpleBg };
  return { fg: colors.blue, bg: colors.blueBg };
}
