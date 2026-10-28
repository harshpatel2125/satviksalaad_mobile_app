import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { storage } from './storage';

export type GoalId = 'warm-water' | 'yoga' | 'water' | 'walk' | 'salad' | 'dinner' | 'breathing' | 'sleep';
export type GoalSlot = 'morning' | 'day' | 'evening';

export interface Goal {
  id: GoalId;
  title: string;
  /** The moment of the day the goal hangs on: habits anchored to a routine stick better than bare reminders. */
  when: string;
  /** Subtitle on the goal picker. */
  short: string;
  slot: GoalSlot;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Glasses for the water goal; every other goal is a single tick. */
  target?: number;
  link?: { label: string; href: Href };
  /** Daily reminder time; goals without one get no reminder. */
  remindAt?: { hour: number; minute: number };
}

export const GOALS: readonly Goal[] = [
  { id: 'warm-water', title: 'Warm water after waking', when: 'After you wake up', short: '2 glasses, first thing', slot: 'morning', icon: 'cafe-outline', remindAt: { hour: 6, minute: 30 } },
  { id: 'yoga', title: '15 min yoga', when: 'Before breakfast', short: '15 min, morning', slot: 'morning', icon: 'body-outline', link: { label: 'Yoga videos', href: '/(tabs)/videos' }, remindAt: { hour: 7, minute: 0 } },
  { id: 'water', title: 'Drink water', when: 'Through the day', short: '8 glasses', slot: 'day', icon: 'water-outline', target: 8 },
  { id: 'walk', title: '10-min walk after lunch', when: 'After lunch', short: '10 min after meals', slot: 'day', icon: 'walk-outline', remindAt: { hour: 13, minute: 30 } },
  { id: 'salad', title: 'A fresh salad', when: 'Lunch or dinner', short: 'Once a day', slot: 'day', icon: 'leaf-outline', link: { label: 'Menu', href: '/(tabs)/menu' } },
  { id: 'dinner', title: 'Dinner by 8 PM', when: 'Light and early', short: 'Light and early', slot: 'evening', icon: 'moon-outline', remindAt: { hour: 19, minute: 30 } },
  { id: 'breathing', title: '5-min breathing', when: 'Before bed', short: 'Anytime', slot: 'evening', icon: 'pulse-outline', remindAt: { hour: 21, minute: 0 } },
  { id: 'sleep', title: 'Sleep by 10:30 PM', when: 'Screens off 30 min before', short: 'Wind down early', slot: 'evening', icon: 'bed-outline', remindAt: { hour: 22, minute: 0 } },
];

export const DEFAULT_GOALS: readonly GoalId[] = ['warm-water', 'yoga', 'water', 'salad', 'dinner'];
export const MIN_GOALS = 3;
export const MAX_GOALS = 5;

export const SLOT_LABELS: Record<GoalSlot, string> = { morning: 'Morning', day: 'Day', evening: 'Evening' };

type DayRecord = { done: GoalId[]; water: number };

const KEYS = {
  selected: 'goals.selected',
  reminders: 'goals.reminders',
  popupOff: 'goals.popupOff',
  popupShownOn: 'goals.popupShownOn',
  day: (key: string) => `goals.day.${key}`,
};

/** How far back the streak looks; older days cannot change it in practice. */
const STREAK_LOOKBACK_DAYS = 400;
/** One empty day in a week is a rest day and keeps the streak, so a single miss never resets it. */
const REST_EVERY_DAYS = 7;

// ─── Store ─────────────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** The local calendar day, e.g. "2026-10-28". */
export function dayKey(date = new Date()): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function selectedGoalIds(): GoalId[] {
  const ids = readJson<GoalId[]>(KEYS.selected, [...DEFAULT_GOALS]);
  return GOALS.filter((goal) => ids.includes(goal.id)).map((goal) => goal.id);
}

export function setSelectedGoals(ids: GoalId[]) {
  storage.set(KEYS.selected, JSON.stringify(ids));
  changed();
}

function readDay(key: string): DayRecord {
  return readJson<DayRecord>(KEYS.day(key), { done: [], water: 0 });
}

function writeDay(key: string, record: DayRecord) {
  storage.set(KEYS.day(key), JSON.stringify(record));
  changed();
}

function isComplete(goal: Goal, record: DayRecord): boolean {
  return goal.target ? record.water >= goal.target : record.done.includes(goal.id);
}

