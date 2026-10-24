import type { DeliveryStatus, HomeData } from '@/types/api';

import type { HomeCacheData } from './home-cache';

export interface PredictedHomeState {
  /**
   * The cached home data with today's deliveries moved on as the clock says,
   * and the bowls those took off their subscriptions.
   */
  home: HomeData;
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
  const { home } = cache;

  // On the way from just before the slot opens, delivered once it closes,
  // until the server says otherwise.
  function predict(slotId: string): DeliveryStatus {
    const slot = cache.slots.find((s) => s.id === slotId);
    if (!slot) return 'scheduled';
    if (nowMins >= slot.endMinutes) return 'delivered';
    if (nowMins >= slot.startMinutes - 10) return 'out_for_delivery';
    return 'scheduled';
  }

  const deliveredBy = new Map<string, number>();
  const logs = home.logs.map((log) => {
    if (log.delivery_date !== todayStr || log.status !== 'scheduled') return log;
    const status = predict(log.delivery_slot);
    if (status === log.status) return log;
    if (status === 'delivered' && log.subscription_id) {
      deliveredBy.set(log.subscription_id, (deliveredBy.get(log.subscription_id) ?? 0) + log.quantity);
    }
    return { ...log, status };
  });

  // The cached counts only know deliveries the server has recorded.
  const adjust = <T extends { id: string; bowls_left: number }>(sub: T): T => {
    const taken = deliveredBy.get(sub.id) ?? 0;
    return taken > 0 ? { ...sub, bowls_left: Math.max(0, sub.bowls_left - taken) } : sub;
  };

  return {
    home: {
      ...home,
      subscription: home.subscription ? adjust(home.subscription) : null,
      next_subscription: home.next_subscription ? adjust(home.next_subscription) : null,
      subscriptions: home.subscriptions.map(adjust),
      logs,
    },
  };
}
