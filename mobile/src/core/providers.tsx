// Owner: Account 1. Wraps the whole app: theme, server state, toasts, session restore, network monitor.
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ThemeProvider, ToastProvider } from '@/design';
import { session } from './api';
import { startNetworkMonitor } from './network';
import { createQueryClient } from './query';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => {
    startNetworkMonitor();
    void session.init();
  }, []);
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
