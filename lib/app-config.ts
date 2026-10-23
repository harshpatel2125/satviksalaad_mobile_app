import { BASE_URL } from './base-url';
import { storage } from './storage';

export type AppConfig = {
  razorpayKeyId: string;
  otaUrl: string;
  minVersion: { ios: string; android: string };
  storeUrl: { ios: string; android: string };
};

const BUILT_IN: AppConfig = {
  razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '',
  otaUrl: process.env.EXPO_PUBLIC_OTA_URL ?? '',
  minVersion: { ios: '0.0.0', android: '0.0.0' },
  storeUrl: {
    ios: process.env.EXPO_PUBLIC_APP_STORE_URL ?? '',
    android: process.env.EXPO_PUBLIC_PLAY_STORE_URL ?? '',
  },
};

const CACHE_KEY = 'app-config';
const FETCH_TIMEOUT_MS = 1500;

type Raw = Record<string, unknown>;

const asObject = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});
const pick = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.length > 0 ? v : fallback;

// Field by field, so a server that omits or mangles one value cannot blank out
// the rest.
function withOverrides(raw: unknown): AppConfig {
  const r = asObject(raw);
  const minVersion = asObject(r.minVersion);
  const storeUrl = asObject(r.storeUrl);
  return {
    razorpayKeyId: pick(r.razorpayKeyId, BUILT_IN.razorpayKeyId),
    otaUrl: pick(r.otaUrl, BUILT_IN.otaUrl),
    minVersion: {
      ios: pick(minVersion.ios, BUILT_IN.minVersion.ios),
      android: pick(minVersion.android, BUILT_IN.minVersion.android),
    },
    storeUrl: {
      ios: pick(storeUrl.ios, BUILT_IN.storeUrl.ios),
      android: pick(storeUrl.android, BUILT_IN.storeUrl.android),
    },
  };
}

// The server's raw payload is cached rather than the merged result, so a field
// the server stops sending falls back to this build's value, not a stale one.
function readCached(): AppConfig {
  try {
    const raw = storage.getString(CACHE_KEY);
    return withOverrides(raw ? JSON.parse(raw) : null);
  } catch {
    return BUILT_IN;
  }
}

async function fetchRemote(): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v1/app-config`, { signal: controller.signal, credentials: 'omit' });
    if (!res.ok) return null;
    const body = asObject(await res.json());
    return body.success === true ? body.data ?? null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let current = readCached();
let loading: Promise<AppConfig> | null = null;

export function getAppConfig(): AppConfig {
  return current;
}

/**
 * Fetches the latest config once per launch; concurrent callers share the one
 * request. Never rejects: on failure it resolves with the cached config.
 */
export function loadAppConfig(): Promise<AppConfig> {
  loading ??= fetchRemote().then((raw) => {
    if (raw) {
      current = withOverrides(raw);
      try {
        storage.set(CACHE_KEY, JSON.stringify(raw));
      } catch {}
    }
    return current;
  });
  return loading;
}
