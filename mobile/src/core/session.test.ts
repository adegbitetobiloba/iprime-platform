import { createSessionManager, MESSAGES, type TokenStorage } from './session';

function setup(initial: string | null = null, logoutFails = false) {
  let stored = initial;
  const removed: number[] = [];
  const logouts: string[] = [];
  const storage: TokenStorage = {
    get: async () => stored,
    set: async (t) => { stored = t; },
    remove: async () => { stored = null; removed.push(1); },
  };
  const m = createSessionManager({ storage, logout: async (t) => { logouts.push(t); if (logoutFails) throw new Error('offline'); } });
  return { m, storage, logouts, stored: () => stored };
}

describe('session manager', () => {
  it('starts loading, then signed out when nothing is saved', async () => {
    const s = setup();
    expect(s.m.getState()).toEqual({ status: 'loading' });
    await s.m.init();
    expect(s.m.getState()).toEqual({ status: 'signedOut' });
  });
  it('restores a saved login after a restart', async () => {
    const s = setup('SAVED');
    await s.m.init();
    expect(s.m.getState()).toEqual({ status: 'signedIn', user: null });
    expect(s.m.getToken()).toBe('SAVED');
  });
  it('saves the token on sign-in and never puts it in the state', async () => {
    const s = setup();
    await s.m.init();
    await s.m.signIn('NEWTOKEN', { role: 'student' });
    expect(s.stored()).toBe('NEWTOKEN');
    expect(JSON.stringify(s.m.getState()).includes('NEWTOKEN')).toBe(false);
  });
  it('signs out locally first, then tells the server which token to end', async () => {
    const s = setup('OLD');
    await s.m.init();
    const out = await s.m.signOut();
    expect(out).toEqual({ serverRevoked: true });
    expect(s.logouts).toEqual(['OLD']);
    expect(s.stored()).toBeNull();
    expect(s.m.getToken()).toBeNull();
    expect(s.m.getState()).toMatchObject({ status: 'signedOut', notice: { kind: 'signedOut' } });
  });
  it('still signs out when the server cannot be reached, and says it was not revoked', async () => {
    const s = setup('OLD', true);
    await s.m.init();
    expect(await s.m.signOut()).toEqual({ serverRevoked: false });
    expect(s.m.getState().status).toBe('signedOut');
    expect(s.stored()).toBeNull();
  });
  it('turns a 401 for the current token into a clean sign-out with a plain message', async () => {
    const s = setup('CUR');
    await s.m.init();
    await s.m.handleUnauthorized('CUR');
    expect(s.m.getState()).toEqual({ status: 'signedOut', notice: { kind: 'expired', message: MESSAGES.expired } });
    expect(s.stored()).toBeNull();
    expect(s.logouts).toEqual([]);
  });
  it('ignores a late 401 that belongs to an older token', async () => {
    const s = setup('CUR');
    await s.m.init();
    await s.m.handleUnauthorized('STALE');
    expect(s.m.getState().status).toBe('signedIn');
    expect(s.stored()).toBe('CUR');
  });
  it('signs out blocked accounts and keeps the server code and message for the sign-in screen', async () => {
    const s = setup('CUR');
    await s.m.init();
    await s.m.handleBlocked('CUR', 'ACCOUNT_SUSPENDED', 'Your account is suspended.');
    expect(s.m.getState()).toEqual({ status: 'signedOut', notice: { kind: 'blocked', code: 'ACCOUNT_SUSPENDED', message: 'Your account is suspended.' } });
    expect(s.stored()).toBeNull();
  });
  it('notifies subscribers and can clear the notice', async () => {
    const s = setup('CUR');
    let n = 0;
    const off = s.m.subscribe(() => { n++; });
    await s.m.init();
    await s.m.handleUnauthorized('CUR');
    s.m.clearNotice();
    expect(s.m.getState()).toEqual({ status: 'signedOut' });
    expect(n).toBeGreaterThanOrEqual(3);
    off();
  });
  it('handles two 401s arriving together without errors', async () => {
    const s = setup('CUR');
    await s.m.init();
    await Promise.all([s.m.handleUnauthorized('CUR'), s.m.handleUnauthorized('CUR')]);
    expect(s.m.getState().status).toBe('signedOut');
  });
});
