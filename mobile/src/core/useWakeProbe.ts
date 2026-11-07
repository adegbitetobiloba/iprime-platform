// Owner: Account 1. Runs the wake-up probe against `${origin}/health` and reports its state to a screen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfig } from './config';
import { isOnline } from './network';
import { runWakeProbe, type WakeState } from './wake';

export function useWakeProbe(opts: { auto?: boolean } = {}) {
  const [state, setState] = useState<WakeState>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    // getConfig() throws on a bad API_BASE_URL: that is a setup mistake, so let it show loudly in development.
    const healthUrl = `${getConfig().origin}/health`;
    void runWakeProbe({ healthUrl, signal: ctrl.signal, isOnline, onState: (s) => { if (!ctrl.signal.aborted) setState(s); } });
  }, []);

  useEffect(() => {
    if (opts.auto) start();
    return () => abort.current?.abort();
  }, [opts.auto, start]);

  return { state, start };
}
