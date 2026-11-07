// Owner: Account 1. One error type for every failed request, plus plain-language messages.
// Server errors look like { error: "<message>", code?: "<CODE>" } (CONTRACTS v1). Codes are open-ended strings.

/** Codes the server sends when an account may not use the app yet (middleware and login). */
export const APPROVAL_CODES = ['PENDING_APPROVAL', 'ACCOUNT_REJECTED', 'ACCOUNT_SUSPENDED'] as const;
export type ApprovalCode = (typeof APPROVAL_CODES)[number];

/** Codes made up by the app (the server never sends these). */
export type ClientCode = 'NETWORK' | 'TIMEOUT' | 'ABORTED' | 'BAD_RESPONSE' | 'UNAUTHORIZED' | 'SERVER_UNAVAILABLE' | 'HTTP_ERROR';

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: string[];
  requestId?: string;
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  /** HTTP status, or 0 when no reply arrived (network, timeout, abort). */
  readonly status: number;
  /** Server code (NOT_VERIFIED, TIME_UP, ...) or a ClientCode. */
  readonly code: string;
  /** Field messages when the server sent an `errors` list. */
  readonly details?: string[];
  /** Id from the server or Render, handy when reporting a problem. Never contains user data. */
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(init: ApiErrorInit) {
    super(init.message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const isApprovalBlock = (code: string | undefined): code is ApprovalCode =>
  APPROVAL_CODES.includes(code as ApprovalCode);

/** 502, 503 and 504 are what Render and its gateway return while the server is waking or restarting. */
export const isServerUnavailableStatus = (s: number) => s === 502 || s === 503 || s === 504;

function pickDetails(body: Record<string, unknown>): string[] | undefined {
  const raw = body.errors;
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map((e) => (typeof e === 'string' ? e : e && typeof e === 'object' ? String((e as Record<string, unknown>).message ?? (e as Record<string, unknown>).msg ?? '') : ''))
    .filter(Boolean);
  return out.length ? out : undefined;
}

/** Build an ApiError from an HTTP reply. `body` is the parsed JSON, or undefined if it was not JSON. */
export function errorFromResponse(status: number, body: unknown, headers?: { get(name: string): string | null }): ApiError {
  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const serverMessage = typeof obj.error === 'string' && obj.error.trim() ? obj.error.trim() : undefined;
  const serverCode = typeof obj.code === 'string' && obj.code ? obj.code : undefined;
  const retryAfter = Number(headers?.get('retry-after'));
  const requestId = headers?.get('x-request-id') ?? headers?.get('rndr-id') ?? undefined;
  const base = { status, requestId, details: pickDetails(obj), retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined };

  // Keep a server code on 401 (for example GOOGLE_INVALID) so sign-in screens can branch on it.
  if (status === 401) return new ApiError({ ...base, code: serverCode ?? 'UNAUTHORIZED', message: serverMessage ?? 'Please sign in again.' });
  if (isServerUnavailableStatus(status)) return new ApiError({ ...base, code: 'SERVER_UNAVAILABLE', message: serverMessage ?? 'The server is not ready.' });
  return new ApiError({ ...base, code: serverCode ?? 'HTTP_ERROR', message: serverMessage ?? `Request failed (${status}).` });
}

const DEFAULTS: Record<string, string> = {
  NETWORK: "We can't reach the server. Check your internet connection and try again.",
  TIMEOUT: 'The server is taking too long to answer. Please try again.',
  SERVER_UNAVAILABLE: 'The server is waking up or busy. Please try again in a moment.',
  BAD_RESPONSE: 'We got an unexpected reply from the server. Please try again.',
  UNAUTHORIZED: 'Your session has ended. Please sign in again.',
  RATE_LIMITED: 'Too many tries. Please wait a little and try again.',
  NOT_VERIFIED: 'Please verify your email first. We can send you a new code.',
  PENDING_APPROVAL: 'Your account is waiting for approval. Please check back soon.',
  ACCOUNT_REJECTED: 'Your account was not approved. Please contact the iPrime team.',
  ACCOUNT_SUSPENDED: 'Your account is suspended. Please contact the iPrime team.',
};

/** Text that is safe and kind to show a student. Never shows raw server errors for 5xx replies. */
export function plainMessage(err: unknown): string {
  if (!isApiError(err)) return 'Something went wrong. Please try again.';
  if (err.code === 'ABORTED') return '';
  // Server-written messages for account states are already plain; prefer them so the app matches the website.
  if (isApprovalBlock(err.code) || err.code === 'NOT_VERIFIED') return err.message && err.status !== 0 ? err.message : DEFAULTS[err.code]!;
  const fixed = DEFAULTS[err.code];
  if (fixed) return fixed;
  if (err.status >= 500) return 'Something went wrong on our side. Please try again.';
  if (err.status >= 400 && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
