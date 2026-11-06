import type { ConfigContext, ExpoConfig } from 'expo/config';

// Owner: Account 1. API_BASE_URL and ENV are public values (never secrets).
// API_BASE_URL is the server ORIGIN, e.g. https://example.onrender.com (no /api, no trailing slash).
// The client adds /api itself because GET /health lives at the root, outside /api.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'iPrime',
  slug: 'iprime',
  scheme: 'iprime',
  plugins: [...(config.plugins ?? []), 'expo-secure-store'],
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // PLACEHOLDER package name: confirm with the owner BEFORE the first build.
  // It becomes permanent once the app is published on Google Play.
  android: { ...config.android, package: 'ng.iprime.app' },
  ios: { ...config.ios, bundleIdentifier: 'ng.iprime.app' },
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.API_BASE_URL,
    appEnv: process.env.ENV ?? 'development',
  },
});
