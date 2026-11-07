import { ServerClock } from './clock';
import { ApiError } from './errors';
import { createApiClient, type ApiClientOptions } from './http';

interface Reply { status?: number; body?: unknown; text?: string; headers?: Record<string, string>; throws?: boolean; hang?: boolean }
const reply = (r: Reply, signal?: AbortSignal): Promise<Response> => {
  if (r.hang) {
    return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  }
  if (r.throws) return Promise.reject(new TypeError('Network request failed'));
  const status = r.status ?? 200;
  const text = r.text ?? (r.body === undefined ? '' : JSON.stringify(r.body));
  const h = r.headers ?? {};
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: async () => text, headers: { get: (n: string) => h[n.toLowerCase()] ?? null } } as unknown as Response);
};

function make(replies: Reply[], extra: Partial<ApiClientOptions> = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const sleeps: number[] = [];
  const logs: string[] = [];
  const events = { unauthorized: [] as string[], blocked: [] as Array<{ code: string; token: string }> };
  const fetchFn = ((url: string, init: RequestInit) => {
    const r = replies[Math.min(calls.length, replies.length - 1)]!;
    calls.push({ url, init });
    return reply(r, init.signal as AbortSignal | undefined);
  }) as unknown as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://api.test/api/',
    getToken: () => 'TOKEN123',
    fetchFn,
    sleep: async (ms) => { sleeps.push(ms); },
    random: () => 0.5,
    log: (l) => logs.push(l),
    onUnauthorized: ({ token }) => events.unauthorized.push(token),
    onAccountBlocked: ({ code, token }) => events.blocked.push({ code, token }),
    ...extra,
  });
  return { client, calls, sleeps, logs, events };
}

