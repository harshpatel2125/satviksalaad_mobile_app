import { HotUpdater, insights } from '@hot-updater/react-native';

import { loadAppConfig } from './app-config';

export const hotUpdater = HotUpdater.init({
  // The website can move installed apps to another update server; each build carries its own default.
  baseURL: async () => (await loadAppConfig()).otaUrl,
  requestHeaders: { 'x-api-key': process.env.EXPO_PUBLIC_HOT_UPDATER_API_KEY ?? '' },
  plugins: [insights()],
});
