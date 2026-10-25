import { HotUpdater } from "@hot-updater/react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import { useFonts } from 'expo-font';
import * as Linking from "expo-linking";
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { Stack, usePathname, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Animated, AppState, Platform, StyleSheet, View } from "react-native";
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AlertProvider } from "@/context/alert";
import { AuthProvider, useAuth } from '@/context/auth';
import { NetworkProvider } from "@/context/network";
import { ThemePreferenceProvider, useThemePreference } from '@/context/theme-preference';
import { NetworkFallback } from "@/components/network-fallback";
import { UpdateRequired } from "@/components/update-required";
import { getAppConfig, loadAppConfig } from "@/lib/app-config";
import { isVersionBelow } from "@/lib/version";
import { trackScreenView } from "@/lib/analytics";
import { parseIncomingUrl } from "@/lib/deep-links";
import { Image } from 'expo-image';
import { addressesApi, appSettingsApi, deliveriesApi, homeApi, invoicesApi, menuApi, notificationsApi, plansApi, slotsApi, subscriptionsApi } from '@/lib/api';
import { readAddressesCache, writeAddressesCache, readInvoicesCache, writeInvoicesCache, readMenuCache, writeSlotsCache } from '@/lib/home-cache';
import { optimizedImageUrls } from '@/lib/image-url';
import { registerPushToken } from '@/lib/push-notifications';
import { CACHE_TTL, homeStaticPersister, queryClient } from '@/lib/query-client';
export const unstable_settings = {
  anchor: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

// Cold-start image warm-up: read meal image URLs from MMKV synchronously
// (populated during the previous session) and start prefetching before the
// React tree mounts. On first-ever install this is a no-op; on every
// subsequent cold start images begin downloading before any screen renders.
void (() => {
  try {
    const urls = optimizedImageUrls(readMenuCache()?.meals.map((m) => m.image_url) ?? []);
    if (urls.length > 0) {
      Image.prefetch(urls).catch(() => {});
    }
  } catch {}
})();

// Tell React Query when the app comes back to foreground so stale queries
// are refetched on the currently visible tab after the user minimises and returns.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => sub.remove();
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function AppNavigator({ fontsLoaded, onReady }: { fontsLoaded: boolean; onReady: () => void }) {
  // Stable ref so the effect never has onReady as a dependency.
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; });
  const { session, isLoading, hasSeenOnboarding, pendingNameRoute, profile, profileFetchAttempted } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  // A deep link received before sign-in. State, not a ref, so setting it re-runs
  // the auth effect even when auth settles before Linking.getInitialURL() resolves.
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);
  const splashHidden = useRef(false);

  // Derived from segments every render so both the primary redirect effect and
  // the role-correction effect below agree on where the user currently is.
  const inAuth = segments[0] === "(auth)" || segments[0] === "auth";
  const inOnboarding = segments[0] === "(onboarding)";
  const inNameScreen = inAuth && segments[1] === "name";
  const inPublicScreen = segments[0] === "policies" || segments[0] === "policy-webview";


  useEffect(() => {
    trackScreenView(pathname);
  }, [pathname]);

  const navigateToUrl = useCallback(
    (rawUrl: string) => {
      const route = parseIncomingUrl(rawUrl);
      if (route) router.navigate(route as Href);
    },
    [router],
  );

  // Handle any incoming URL: auth callbacks are handled by auth/callback.tsx,
  // everything else is routed to the appropriate screen.
  const handleIncomingUrl = useCallback(
    (rawUrl: string | null) => {
      if (!rawUrl) return;
      if (rawUrl.includes("auth/callback")) return;

      const route = parseIncomingUrl(rawUrl);
      if (!route) return;

      if (session) {
        router.navigate(route as Href);
      } else {
        // Save and navigate after login
        setPendingDeepLink(rawUrl);
      }
    },
    [session, router, setPendingDeepLink],
  );

  // Cold-start: grab the URL that launched the app (Universal Link or custom scheme)
  useEffect(() => {
    void Linking.getInitialURL().then(handleIncomingUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally once — handleIncomingUrl would be stale here but we only need the initial URL

  // Warm-start: app already running, user taps a deep link
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) =>
      handleIncomingUrl(url),
    );
    return () => sub.remove();
  }, [handleIncomingUrl]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void registerPushToken().catch((e: unknown) => {
      console.warn(
        "[PushToken] registration failed (FCM not configured?):",
        e instanceof Error ? e.message : e,
      );
    });
  }, [session?.user?.id]);

  // When a push arrives while the app is in the foreground, refresh the notification list
  // so the bell dot and notifications screen update immediately without polling.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
        const type = data?.type as string | undefined;
        if (type === "delivery_reminder" || type === "out_for_delivery" || type === "delivery_completed" || type === "delivery_missed") {
          void queryClient.invalidateQueries({ queryKey: ['home'] });
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          router.push("/delivery-history" as Href);
        } else if (type === "order_confirmed") {
          void queryClient.invalidateQueries({ queryKey: ['home'] });
          void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          router.push("/(tabs)" as Href);
        } else if (type === "subscription_completed" || type === "trial_completed") {
          void queryClient.invalidateQueries({ queryKey: ['home'] });
          void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          router.push("/plans" as Href);
        } else if (
          type === "subscription_ending" ||
          type === "subscription_expired" ||
          type === "subscription_extended" ||
          type === "refund_processed"
        ) {
          void queryClient.invalidateQueries({ queryKey: ['home'] });
          void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
          router.push("/subscriptions" as Href);
        } else if (type === "invoice_ready") {
          void queryClient.invalidateQueries({ queryKey: ['invoices'] });
          router.push("/invoices" as Href);
        } else if (type === "delivery_digest" || type === "delivery_skipped") {
          router.push("/(delivery-partner)" as Href);
        } else if (data?.screen) {
          router.push(String(data.screen) as Href);
        }
      },
    );
    return () => sub.remove();
  }, [router]);

  // home-static has no auth — prefetch immediately at mount so it's ready before login completes.
  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ['home-static'],
      queryFn: homeApi.static,
      staleTime: CACHE_TTL.homeStatic,
      persister: homeStaticPersister.persisterFn,
    });
  }, []);

  // Prefetches per-user data on sign-in so screens open instantly.
  useEffect(() => {
    if (!session) return;
    void queryClient.prefetchQuery({ queryKey: ['menu'],         queryFn: menuApi.get,         staleTime: CACHE_TTL.menu         });
    void queryClient.prefetchQuery({ queryKey: ['plans'],        queryFn: plansApi.list,        staleTime: CACHE_TTL.plans        });
    // Also refreshes the MMKV copy that an offline launch reads.
    void queryClient
      .fetchQuery({ queryKey: ['slots'], queryFn: slotsApi.list, staleTime: CACHE_TTL.slots })
      .then((res) => { if (res?.data) writeSlotsCache(res.data); })
      .catch(() => {});
    void queryClient.prefetchQuery({ queryKey: ['app-settings'], queryFn: appSettingsApi.get,   staleTime: CACHE_TTL.appSettings  });
    void queryClient.prefetchQuery({ queryKey: ['home'],          queryFn: homeApi.critical,      staleTime: CACHE_TTL.home          });
    void queryClient.prefetchQuery({ queryKey: ['subscriptions'], queryFn: subscriptionsApi.list, staleTime: CACHE_TTL.subscriptions });
    void queryClient.prefetchQuery({ queryKey: ['deliveries'],    queryFn: deliveriesApi.init,    staleTime: CACHE_TTL.deliveries    });
    void queryClient.prefetchQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list, staleTime: CACHE_TTL.notifications });
    void queryClient.prefetchQuery({ queryKey: ['invoices'],      queryFn: invoicesApi.list,      staleTime: CACHE_TTL.invoices      });

    // Prefetch into MMKV only when cache is empty — screens read MMKV synchronously on mount.
    const uid = session.user.id;
    if (uid && readAddressesCache(uid) === null) {
      void addressesApi.list().then((res) => {
        writeAddressesCache(uid, res.data ?? []);
      }).catch(() => {});
    }
    if (uid && readInvoicesCache(uid) === null) {
      void invoicesApi.list().then((res) => {
        writeInvoicesCache(uid, res.data ?? []);
      }).catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (isLoading || !fontsLoaded) return;

    if (!splashHidden.current) {
      splashHidden.current = true;
      void SplashScreen.hideAsync();
    }

    if (!hasSeenOnboarding && !inOnboarding) {
      router.replace("/(onboarding)" as Href);
    } else if (hasSeenOnboarding && !session && !inAuth && !inPublicScreen) {
      router.replace("/(auth)/login" as Href);
    } else if (hasSeenOnboarding && session && inNameScreen) {
      // Stay on name screen — let the user complete it
    } else if (hasSeenOnboarding && session && pendingNameRoute !== null) {
      // Name entry required (new user via OTP, Google OAuth, or app restart)
      const url = pendingNameRoute
        ? (`/(auth)/name?prefill=${encodeURIComponent(pendingNameRoute)}` as Href)
        : ("/(auth)/name" as Href);
      router.replace(url);
    } else if (
      hasSeenOnboarding && session && (inAuth || inOnboarding) &&
      // `profile` is restored from a local cache before the network confirms it.
      // Routing on a stale role sends the user to a group whose endpoints 401,
      // and a 401 signs them out.
      profileFetchAttempted
    ) {
      const role = profile?.role ?? "customer";
      if (role === "delivery_partner") router.replace("/(delivery-partner)" as Href);
      else router.replace("/(tabs)" as Href);
    } else if (hasSeenOnboarding && session && pendingDeepLink) {
      // User just logged in — navigate to the deep link they originally tapped
      setPendingDeepLink(null);
      navigateToUrl(pendingDeepLink);
    }

    // Two rAFs: first lets React Navigation commit the action,
    // second lets the new screen actually paint before the overlay lifts.
    requestAnimationFrame(() => requestAnimationFrame(() => onReadyRef.current()));
  }, [
    navigationState?.key,
    session,
    isLoading,
    fontsLoaded,
    hasSeenOnboarding,
    segments,
    router,
    navigateToUrl,
    pendingNameRoute,
    pendingDeepLink,
    setPendingDeepLink,
    profile,
    profileFetchAttempted,
    inAuth,
    inOnboarding,
    inNameScreen,
    inPublicScreen,
  ]);

  // Keeps each role in its own app. The primary effect only routes by role on
  // the way out of auth, so this catches everything after: a role that
  // resolves late, a role changed server-side, or a route that lands in the
  // wrong group (an unknown deep link falls through to the customer tabs).
  // Only a wrong group is corrected, so shared stack screens are left alone.
  useEffect(() => {
    if (!navigationState?.key || isLoading || !hasSeenOnboarding || !session) return;
    // Stay out of the way while the primary effect is mid-transition
    // (onboarding, auth, name-screen entry) — let it finish first.
    if (inAuth || inOnboarding || inNameScreen) return;

    const role = profile?.role;
    if (!role) return;
    const group = segments[0];
    if (role === "delivery_partner" && group === "(tabs)") {
      router.replace("/(delivery-partner)" as Href);
    } else if (role !== "delivery_partner" && group === "(delivery-partner)") {
      router.replace("/(tabs)" as Href);
    }
  }, [
    navigationState?.key,
    isLoading,
    hasSeenOnboarding,
    session,
    inAuth,
    inOnboarding,
    inNameScreen,
    profile?.role,
    segments,
    router,
  ]);

  return null;
}

