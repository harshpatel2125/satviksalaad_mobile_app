import { QueryClient } from '@tanstack/react-query';
import { experimental_createQueryPersister } from '@tanstack/react-query-persist-client';
import { storage } from './storage';

export const CACHE_TTL = {
  home:                  5 * 60 * 1000,
  homeStatic:           30 * 60 * 1000,
  subscriptions:         5 * 60 * 1000,
  deliveries:            5 * 60 * 1000,
  profile:               5 * 60 * 1000,
  notifications:         5 * 60 * 1000,
  menu:                 30 * 60 * 1000,
  videos:               30 * 60 * 1000,
  zones:                60 * 60 * 1000,
  invoices:             15 * 60 * 1000,
  plans:                30 * 60 * 1000,
  slots:                60 * 60 * 1000,
  dietaryOptions:       60 * 60 * 1000,
  appSettings:          10 * 60 * 1000,
  notificationPrefs:    10 * 60 * 1000,
} as const;

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.remove(key); },
};

export const asyncPersister = experimental_createQueryPersister({
  storage: mmkvStorage,
  // As long as the longest staleTime of the queries persisted with it.
  maxAge: 30 * 60 * 1000,
  // A new value drops everything persisted under the old one; change it when a
  // persisted response changes shape.
  buster: '4',
  prefix: 'ss-',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

export const homeStaticPersister = experimental_createQueryPersister({
  storage: mmkvStorage,
  maxAge: 30 * 60 * 1000,
  prefix: 'ss-hs-',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// Wipes every persisted cache so the next account on this device starts fresh.
// In-memory queries are left alone: clearing them while the tab screens are
// still mounted flashes a loading state before the login screen appears.
export function clearQueryCache(): void {
  try {
    const allKeys: string[] = storage.getAllKeys();
    allKeys.filter((k: string) => k.startsWith('ss-')).forEach((k: string) => storage.remove(k));
  } catch {}
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message === 'Session expired. Please sign in again.') return false;
        return failureCount < 1;
      },
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
