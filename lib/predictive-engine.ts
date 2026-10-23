import type { HomeCacheData } from './home-cache';

export interface PredictedHomeState {
  todayStatus: 'no_delivery' | 'preparing' | 'out_for_delivery' | 'delivered';
  totalPurchased: number;
  passesRemaining: number;
}

export interface PredictiveEngineInput {
  cache: HomeCacheData;
  now: Date;
}

function istDateString(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function nowMinutesIST(now: Date): number {
  const h = parseInt(
    now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
    10,
  );
  const m = parseInt(
    now.toLocaleString('en-US', { minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    10,
  );
  return h * 60 + m;
}

export function predictHomeState({ cache, now }: PredictiveEngineInput): PredictedHomeState {
  const todayStr = istDateString(now);
  const nowMins = nowMinutesIST(now);

  const todayLog = cache.logs.find((l) => l.deliveryDate === todayStr) ?? null;

  const slotId = todayLog?.deliverySlot ?? cache.schedule?.deliverySlot ?? null;
  const slot = slotId ? (cache.slots.find((s) => s.id === slotId) ?? null) : null;

  let todayStatus: PredictedHomeState['todayStatus'] = 'no_delivery';

  if (todayLog) {
    if (todayLog.status === 'delivered') {
      todayStatus = 'delivered';
    } else if (todayLog.status === 'out_for_delivery') {
      todayStatus = 'out_for_delivery';
    } else if (todayLog.status === 'skipped' || todayLog.status === 'missed') {
      todayStatus = 'no_delivery';
    } else if (todayLog.status === 'scheduled') {
      if (slot) {
        const prepStart = slot.startMinutes - 10;
        if (nowMins >= slot.endMinutes) {
          // Past slot end — predict delivered, pending API confirmation
          todayStatus = 'delivered';
        } else if (nowMins >= prepStart) {
          todayStatus = 'out_for_delivery';
        } else {
          todayStatus = 'preparing';
        }
      } else {
        todayStatus = 'preparing';
      }
    }
  }

  const totalPurchased = cache.balance?.totalPurchased ?? 0;

  // Base remaining from the last-known server balance
  let passesRemaining = cache.balance
    ? Math.max(0, cache.balance.totalPurchased - cache.balance.totalUsed)
    : 0;

  // The cached balance only counts deliveries the server has recorded, so a
  // delivery predicted from the clock is subtracted here to keep them in step.
  const todayWasTimePredicted =
    todayLog !== null &&
    todayLog.status === 'scheduled' &&
    todayStatus === 'delivered';
  if (todayWasTimePredicted && todayLog !== null) {
    passesRemaining = Math.max(0, passesRemaining - todayLog.quantity);
  }

  return {
    todayStatus,
    totalPurchased,
    passesRemaining,
  };
}