function RootLayoutInner() {
  const { effectiveScheme } = useThemePreference();
  const isDark = effectiveScheme === "dark";

  const [fontsLoaded] = useFonts({
    YoungSerif_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  // AppNavigator calls onReady after navigation is dispatched and two animation
  // frames have passed — guaranteeing the correct screen has painted before
  // the overlay lifts, eliminating any flash of the wrong screen.
  const [navigationReady, setNavigationReady] = useState(false);
  const appReady = navigationReady;

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const [overlayGone, setOverlayGone] = useState(false);
  useEffect(() => {
    if (!appReady || overlayGone) return;
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setOverlayGone(true));
  }, [appReady, overlayGone, overlayOpacity]);

  /*
   * Nothing mounts until the fonts are registered. expo-router's Stack does not
   * re-render an already-mounted screen when the root re-renders, so a screen
   * that painted before the fonts loaded would keep the system fallback for the
   * whole session. The native splash is still up meanwhile, and hideAsync() is
   * gated on this same flag.
   */
  if (!fontsLoaded) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "#101814" : "#FBFBF9" },
        ]}
      />
    );
  }

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AppNavigator
        fontsLoaded={fontsLoaded}
        onReady={() => setNavigationReady(true)}
      />
      <Stack
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ gestureEnabled: false, animation: "none" }}
        />
        <Stack.Screen
          name="(auth)"
          options={{ gestureEnabled: false, animation: "none" }}
        />
        <Stack.Screen
          name="(onboarding)"
          options={{ gestureEnabled: false, animation: "none" }}
        />
        <Stack.Screen
          name="(delivery-partner)"
          options={{ gestureEnabled: false, animation: "none" }}
        />
        <Stack.Screen name="delivery-detail" />
        <Stack.Screen name="meal-detail" />
        <Stack.Screen name="video-player" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="add-address" />
        <Stack.Screen name="edit-address" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="support" />
        <Stack.Screen name="cafe-menu" />
        <Stack.Screen name="diet-consultation" />
        <Stack.Screen name="plans" />
        <Stack.Screen name="invoice-detail" />
        <Stack.Screen name="skip-delivery" options={{ animation: "none" }} />
        <Stack.Screen
          name="payment-success"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="delivery-history" />
        <Stack.Screen name="policies" />
        <Stack.Screen name="policy-webview" />
        <Stack.Screen
          name="auth/callback"
          options={{ gestureEnabled: false, animation: "none" }}
        />
      </Stack>
      {/* Overlay matches native splash exactly — fades out smoothly once the app is ready. */}
      {!overlayGone && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? "#101814" : "#FBFBF9",
              opacity: overlayOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}
      <StatusBar style={isDark ? "light" : "dark"} />
    </ThemeProvider>
  );
}

function RootLayout() {
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    void loadAppConfig().then(() => setConfigLoaded(true));
  }, []);

  // The native splash stays up meanwhile, so the version gate and OTA below
  // always see this launch's config.
  if (!configLoaded) return null;

  const platform = Platform.OS === "ios" ? "ios" : "android";
  const { minVersion, storeUrl } = getAppConfig();
  if (isVersionBelow(Constants.expoConfig?.version ?? "0.0.0", minVersion[platform])) {
    return <UpdateRequired storeUrl={storeUrl[platform]} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ThemePreferenceProvider>
            <NetworkProvider>
              <AlertProvider>
                <RootLayoutInner />
                <NetworkFallback />
              </AlertProvider>
            </NetworkProvider>
          </ThemePreferenceProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

export default HotUpdater.wrap({
  baseURL: async () => (await loadAppConfig()).otaUrl,
  updateStrategy: "appVersion",
})(RootLayout);
