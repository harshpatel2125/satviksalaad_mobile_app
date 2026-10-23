import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export function useQueryFocusRefetch(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  // A key is usually a fresh array literal each render; the string keeps the
  // callback, and so the focus effect, stable.
  const keyJson = JSON.stringify(queryKey);
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: JSON.parse(keyJson) as unknown[], type: 'active', stale: true });
    }, [queryClient, keyJson]),
  );
}
