// Owner: Account 1. The one API client and the one session for the whole app. Other accounts import from here.
import { serverClock } from './clock';
import { getConfig } from './config';
import { createApiClient, type ApiClient } from './http';
import { createSessionManager } from './session';
import { secureTokenStorage } from './tokenStorage';

export const session = createSessionManager({
  storage: secureTokenStorage,
  // POST /api/auth/logout ends exactly this token on the server. It is sent once with a short timeout.
  logout: async (token) => { await getApi().post('/auth/logout', { token, timeoutMs: 5000 }); },
});

let client: ApiClient | undefined;
/** Created on first use, because src/core/config.ts throws if API_BASE_URL is not set. */
export function getApi(): ApiClient {
  client ??= createApiClient({
    baseUrl: getConfig().apiUrl,
    getToken: () => session.getToken(),
    onUnauthorized: ({ token }) => { void session.handleUnauthorized(token); },
    onAccountBlocked: ({ token, code, message }) => { void session.handleBlocked(token, code, message); },
    clock: serverClock,
    log: __DEV__ ? (line) => console.debug(line) : undefined,
  });
  return client;
}
