import { backoffDelay, DEFAULT_RETRY, withRetry } from './retry';

const policy = { retries: 3, baseMs: 100, factor: 2, maxMs: 500, jitter: 0.5 };

describe('backoffDelay', () => {
  it('grows by the factor and stops at the cap (no jitter at random=0.5)', () => {
    expect([1, 2, 3, 4].map((n) => backoffDelay(n, policy, () => 0.5))).toEqual([100, 200, 400, 500]);
  });
  it('stays within the jitter range', () => {
    expect(backoffDelay(1, policy, () => 0)).toBe(50);
    expect(backoffDelay(1, policy, () => 1)).toBe(150);
  });
  it('has sensible defaults', () => {
    expect(DEFAULT_RETRY.retries).toBe(2);
  });
});

describe('withRetry', () => {
  it('retries until it succeeds, sleeping between tries', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const out = await withRetry(async (attempt) => { calls++; if (attempt < 3) throw new Error('boom'); return 'ok'; }, {
      policy, shouldRetry: () => true, sleep: async (ms) => { sleeps.push(ms); }, random: () => 0.5,
    });
    expect(out).toBe('ok');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([100, 200]);
  });
  it('gives up after the allowed retries and throws the last error', async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new Error(`fail ${calls}`); }, { policy: { ...policy, retries: 2 }, shouldRetry: () => true, sleep: async () => undefined }))
      .rejects.toMatchObject({ message: 'fail 3' });
    expect(calls).toBe(3);
  });
  it('does not retry when shouldRetry says no', async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new Error('no'); }, { policy, shouldRetry: () => false, sleep: async () => undefined })).rejects.toMatchObject({ message: 'no' });
    expect(calls).toBe(1);
  });
});
