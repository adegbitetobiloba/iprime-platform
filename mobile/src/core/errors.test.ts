import { ApiError, errorFromResponse, isApprovalBlock, plainMessage } from './errors';

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe('errorFromResponse', () => {
  it('reads { error, code }', () => {
    const e = errorFromResponse(403, { error: 'Please verify your email first.', code: 'NOT_VERIFIED' });
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 403, code: 'NOT_VERIFIED', message: 'Please verify your email first.' });
  });
  it('keeps a server code on 401 and defaults to UNAUTHORIZED', () => {
    expect(errorFromResponse(401, { error: 'x', code: 'GOOGLE_INVALID' }).code).toBe('GOOGLE_INVALID');
    expect(errorFromResponse(401, { error: 'x' }).code).toBe('UNAUTHORIZED');
  });
  it('maps 502, 503 and 504 to SERVER_UNAVAILABLE even for an HTML page', () => {
    for (const s of [502, 503, 504]) expect(errorFromResponse(s, undefined).code).toBe('SERVER_UNAVAILABLE');
  });
  it('collects validation messages and header values', () => {
    const e = errorFromResponse(400, { error: 'Invalid', errors: ['Email is required', { message: 'Password too short' }, { msg: 'Bad phone' }] }, headers({ 'retry-after': '7', 'rndr-id': 'abc' }));
    expect(e.details).toEqual(['Email is required', 'Password too short', 'Bad phone']);
    expect(e.retryAfterSeconds).toBe(7);
    expect(e.requestId).toBe('abc');
  });
  it('recognises the three approval codes', () => {
    expect(isApprovalBlock('PENDING_APPROVAL')).toBe(true);
    expect(isApprovalBlock('ACCOUNT_REJECTED')).toBe(true);
    expect(isApprovalBlock('ACCOUNT_SUSPENDED')).toBe(true);
    expect(isApprovalBlock('NOT_VERIFIED')).toBe(false);
  });
});

describe('plainMessage', () => {
  const mk = (status: number, code: string, message = 'raw') => new ApiError({ status, code, message });
  it('explains connection problems kindly', () => {
    expect(plainMessage(mk(0, 'NETWORK'))).toContain('internet');
    expect(plainMessage(mk(0, 'TIMEOUT'))).toContain('too long');
    expect(plainMessage(mk(503, 'SERVER_UNAVAILABLE'))).toContain('waking');
  });
  it('prefers the server text for account states and falls back to ours', () => {
    expect(plainMessage(mk(403, 'PENDING_APPROVAL', 'An admin will review your account.'))).toBe('An admin will review your account.');
    expect(plainMessage(mk(403, 'ACCOUNT_SUSPENDED', ''))).toContain('suspended');
    expect(plainMessage(mk(403, 'NOT_VERIFIED', 'Verify first'))).toBe('Verify first');
  });
  it('never shows raw text for server errors, but shows 4xx messages', () => {
    expect(plainMessage(mk(500, 'HTTP_ERROR', 'MongoServerError: secret detail'))).toBe('Something went wrong on our side. Please try again.');
    expect(plainMessage(mk(400, 'HTTP_ERROR', 'Invalid email or password'))).toBe('Invalid email or password');
  });
  it('handles cancelled requests and unknown values', () => {
    expect(plainMessage(mk(0, 'ABORTED'))).toBe('');
    expect(plainMessage(new Error('x'))).toBe('Something went wrong. Please try again.');
    expect(plainMessage(mk(429, 'RATE_LIMITED'))).toContain('Too many');
  });
});