function hasActivity(record: DayRecord): boolean {
  return record.done.length > 0 || record.water > 0;
}

// ─── Reminders and the daily popup ─────────────────────────────────────────────

export function reminderGoalIds(): GoalId[] {
  return readJson<GoalId[]>(KEYS.reminders, []);
}

export function setReminderGoalIds(ids: GoalId[]) {
  storage.set(KEYS.reminders, JSON.stringify(ids));
  changed();
}

export function goalsPopupEnabled(): boolean {
  return storage.getBoolean(KEYS.popupOff) !== true;
}

export function setGoalsPopupEnabled(enabled: boolean) {
  storage.set(KEYS.popupOff, !enabled);
  changed();
}

/** True on the first check of each day while the popup is switched on. */
export function goalsPopupDue(): boolean {
  return goalsPopupEnabled() && storage.getString(KEYS.popupShownOn) !== dayKey();
}

export function markGoalsPopupShown() {
  storage.set(KEYS.popupShownOn, dayKey());
}

// ─── Streak and week ───────────────────────────────────────────────────────────

export type WeekDayStatus = 'full' | 'partial' | 'rest' | 'empty' | 'upcoming';

export interface WeekDay {
  key: string;
  letter: string;
  status: WeekDayStatus;
  doneCount: number;
  isToday: boolean;
}

function streakAndRestDays(goals: readonly Goal[], today: Date): { streak: number; restDays: Set<string> } {
  const restDays = new Set<string>();
  // Today still counts when nothing is ticked yet: the day is not over.
  let streak = hasActivity(readDay(dayKey(today))) ? 1 : 0;
  let lastRest = -Infinity;
  for (let back = 1; back <= STREAK_LOOKBACK_DAYS; back += 1) {
    const key = dayKey(addDays(today, -back));
    if (hasActivity(readDay(key))) {
      streak += 1;
      continue;
    }
    const olderActive = hasActivity(readDay(dayKey(addDays(today, -back - 1))));
    if (olderActive && back - lastRest >= REST_EVERY_DAYS) {
      restDays.add(key);
      lastRest = back;
      continue;
    }
    break;
  }
  return { streak: goals.length ? streak : 0, restDays };
}

function weekOf(goals: readonly Goal[], today: Date, restDays: Set<string>): WeekDay[] {
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const todayKey = dayKey(today);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = dayKey(date);
    const record = readDay(key);
    const doneCount = goals.filter((goal) => isComplete(goal, record)).length;
    let status: WeekDayStatus;
    if (key > todayKey) status = 'upcoming';
    else if (goals.length > 0 && doneCount === goals.length) status = 'full';
    else if (doneCount > 0 || hasActivity(record)) status = 'partial';
    else if (restDays.has(key)) status = 'rest';
    else status = 'empty';
    return { key, letter: 'MTWTFSS'[index], status, doneCount, isToday: key === todayKey };
  });
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

function toggleGoal(id: GoalId) {
  const key = dayKey();
  const latest = readDay(key);
  const done = latest.done.includes(id) ? latest.done.filter((d) => d !== id) : [...latest.done, id];
  writeDay(key, { ...latest, done });
}

function setWater(glasses: number) {
  const key = dayKey();
  writeDay(key, { ...readDay(key), water: Math.max(0, glasses) });
}

function buildSnapshot() {
  const today = new Date();
  const ids = selectedGoalIds();
  const goals = GOALS.filter((goal) => ids.includes(goal.id));
  const record = readDay(dayKey(today));
  const { streak, restDays } = streakAndRestDays(goals, today);
  return {
    goals,
    water: record.water,
    isDone: (goal: Goal) => isComplete(goal, record),
    doneCount: goals.filter((goal) => isComplete(goal, record)).length,
    streak,
    week: weekOf(goals, today, restDays),
    toggle: toggleGoal,
    setWater,
  };
}

// useSyncExternalStore needs the same object back until something changes, the day included.
let cached: { version: number; day: string; snapshot: ReturnType<typeof buildSnapshot> } | null = null;

function getSnapshot() {
  const day = dayKey();
  if (!cached || cached.version !== version || cached.day !== day) {
    cached = { version, day, snapshot: buildSnapshot() };
  }
  return cached.snapshot;
}

export function useDailyGoals() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
