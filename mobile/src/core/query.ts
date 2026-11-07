// Owner: Account 1. React Query defaults for the whole app.
// Offline persistence (keeping cached lists across restarts) is NOT included yet: it needs two more packages and a privacy decision on what may be stored.
import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errors';
import { backoffDelay, DEFAULT_RETRY } from './retry';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        // Show saved data while offline instead of an error.
        networkMode: 'offlineFirst',
        retry: (count, error) => {
          // Do not repeat requests that were refused (wrong input, signed out, not allowed).
          if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 429) return false;
          return count < 2;
        },
        retryDelay: (n) => backoffDelay(n, DEFAULT_RETRY),
      },
      mutations: { retry: false, networkMode: 'online' },
    },
  });
}
