import { existsSync } from "node:fs";
import path from "node:path";

import type { ConfigContext, ExpoConfig } from "expo/config";

const FIREBASE_PLUGINS = new Set(["@react-native-firebase/app", "@react-native-firebase/crashlytics"]);

// Firebase (analytics, crash reports) is switched on only once the project's
// GoogleService-Info.plist and google-services.json are in place. Without them
// the app still builds and runs; lib/analytics.ts falls back to no-ops.
export default ({ config }: ConfigContext): ExpoConfig => {
  const hasFirebase =
    existsSync(path.join(__dirname, "GoogleService-Info.plist")) &&
    existsSync(path.join(__dirname, "google-services.json"));
  if (hasFirebase) return config as ExpoConfig;

  const { googleServicesFile: _ios, ...ios } = config.ios ?? {};
  const { googleServicesFile: _android, ...android } = config.android ?? {};
  return {
    ...config,
    ios,
    android,
    plugins: (config.plugins ?? []).filter((p) => !FIREBASE_PLUGINS.has(String(Array.isArray(p) ? p[0] : p))),
  } as ExpoConfig;
};