describe('request basics', () => {
  it('builds the url, sends the bearer token and returns the JSON', async () => {
    const t = make([{ body: { exams: [] } }]);
    const out = await t.client.get<{ exams: unknown[] }>('/exams', { query: { page: 2, q: 'a b', skip: undefined } });
    expect(out).toEqual({ exams: [] });
    expect(t.calls[0]!.url).toBe('https://api.test/api/exams?page=2&q=a%20b');
    expect((t.calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN123');
  });
  it('sends a JSON body and no token when auth is false', async () => {
    const t = make([{ body: { ok: true } }]);
    await t.client.post('/auth/login', { body: { email: 'a@b.c' }, auth: false });
    const h = t.calls[0]!.init.headers as Record<string, string>;
    expect(h.Authorization).toBeUndefined();
    expect(h['Content-Type']).toBe('application/json');
    expect(t.calls[0]!.init.body).toBe('{"email":"a@b.c"}');
  });
  it('can use an explicit token (sign-out sends the one it just cleared)', async () => {
    const t = make([{ body: {} }], { getToken: () => null });
    await t.client.post('/auth/logout', { token: 'OLD' });
    expect((t.calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer OLD');
  });
  it('feeds serverNow into the clock', async () => {
    const clock = new ServerClock(() => 0);
    let n = 0;
    const t = make([{ body: { saved: true, serverNow: 9000 } }], { clock, now: () => (n += 100) });
    await t.client.put('/attempts/1/answers', { body: {}, idempotent: true });
    expect(clock.hasSample).toBe(true);
  });
});

describe('retry rules', () => {
  it('retries a GET after network failures and then succeeds', async () => {
    const t = make([{ throws: true }, { throws: true }, { body: { ok: 1 } }]);
    expect(await t.client.get('/x')).toEqual({ ok: 1 });
    expect(t.calls).toHaveLength(3);
    expect(t.sleeps).toEqual([500, 1000]);
  });
  it('retries a GET on 503 and reports SERVER_UNAVAILABLE when it never recovers', async () => {
    const t = make([{ status: 503, text: '<html>Service waking</html>' }]);
    await expect(t.client.get('/x')).rejects.toMatchObject({ code: 'SERVER_UNAVAILABLE', status: 503 });
    expect(t.calls).toHaveLength(3);
  });
  it('does NOT retry a POST by default (it could be sent twice)', async () => {
    const t = make([{ throws: true }, { body: {} }]);
    await expect(t.client.post('/auth/register', { body: {}, auth: false })).rejects.toMatchObject({ code: 'NETWORK' });
    expect(t.calls).toHaveLength(1);
  });
  it('retries a POST that is marked idempotent', async () => {
    const t = make([{ throws: true }, { body: { result: 1 } }]);
    expect(await t.client.post('/attempts/1/submit', { idempotent: true })).toEqual({ result: 1 });
    expect(t.calls).toHaveLength(2);
  });
  it('does not retry refusals such as 400, 403, 404 or 429', async () => {
    for (const status of [400, 403, 404, 429]) {
      const t = make([{ status, body: { error: 'no', code: status === 429 ? 'RATE_LIMITED' : undefined } }]);
      await expect(t.client.get('/x')).rejects.toBeInstanceOf(ApiError);
      expect(t.calls).toHaveLength(1);
    }
  });
});

describe('errors', () => {
  it('times out a request that never answers', async () => {
    const t = make([{ hang: true }], { retry: { retries: 0 } });
    await expect(t.client.get('/slow', { timeoutMs: 25 })).rejects.toMatchObject({ code: 'TIMEOUT', status: 0 });
  });
  it('reports a cancelled request as ABORTED and does not retry', async () => {
    const ctrl = new AbortController();
    const t = make([{ hang: true }]);
    const p = t.client.get('/x', { signal: ctrl.signal, timeoutMs: 5000 });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORTED' });
    expect(t.calls).toHaveLength(1);
  });
  it('turns a 200 that is not JSON into BAD_RESPONSE', async () => {
    const t = make([{ text: '<html>oops</html>' }]);
    await expect(t.client.get('/x')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
  it('returns undefined for an empty 200', async () => {
    const t = make([{ text: '' }]);
    expect(await t.client.get('/x')).toBeUndefined();
  });
  it('keeps the server code and validation list on a 400', async () => {
    const t = make([{ status: 400, body: { error: 'Invalid', code: 'EMAIL_FAILED', errors: ['Email is required'] } }]);
    await expect(t.client.post('/auth/register', { auth: false })).rejects.toMatchObject({ code: 'EMAIL_FAILED', details: ['Email is required'] });
  });
});

describe('signed-out and blocked accounts', () => {
  it('reports a 401 on a signed-in request once, and throws UNAUTHORIZED', async () => {
    const t = make([{ status: 401, body: { error: 'Invalid or expired token' } }]);
    await expect(t.client.get('/auth/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(t.events.unauthorized).toEqual(['TOKEN123']);
    expect(t.calls).toHaveLength(1);
  });
  it('does NOT sign out on a 401 from a public route such as Google sign-in', async () => {
    const t = make([{ status: 401, body: { error: 'Google sign-in failed', code: 'GOOGLE_INVALID' } }]);
    await expect(t.client.post('/auth/google', { body: {}, auth: false })).rejects.toMatchObject({ code: 'GOOGLE_INVALID' });
    expect(t.events.unauthorized).toEqual([]);
  });
  it('reports approval blocks on signed-in requests', async () => {
    for (const code of ['PENDING_APPROVAL', 'ACCOUNT_REJECTED', 'ACCOUNT_SUSPENDED']) {
      const t = make([{ status: 403, body: { error: 'blocked', code } }]);
      await expect(t.client.get('/exams')).rejects.toMatchObject({ code, status: 403 });
      expect(t.events.blocked).toEqual([{ code, token: 'TOKEN123' }]);
    }
  });
  it('returns login-time codes without signing anyone out', async () => {
    for (const code of ['NOT_VERIFIED', 'PENDING_APPROVAL', 'ACCOUNT_REJECTED', 'ACCOUNT_SUSPENDED']) {
      const t = make([{ status: 403, body: { error: 'x', code } }]);
      await expect(t.client.post('/auth/login', { body: {}, auth: false })).rejects.toMatchObject({ code });
      expect(t.events.blocked).toEqual([]);
      expect(t.events.unauthorized).toEqual([]);
    }
  });
});

describe('logging', () => {
  it('writes one short line per request and never the token, body or query', async () => {
    const t = make([{ body: { ok: 1 } }]);
    await t.client.post('/auth/login', { body: { password: 'hunter2' }, query: { secret: 'qq9zx' }, idempotent: true });
    expect(t.logs).toHaveLength(1);
    const all = t.logs.join('\n');
    expect(all).toContain('POST /auth/login 200');
    for (const bad of ['TOKEN123', 'hunter2', 'qq9zx', 'secret']) expect(all.includes(bad)).toBe(false);
  });
});
