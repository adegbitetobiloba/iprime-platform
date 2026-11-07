// Owner: Account 1. Retry with exponential backoff and jitter. Pure: sleep and random are injected so tests need no timers.
export interface RetryPolicy {
  /** Extra tries after the first one. */
  retries: number;
  baseMs: number;
  factor: number;
  maxMs: number;
  /** 0 to 1: the delay varies by up to this fraction either way. */
  jitter: number;
}

export const DEFAULT_RETRY: RetryPolicy = { retries: 2, baseMs: 500, factor: 2, maxMs: 4000, jitter: 0.3 };

/** Delay before retry number `retryNumber` (1 = first retry). */
export function backoffDelay(retryNumber: number, policy: RetryPolicy, random: () => number = Math.random): number {
  const raw = Math.min(policy.maxMs, policy.baseMs * policy.factor ** (retryNumber - 1));
  const swing = 1 + (random() * 2 - 1) * policy.jitter;
  return Math.max(0, Math.round(raw * swing));
}

export interface RetryOptions {
  policy?: RetryPolicy;
  shouldRetry: (error: unknown, attempt: number) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs fn(attempt); `attempt` starts at 1. Throws the last error when retries run out or shouldRetry says no. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions): Promise<T> {
  const policy = o.policy ?? DEFAULT_RETRY;
  const sleep = o.sleep ?? realSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt > policy.retries || !o.shouldRetry(error, attempt)) throw error;
      const delayMs = backoffDelay(attempt, policy, o.random);
      o.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }
}
