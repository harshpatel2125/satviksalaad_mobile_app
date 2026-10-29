import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  View,
} from 'react-native';
import WebView from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';
import { ScreenHeader } from '@/components/ui/screen-header';

const SITE_URL = 'https://satviksalaad.com';
const SITE_HOSTS = ['satviksalaad.com', 'www.satviksalaad.com', 'satviksalaad.in', 'www.satviksalaad.in'];

// Parsed by hand: React Native's URL takes the host from after an "@" anywhere
// in the string, so https://evil.example/?@satviksalaad.com would pass.
function isSiteUrl(url: string): boolean {
  const host = /^https:\/\/([^/?#@:\\]+)(?:[/?#]|$)/i.exec(url)?.[1];
  return host !== undefined && SITE_HOSTS.includes(host.toLowerCase());
}

export default function PolicyWebViewScreen() {
  const rawParams = useLocalSearchParams<{ url: string | string[]; title: string | string[] }>();
  const requestedUrl = Array.isArray(rawParams.url) ? rawParams.url[0] : rawParams.url;
  const url = requestedUrl && isSiteUrl(requestedUrl) ? requestedUrl : SITE_URL;
  const title = Array.isArray(rawParams.title) ? (rawParams.title[0] ?? 'Policy')               : (rawParams.title ?? 'Policy');
  const { colors } = useTheme();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);

  const handleBack = () => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      router.back();
    }
  };

  // Inject CSS to make the page mobile-responsive and match app style. A page with
  // its own viewport is already built for phones, and the image rule would shrink its logo.
  const INJECTED_CSS = `
    (function() {
      if (document.querySelector('meta[name="viewport"]')) return;
      var meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
      document.head.appendChild(meta);

      var style = document.createElement('style');
      style.textContent = \`
        * { box-sizing: border-box !important; }
        body { max-width: 100vw !important; overflow-x: hidden !important; word-break: break-word !important; }
        img, video, iframe, table { max-width: 100% !important; height: auto !important; }
        pre, code { white-space: pre-wrap !important; word-break: break-all !important; }
      \`;
      document.head.appendChild(style);
    })();
    true;
  `;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title={title} onBack={handleBack} />

      {/* Progress bar */}
      {loading && (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={[styles.webview, { backgroundColor: colors.background }]}
        injectedJavaScript={INJECTED_CSS}
        onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onShouldStartLoadWithRequest={(req) => {
          if (req.isTopFrame === false || isSiteUrl(req.url)) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        startInLoadingState={false}
        renderLoading={() => (
          <View style={[styles.loader, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        allowsBackForwardNavigationGestures
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressBar: {
    height: 2,
  },

  webview: { flex: 1 },

  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
