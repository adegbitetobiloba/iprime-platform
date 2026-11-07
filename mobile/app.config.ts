import type { ConfigContext, ExpoConfig } from 'expo/config';

// Owner: Account 1. API_BASE_URL and ENV are public values (never secrets).
// API_BASE_URL is the server ORIGIN, e.g. https://example.onrender.com (no /api, no trailing slash).
// The client adds /api itself because GET /health lives at the root, outside /api.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'iPrime',
  slug: 'iprime',
  scheme: 'iprime',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  android: { ...config.android, package: 'com.primeexcelerate.iprime' },
  ios: { ...config.ios, bundleIdentifier: 'com.primeexcelerate.iprime' },
  plugins: [...(config.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== 'expo-secure-store'), 'expo-secure-store'],
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.API_BASE_URL,
    appEnv: process.env.ENV ?? 'development',
  },
});
