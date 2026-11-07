// Owner: Account 1. Typed fetch wrapper. No React, no expo imports: everything is injected so it is easy to test.
import { ServerClock } from './clock';
import { ApiError, errorFromResponse, isApiError, isApprovalBlock, isServerUnavailableStatus } from './errors';
import { DEFAULT_RETRY, withRetry, type RetryPolicy } from './retry';

export interface UnauthorizedInfo { token: string }
export interface BlockedInfo { code: string; message: string; token: string }

export interface ApiClientOptions {
  /** Origin plus /api, for example https://x.onrender.com/api (see src/core/config.ts). */
  baseUrl: string;
  getToken: () => string | null;
  /** A reply of 401 to a request that carried a token. */
  onUnauthorized?: (info: UnauthorizedInfo) => void;
  /** A 403 with PENDING_APPROVAL, ACCOUNT_REJECTED or ACCOUNT_SUSPENDED on a request that carried a token. */
  onAccountBlocked?: (info: BlockedInfo) => void;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  clock?: ServerClock;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  /** Receives one short line per request. Never contains tokens, bodies or query strings. */
  log?: (line: string) => void;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** false = do not send the token and do not treat a 401 as "signed out" (login, Google sign-in, OTP). */
  auth?: boolean;
  /** Use this token instead of the stored one (sign-out sends the token it just cleared). */
  token?: string;
  /** Safe to repeat, so network failures may be retried. GET is always treated as safe. */
  idempotent?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const SAFE: Method[] = ['GET'];
const RETRYABLE_CODES = ['NETWORK', 'TIMEOUT', 'SERVER_UNAVAILABLE'];

export interface ApiClient {
  request<T>(method: Method, path: string, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, opts?: RequestOptions): Promise<T>;
  patch<T>(path: string, opts?: RequestOptions): Promise<T>;
  delete<T>(path: string, opts?: RequestOptions): Promise<T>;
}

export function createApiClient(o: ApiClientOptions): ApiClient {
  const fetchFn = o.fetchFn ?? fetch;
  const now = o.now ?? Date.now;
  const policy: RetryPolicy = { ...DEFAULT_RETRY, ...o.retry };
  const clock = o.clock;
  const base = o.baseUrl.replace(/\/+$/, '');

  async function once<T>(method: Method, path: string, opts: RequestOptions, attempt: number): Promise<T> {
    const token = opts.auth === false ? null : (opts.token ?? o.getToken());
    const qs = opts.query
      ? Object.entries(opts.query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
      : '';
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
    const rid = Math.random().toString(36).slice(2, 8);
    const sentAt = now();

    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? o.timeoutMs ?? 20_000);
    const onCallerAbort = () => ctrl.abort();
    if (opts.signal) opts.signal.aborted ? ctrl.abort() : opts.signal.addEventListener('abort', onCallerAbort);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const logLine = (status: string) => o.log?.(`[api ${rid}] ${method} ${path} ${status} ${now() - sentAt}ms${attempt > 1 ? ` (try ${attempt})` : ''}`);

    try {
      let res: Response;
      try {
        res = await fetchFn(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctrl.signal });
      } catch (e) {
        const callerAborted = opts.signal?.aborted === true;
        const code = callerAborted ? 'ABORTED' : timedOut ? 'TIMEOUT' : 'NETWORK';
        logLine(code);
        throw new ApiError({ status: 0, code, message: code === 'ABORTED' ? 'Request cancelled.' : code === 'TIMEOUT' ? 'The request timed out.' : 'Network request failed.' });
      }

      const receivedAt = now();
      const text = await res.text().catch(() => '');
      let body: unknown;
      let parsed = false;
      if (text) {
        try { body = JSON.parse(text); parsed = true; } catch { /* leave unparsed */ }
      }
      logLine(String(res.status));
      if (parsed) clock?.observeBody(body, sentAt, receivedAt);

      if (res.ok) {
        if (!parsed && text) throw new ApiError({ status: res.status, code: 'BAD_RESPONSE', message: 'The server did not send JSON.' });
        return (parsed ? body : undefined) as T;
      }

      const err = errorFromResponse(res.status, parsed ? body : undefined, res.headers);
      if (token) {
        if (res.status === 401) o.onUnauthorized?.({ token });
        else if (res.status === 403 && isApprovalBlock(err.code)) o.onAccountBlocked?.({ code: err.code, message: err.message, token });
      }
      throw err;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
    const safe = SAFE.includes(method) || opts.idempotent === true;
    return withRetry((attempt) => once<T>(method, path, opts, attempt), {
      policy,
      sleep: o.sleep,
      random: o.random,
      shouldRetry: (e) => safe && isApiError(e) && RETRYABLE_CODES.includes(e.code) && (e.status === 0 || isServerUnavailableStatus(e.status)),
    });
  }

  return {
    request,
    get: (p, x) => request('GET', p, x),
    post: (p, x) => request('POST', p, x),
    put: (p, x) => request('PUT', p, x),
    patch: (p, x) => request('PATCH', p, x),
    delete: (p, x) => request('DELETE', p, x),
  };
}
