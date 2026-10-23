import * as SecureStore from 'expo-secure-store';

import { BASE_URL } from './base-url';
import { storage } from './storage';

/** The signed-in person, in the shape the screens read. */
export type AuthUser = {
  id: string;
  /** For phone logins this is the synthetic `<phone>@auth.satviksalaad.in`. */
  email: string;
  phone: string | null;
  created_at: string;
  user_metadata: { full_name?: string };
};

export type AuthSession = {
  /** Bearer token for API calls. */
  access_token: string;
  user: AuthUser;
};

const STORAGE_KEY = 'satvik_auth_session';

// SecureStore caps a value at 2048 bytes, so larger values are chunked.
const CHUNK = 1800;

// Rewriting chunks in place is not atomic: a force-kill mid-write would leave
// new and stale chunks mixed, and the session unreadable on every later launch.
// Each write therefore goes to the inactive one of two slots (A/B), and a single
// small pointer write switches to it only once the slot is complete.
type Slot = 'A' | 'B';

async function readSlot(slotKey: string): Promise<string | null> {
  const n = await SecureStore.getItemAsync(`${slotKey}__n`);
  if (n === null) return SecureStore.getItemAsync(slotKey);
  const parts: string[] = [];
  for (let i = 0; i < parseInt(n, 10); i++) {
    parts.push((await SecureStore.getItemAsync(`${slotKey}__${i}`)) ?? '');
  }
  return parts.join('');
}

async function deleteSlot(slotKey: string): Promise<void> {
  const n = await SecureStore.getItemAsync(`${slotKey}__n`);
  if (n !== null) {
    for (let i = 0; i < parseInt(n, 10); i++) {
      await SecureStore.deleteItemAsync(`${slotKey}__${i}`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(`${slotKey}__n`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(slotKey).catch(() => {});
}

async function writeSlot(slotKey: string, value: string): Promise<void> {
  await deleteSlot(slotKey);
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(slotKey, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(`${slotKey}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(`${slotKey}__n`, String(count));
}

async function readStored(): Promise<AuthSession | null> {
  try {
    const ptr = (await SecureStore.getItemAsync(`${STORAGE_KEY}__ptr`)) as Slot | null;
    if (!ptr) return null;
    const raw = await readSlot(`${STORAGE_KEY}__${ptr}`);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

async function writeStored(session: AuthSession): Promise<void> {
  try {
    const current = (await SecureStore.getItemAsync(`${STORAGE_KEY}__ptr`)) as Slot | null;
    const target: Slot = current === 'A' ? 'B' : 'A';
    await writeSlot(`${STORAGE_KEY}__${target}`, JSON.stringify(session));
    await SecureStore.setItemAsync(`${STORAGE_KEY}__ptr`, target);
  } catch (e) {
    console.warn('[auth] could not persist the session', e);
  }
}

async function clearStored(): Promise<void> {
  await deleteSlot(`${STORAGE_KEY}__A`);
  await deleteSlot(`${STORAGE_KEY}__B`);
  await SecureStore.deleteItemAsync(`${STORAGE_KEY}__ptr`).catch(() => {});
}

// ─── Session state ────────────────────────────────────────────────────────────

let current: AuthSession | null = null;
let changedSinceLaunch = false;
let restored: Promise<void> | null = null;
const listeners = new Set<(session: AuthSession | null) => void>();

function emit(session: AuthSession | null): void {
  current = session;
  changedSinceLaunch = true;
  for (const listener of listeners) listener(session);
}

/** The session on this device, restored from secure storage on first call. */
export function getSession(): Promise<AuthSession | null> {
  restored ??= readStored().then((stored) => {
    // A sign-in or sign-out that finished first is newer than what was on disk.
    if (!changedSinceLaunch) current = stored;
  });
  return restored.then(() => current);
}

export async function getAccessToken(): Promise<string | null> {
  return (await getSession())?.access_token ?? null;
}

/** Called with the current session at once, then on every sign-in and sign-out. */
export function onAuthChange(listener: (session: AuthSession | null) => void): () => void {
  listeners.add(listener);
  void getSession().then((session) => {
    if (listeners.has(listener)) listener(session);
  });
  return () => {
    listeners.delete(listener);
  };
}

type ServerUser = {
  id: string;
  email: string;
  name?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
};

function toAuthUser(user: ServerUser): AuthUser {
  // Phone logins are created with the number as their name; that is not a name.
  const name = user.name?.trim();
  const isRealName = Boolean(name) && name !== user.phoneNumber && !/^\+?\d+$/.test(name!);
  return {
    id: user.id,
    email: user.email,
    phone: user.phoneNumber ?? null,
    created_at: user.createdAt,
    user_metadata: isRealName ? { full_name: name } : {},
  };
}

type Validation = { session: AuthSession | null; reachable: boolean };

async function fetchServerSession(token: string): Promise<Validation> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/get-session`, {
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { session: null, reachable: true };
    if (!res.ok) return { session: null, reachable: false };
    const body = (await res.json()) as { user?: ServerUser } | null;
    if (!body?.user) return { session: null, reachable: true };
    return { session: { access_token: token, user: toAuthUser(body.user) }, reachable: true };
  } catch {
    return { session: null, reachable: false };
  }
}

/**
 * Signs in with a token the backend issued (OTP verify, Apple, Google).
 * Rejects when the backend does not accept it.
 */
export async function signInWithToken(token: string): Promise<AuthSession> {
  const { session } = await fetchServerSession(token);
  if (!session) throw new Error('Could not start your session. Please try again.');
  await writeStored(session);
  emit(session);
  return session;
}

/**
 * Re-checks the stored session with the backend. A server that answers "no
 * session" signs the device out; an unreachable server keeps the stored one,
 * so the app still opens offline.
 */
export async function revalidateSession(): Promise<AuthSession | null> {
  const stored = await getSession();
  if (!stored) return null;
  const { session, reachable } = await fetchServerSession(stored.access_token);
  if (session) {
    await writeStored(session);
    if (JSON.stringify(session.user) !== JSON.stringify(stored.user)) emit(session);
    return session;
  }
  if (reachable) await clearSession();
  return reachable ? null : stored;
}

/** Ends the session on the backend (best effort) and on this device. */
export async function signOut(): Promise<void> {
  const token = current?.access_token ?? (await getAccessToken());
  if (token) {
    await fetch(`${BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      // A stored cookie would make the backend demand an Origin header and
      // refuse the sign-out, leaving the token valid.
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
  }
  await clearSession();
}

/** Forgets the session on this device only, e.g. after the backend rejected it. */
export async function clearSession(): Promise<void> {
  await clearStored();
  emit(null);
}

// ─── Google hand-off ──────────────────────────────────────────────────────────

// Kept on disk: Android may kill the app while the browser is open, and the
// redirect then cold-starts it.
const GOOGLE_PENDING_KEY = 'google_signin_pending_until';
// The backend's hand-off cookie lives as long.
const GOOGLE_PENDING_MS = 10 * 60 * 1000;

/** Records that this app started a Google sign-in; a returned token is trusted only then. */
export function markGoogleSignInPending(): void {
  storage.set(GOOGLE_PENDING_KEY, Date.now() + GOOGLE_PENDING_MS);
}

export function isGoogleSignInPending(): boolean {
  return (storage.getNumber(GOOGLE_PENDING_KEY) ?? 0) > Date.now();
}

export function clearGoogleSignInPending(): void {
  storage.remove(GOOGLE_PENDING_KEY);
}
