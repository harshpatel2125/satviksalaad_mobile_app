import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { profileApi } from '@/lib/api';
import { clearUser, identifyUser } from '@/lib/analytics';
import {
  readCachedName,
  readProfileIdentityCache,
  writeCachedName,
  writeProfileIdentityCache,
} from '@/lib/home-cache';
import { clearPushToken } from '@/lib/push-notifications';
import {
  onAuthChange,
  revalidateSession,
  signOut as endSession,
  type AuthSession,
  type AuthUser,
} from '@/lib/auth-session';
import { clearQueryCache, queryClient } from '@/lib/query-client';
import { deleteAllSharedFiles } from '@/lib/share-files';
import type { Profile } from '@/types/api';

const ONBOARDING_KEY = 'satvik_onboarding_v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  /** Name available instantly from MMKV cache — before profile API responds */
  cachedName: string | null;
  isLoading: boolean;
  /** False until the profile fetch has settled once this session. Role routing
   * waits for it so a new delivery partner is not sent to the customer tabs. */
  profileFetchAttempted: boolean;
  hasSeenOnboarding: boolean;
  markOnboardingDone: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** null = no name screen needed; '' = needed (no prefill); 'Name' = needed with prefill */
  pendingNameRoute: string | null;
  requestNameScreen: (prefill?: string) => void;
  clearPendingNameRoute: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFetchAttempted, setProfileFetchAttempted] = useState(false);
  const [cachedName, setCachedName] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [pendingNameRoute, setPendingNameRoute] = useState<string | null>(null);

  const isLoading = !authReady || !onboardingReady;

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY)
      .then((v) => setHasSeenOnboarding(v === 'true'))
      .catch((err: unknown) => {
        console.warn('[Auth] SecureStore read failed for onboarding flag:', err);
      })
      .finally(() => setOnboardingReady(true));
  }, []);

  const requestNameScreen = useCallback((prefill?: string) => {
    setPendingNameRoute(prefill ?? '');
  }, []);

  const clearPendingNameRoute = useCallback(() => {
    setPendingNameRoute(null);
  }, []);

  const fetchProfile = useCallback(async (userId?: string, googlePrefill?: string) => {
    try {
      const res = await profileApi.get();
      setProfile(res.profile);
      if (userId && res.profile) {
        identifyUser(userId, Boolean(res.profile.phone));
        writeProfileIdentityCache(userId, {
          full_name: res.profile.full_name,
          phone:     res.profile.phone,
          email:     res.profile.email,
          role:      res.profile.role,
        });
      }
      if (res.profile?.full_name) {
        setCachedName(res.profile.full_name);
        if (userId) writeCachedName(userId, res.profile.full_name);
        setPendingNameRoute(null);
      } else {
        // Preserve any OTP-set value; otherwise use Google name or empty string.
        setPendingNameRoute((prev) => (prev !== null ? prev : (googlePrefill ?? '')));
      }
    } catch {
      // Keep existing profile state (possibly from cache) — don't wipe on transient failure
    } finally {
      setProfileFetchAttempted(true);
    }
  }, []);

  // Fires with the stored session first, then on every sign-in and sign-out.
  // setAuthReady fires as soon as we know the session state; fetchProfile runs
  // in the background so a slow/offline API never blocks the splash screen.
  useEffect(() => {
    const unsubscribe = onAuthChange(
      (newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setAuthReady(true);
        if (newSession?.user) {
          // Sign-out keeps in-memory queries so the screens being left don't
          // flash empty; a different account must not inherit them. The
          // auth screens are showing at this point, so dropping them is invisible.
          if (lastUserIdRef.current && lastUserIdRef.current !== newSession.user.id) {
            queryClient.clear();
          }
          lastUserIdRef.current = newSession.user.id;
          setProfileFetchAttempted(false);
          const googlePrefill = (newSession.user.user_metadata?.full_name as string | undefined) || undefined;
          // Hydrate from cache synchronously — profile header shows instantly before API responds
          const cachedIdentity = readProfileIdentityCache(newSession.user.id);
          if (cachedIdentity) {
            setProfile({ ...cachedIdentity, role: cachedIdentity.role ?? 'customer' });
            if (cachedIdentity.full_name) setCachedName(cachedIdentity.full_name);
          } else {
            const savedName = readCachedName(newSession.user.id);
            if (savedName) setCachedName(savedName);
          }
          void fetchProfile(newSession.user.id, googlePrefill);
        } else {
          setProfileFetchAttempted(false);
          setProfile(null);
          setCachedName(null);
          setPendingNameRoute(null);
          clearUser();
          void clearQueryCache();
          void deleteAllSharedFiles();
        }
      },
    );
    // Checks once per launch that the backend still honours the stored session
    // (it may have expired, or the account been deactivated).
    void revalidateSession();
    return unsubscribe;
  }, [fetchProfile]);

  const markOnboardingDone = useCallback(async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true').catch(() => {});
    setHasSeenOnboarding(true);
  }, []);

  const signOut = useCallback(async () => {
    await clearPushToken().catch(() => {});
    await endSession();
  }, []);

  const userId = user?.id;
  const refreshProfile = useCallback(async () => {
    await fetchProfile(userId);
  }, [fetchProfile, userId]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        cachedName,
        isLoading,
        profileFetchAttempted,
        hasSeenOnboarding,
        markOnboardingDone,
        signOut,
        refreshProfile,
        pendingNameRoute,
        requestNameScreen,
        clearPendingNameRoute,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
