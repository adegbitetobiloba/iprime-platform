import { runWakeProbe, type WakeState } from './wake';

type Step = 'ok' | 'down' | 'throw';
function setup(steps: Step[], perCallMs = 500) {
  let t = 0;
  const states: WakeState[] = [];
  let calls = 0;
  const fetchFn = (async () => {
    t += perCallMs;
    const s = steps[Math.min(calls, steps.length - 1)]!;
    calls++;
    if (s === 'throw') throw new TypeError('Network request failed');
    return { ok: s === 'ok', status: s === 'ok' ? 200 : 503 } as Response;
  }) as unknown as typeof fetch;
  return {
    states,
    calls: () => calls,
    opts: { healthUrl: 'https://x.test/health', fetchFn, now: () => t, sleep: async (ms: number) => { t += ms; }, onState: (s: WakeState) => { states.push(s); } },
  };
}

describe('runWakeProbe', () => {
  it('is ready straight away when the server is awake', async () => {
    const s = setup(['ok']);
    const end = await runWakeProbe(s.opts);
    expect(end).toMatchObject({ phase: 'ready', woke: false, attempts: 1 });
    expect(s.states.map((x) => x.phase)).toEqual(['checking', 'ready']);
  });
  it('shows the waking state while the server sleeps, then becomes ready', async () => {
    const s = setup(['down', 'down', 'down', 'throw', 'ok']);
    const end = await runWakeProbe({ ...s.opts, pollMs: 3000, quickMs: 3000 });
    expect(end).toMatchObject({ phase: 'ready', woke: true });
    expect(s.states.some((x) => x.phase === 'waking')).toBe(true);
    expect(s.calls()).toBe(5);
  });
  it('gives up after the maximum wait', async () => {
    const s = setup(['down']);
    const end = await runWakeProbe({ ...s.opts, maxWaitMs: 20_000, pollMs: 3000 });
    expect(end).toMatchObject({ phase: 'failed', reason: 'timeout' });
    expect((end as { elapsedMs: number }).elapsedMs).toBeGreaterThanOrEqual(20_000);
  });
  it('stops at once when the phone is offline', async () => {
    const s = setup(['throw']);
    const end = await runWakeProbe({ ...s.opts, isOnline: () => false });
    expect(end).toMatchObject({ phase: 'failed', reason: 'offline' });
    expect(s.calls()).toBe(1);
  });
  it('can be cancelled', async () => {
    const s = setup(['down']);
    const ctrl = new AbortController();
    ctrl.abort();
    const end = await runWakeProbe({ ...s.opts, signal: ctrl.signal });
    expect(end).toMatchObject({ phase: 'failed', reason: 'aborted' });
    expect(s.calls()).toBe(0);
  });
});
