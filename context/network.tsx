import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getAccessToken } from '@/lib/auth-session';
import { BASE_URL } from '@/lib/base-url';
import { retryEngine } from '@/lib/retry-engine';

// ─── Error types ──────────────────────────────────────────────────────────────

export type NetworkErrorKind = 'no_internet' | 'server_down' | 'timeout';

export interface NetworkErrorState {
  kind: NetworkErrorKind;
  secondsLeft: number;
  attempt: number;
}

// ─── Module-level reporter, callable outside React ───────────────────────────

let _report: ((err: unknown) => void) | null = null;

export function reportNetworkError(err: unknown): void {
  _report?.(err);
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NetworkContextValue {
  networkError: NetworkErrorState | null;
  retryNow: () => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

// ─── Error classification ─────────────────────────────────────────────────────

// Probe a known-reliable public endpoint to tell apart "no internet" from
// "our backend is down / bad URL". 3s timeout is intentionally short.
async function hasInternet(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 3_000);
    await fetch('https://www.google.com', { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(id);
    return true;
  } catch {
    return false;
  }
}

async function classify(err: unknown): Promise<NetworkErrorKind> {
  if (err instanceof Error && err.name === 'AbortError') return 'timeout';

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout')) return 'timeout';
    // "Network request failed" / "Failed to fetch" could be no-internet OR bad URL.
    // Do a secondary probe to distinguish them.
    const isNetworkLevelError =
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network error');

    if (isNetworkLevelError) {
      return (await hasInternet()) ? 'server_down' : 'no_internet';
    }
  }

  return 'server_down';
}

// ─── Health check ─────────────────────────────────────────────────────────────

async function checkReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/api/v1/app-settings`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'omit',
      signal: controller.signal,
    });
    if (res.status >= 500) return false;
    // Captive portals and proxies answer too, so only the API's own JSON
    // envelope counts. A 401 (signed out) still proves the server is up.
    const body = (await res.json()) as { success?: unknown } | null;
    return typeof body?.success === 'boolean';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkError, setNetworkError] = useState<NetworkErrorState | null>(null);
  const kindRef = useRef<NetworkErrorKind>('server_down');

  const startEngine = useCallback((kind: NetworkErrorKind) => {
    kindRef.current = kind;
    setNetworkError({ kind, secondsLeft: 1, attempt: 0 });

    retryEngine.start(
      checkReachable,
      () => setNetworkError(null),
      (secondsLeft, attempt) => {
        setNetworkError({ kind: kindRef.current, secondsLeft, attempt });
      },
    );
  }, []);

  const report = useCallback(
    (err: unknown) => {
      if (retryEngine.isRunning) return;
      void classify(err).then((kind) => startEngine(kind));
    },
    [startEngine],
  );

  const retryNow = useCallback(() => {
    retryEngine.stop();
    const kind = kindRef.current;
    setNetworkError({ kind, secondsLeft: 0, attempt: 0 });
    void checkReachable().then((ok) => {
      if (ok) {
        setNetworkError(null);
      } else {
        startEngine(kind);
      }
    });
  }, [startEngine]);

  useEffect(() => {
    _report = report;
    return () => { _report = null; };
  }, [report]);

  useEffect(() => () => { retryEngine.stop(); }, []);

  return (
    <NetworkContext.Provider value={{ networkError, retryNow }}>
      {children}
    </NetworkContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within <NetworkProvider>');
  return ctx;
}
