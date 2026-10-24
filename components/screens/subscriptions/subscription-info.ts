import { useQuery, type QueryClient } from '@tanstack/react-query';

import type { AlertButton } from '@/context/alert';
import { ApiError, subscriptionsApi } from '@/lib/api';
import { CACHE_TTL } from '@/lib/query-client';
import type { DayItemView } from '@/lib/subscription-view';
import type { DeliveriesActionResponse, SubscriptionPreviewResponse } from '@/types/api';

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionsApi.list,
    staleTime: CACHE_TTL.subscriptions,
    enabled,
  });
}

/** Puts a deliveries change's reply into every screen that shows it. */
export function storeActionResult(queryClient: QueryClient, result: DeliveriesActionResponse): void {
  queryClient.setQueryData(['deliveries'], { success: true, data: result.data });
  queryClient.setQueryData(['home'], { success: true, data: result.homeData });
  void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  void queryClient.invalidateQueries({ queryKey: ['profile'] });
}

/** What the delivery screen needs to show one item without loading it again. */
export function deliveryDetailParams(item: DayItemView, addressLine?: string): Record<string, string> {
  return {
    id: item.id,
    date: item.delivery_date,
    slot: item.delivery_slot,
    status: item.status,
    quantity: String(item.quantity),
    mealName: item.name,
    mealImageUrl: item.image_url ?? '',
    categoryName: item.categoryName,
    unitSingular: item.unit.singular,
    unitPlural: item.unit.plural,
    ...(addressLine ? { addressLine } : {}),
  };
}

/** Why a plan cannot be bought, as the server put it. */
export function refusalText(preview: Pick<SubscriptionPreviewResponse, 'reason' | 'code'>): string {
  if (preview.reason) return preview.reason;
  if (preview.code === 'trial_used') return "You've already had the trial. Choose another plan to continue.";
  if (preview.code === 'renewal_exists') return 'Your next subscription is already booked. You can buy another once it has started.';
  return "This plan can't be bought right now.";
}

/** The server's reason when it refused, otherwise `fallback`. */
export function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** A change refused for passing the last date already tells them to message us; this offers the way. */
export function refusalButtons(err: unknown, onMessageUs: () => void): AlertButton[] | undefined {
  if (!(err instanceof ApiError) || err.code !== 'past_last_date') return undefined;
  return [
    { text: 'OK', style: 'cancel' },
    { text: 'Message us', onPress: onMessageUs },
  ];
}
