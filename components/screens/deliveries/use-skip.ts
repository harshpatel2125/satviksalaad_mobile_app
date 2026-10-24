import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';

import { errorText, refusalButtons, storeActionResult } from '@/components/screens/subscriptions/subscription-info';
import { useAlert } from '@/context/alert';
import { trackDeliverySkipped } from '@/lib/analytics';
import { deliveriesApi } from '@/lib/api';

/** One item by `logId`, or every item of `date`. */
export type SkipRequest = { action: 'skip' | 'unskip'; date?: string; logId?: string };

/**
 * Skips or brings back deliveries and says what happened in the server's own
 * words; after a skip the message offers a one-tap undo. `busy` names the
 * request in flight, by the key it was run with.
 */
export function useSkip() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [busy, setBusy] = React.useState<string | null>(null);
  const running = React.useRef(false);

  const run = React.useCallback(
    async (key: string, request: SkipRequest): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setBusy(key);
      try {
        const result = await deliveriesApi.action(request);
        storeActionResult(queryClient, result);
        const changed = result.results.filter((r) => r.changed);
        const refused = result.results.some((r) => r.error);
        if (request.action === 'unskip') {
          showAlert(refused ? 'Not everything came back' : 'Done', result.message ?? 'Your delivery is back on.');
          return;
        }
        for (const item of changed) trackDeliverySkipped(item.id, 'no_reason');
        showAlert(
          refused ? 'Not everything was skipped' : 'Done',
          result.message ?? 'Skipped.',
          changed.length > 0
            ? [
                { text: 'OK', style: 'cancel' },
                { text: 'Undo', onPress: () => run(key, { ...request, action: 'unskip' }) },
              ]
            : undefined,
        );
      } catch (err) {
        showAlert(
          request.action === 'skip' ? 'Not skipped' : 'Not brought back',
          errorText(err, 'Something went wrong. Please try again.'),
          refusalButtons(err, () => router.push('/support')),
        );
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [queryClient, router, showAlert],
  );

  return { busy, run };
}
