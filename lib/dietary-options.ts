import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { dietaryOptionsApi } from '@/lib/api';
import { readDietaryOptionsCache, writeDietaryOptionsCache } from '@/lib/home-cache';
import { CACHE_TTL } from '@/lib/query-client';
import type { DietaryOption } from '@/types/api';

// The admin edits these options, so labels are never hardcoded. MMKV keeps
// the last successful fetch for offline use.

export function useDietaryOptions(): DietaryOption[] {
  const [cached] = React.useState(() => readDietaryOptionsCache());
  const { data } = useQuery({
    queryKey: ['dietary-options'],
    queryFn: dietaryOptionsApi.list,
    staleTime: CACHE_TTL.dietaryOptions,
  });
  React.useEffect(() => {
    if (data?.data) writeDietaryOptionsCache(data.data);
  }, [data]);
  return data?.data ?? cached ?? [];
}
