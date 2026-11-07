// Owner: Account 1. Wake-up probe: Render's free server sleeps after ~15 minutes and can take about a minute to wake.
// GET /health lives at the server ORIGIN (not under /api). Pure logic; fetch, time and sleep are injected.

export type WakeFailure = 'timeout' | 'offline' | 'aborted';
export type WakeState =
  | { phase: 'idle' }
  | { phase: 'checking'; elapsedMs: number }
  | { phase: 'waking'; elapsedMs: number; attempt: number }
  | { phase: 'ready'; elapsedMs: number; woke: boolean; attempts: number }
  | { phase: 'failed'; elapsedMs: number; reason: WakeFailure };

export interface WakeOptions {
  healthUrl: string;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onState: (s: WakeState) => void;
  isOnline?: () => boolean;
  signal?: AbortSignal;
  /** How long one try may take before we try again. */
  attemptTimeoutMs?: number;
  /** Pause between tries while waking. */
  pollMs?: number;
  /** Give up after this long in total. */
  maxWaitMs?: number;
  /** Replies faster than this are "awake already"; slower ones show the waking screen. */
  quickMs?: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves with the final state (ready or failed). Intermediate states go to onState. */
export async function runWakeProbe(o: WakeOptions): Promise<WakeState> {
  const fetchFn = o.fetchFn ?? fetch;
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? realSleep;
  const attemptTimeoutMs = o.attemptTimeoutMs ?? 8000;
  const pollMs = o.pollMs ?? 3000;
  const maxWaitMs = o.maxWaitMs ?? 90_000;
  const quickMs = o.quickMs ?? 3000;
  const start = now();
  const elapsed = () => now() - start;
  const finish = (s: WakeState) => { o.onState(s); return s; };

  o.onState({ phase: 'checking', elapsedMs: 0 });

  for (let attempt = 1; ; attempt++) {
    if (o.signal?.aborted) return finish({ phase: 'failed', elapsedMs: elapsed(), reason: 'aborted' });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), attemptTimeoutMs);
    const onAbort = () => ctrl.abort();
    o.signal?.addEventListener('abort', onAbort);
    let ok = false;
    try {
      const res = await fetchFn(o.healthUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctrl.signal });
      ok = res.ok;
    } catch {
      ok = false; // offline, refused, or this try timed out: handled below
    } finally {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
    }

    if (ok) {
      const ms = elapsed();
      return finish({ phase: 'ready', elapsedMs: ms, woke: ms > quickMs || attempt > 1, attempts: attempt });
    }
    if (o.signal?.aborted) return finish({ phase: 'failed', elapsedMs: elapsed(), reason: 'aborted' });
    if (o.isOnline && !o.isOnline()) return finish({ phase: 'failed', elapsedMs: elapsed(), reason: 'offline' });
    if (elapsed() >= maxWaitMs) return finish({ phase: 'failed', elapsedMs: elapsed(), reason: 'timeout' });

    // Not ready yet. Past the quick window, tell the person the server is waking.
    o.onState(elapsed() >= quickMs ? { phase: 'waking', elapsedMs: elapsed(), attempt } : { phase: 'checking', elapsedMs: elapsed() });
    await sleep(pollMs);
  }
}
