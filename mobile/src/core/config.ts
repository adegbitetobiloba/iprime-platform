// Owner: Account 1. Reads public build-time settings; fails loudly on a bad setup.
import Constants from 'expo-constants';

export type AppEnv = 'development' | 'staging' | 'production';
export interface AppConfig {
  env: AppEnv;
  /** Server origin without trailing slash, e.g. https://x.onrender.com. GET /health lives here. */
  origin: string;
  /** origin + "/api". All JSON endpoints live here. */
  apiUrl: string;
}

const ENVS: readonly AppEnv[] = ['development', 'staging', 'production'];

export function parseConfig(extra: Record<string, unknown> | undefined): AppConfig {
  const env = String(extra?.appEnv ?? 'development') as AppEnv;
  if (!ENVS.includes(env)) throw new Error(`ENV must be one of ${ENVS.join(', ')} (got "${env}")`);

  const raw = String(extra?.apiBaseUrl ?? '').trim();
  if (!raw) throw new Error('API_BASE_URL is not set');
  if (/REPLACE/i.test(raw)) throw new Error('API_BASE_URL is still a placeholder: edit eas.json or .env');
  if (!/^https?:\/\//i.test(raw)) throw new Error('API_BASE_URL must start with http:// or https://');
  if (env !== 'development' && !/^https:\/\//i.test(raw)) {
    throw new Error('API_BASE_URL must use https outside development');
  }
  const origin = raw.replace(/\/+$/, '');
  if (/\/api$/i.test(origin)) {
    throw new Error('API_BASE_URL must be the server origin without /api (the client adds it)');
  }
  return { env, origin, apiUrl: `${origin}/api` };
}

let cached: AppConfig | undefined;
export function getConfig(): AppConfig {
  cached ??= parseConfig(Constants.expoConfig?.extra as Record<string, unknown> | undefined);
  return cached;
}
