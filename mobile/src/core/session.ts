// Owner: Account 1. Who is signed in. Plain TypeScript (no React) so it can be tested; src/core/useSession.ts wraps it for screens.
// The token is kept private: state never contains it, so it cannot leak into logs or React DevTools.

export interface SessionUser {
  role: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

export interface SessionNotice {
  kind: 'expired' | 'blocked' | 'signedOut';
  /** Plain-language text for the sign-in screen. */
  message: string;
  /** Server code for blocked accounts (PENDING_APPROVAL, ...). */
  code?: string;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: SessionNotice }
  | { status: 'signedIn'; user: SessionUser | null };

export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
}

export interface SessionManagerOptions {
  storage: TokenStorage;
  /** Ends the login on the server (POST /api/auth/logout). Given the token that is being retired. */
  logout: (token: string) => Promise<void>;
}

export const MESSAGES = {
  expired: 'Your session has ended. Please sign in again.',
  signedOut: 'You have been signed out.',
} as const;

export function createSessionManager(o: SessionManagerOptions) {
  let token: string | null = null;
  let state: SessionState = { status: 'loading' };
  const listeners = new Set<() => void>();
  const set = (s: SessionState) => { state = s; listeners.forEach((l) => l()); };

  async function clearLocal(): Promise<void> {
    token = null;
    try { await o.storage.remove(); } catch { /* the in-memory token is already gone */ }
  }

  return {
    getState: (): SessionState => state,
    /** For the API client only. Do not log it. */
    getToken: (): string | null => token,
    subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },

    /** Call once at app start: restores a saved login. The user profile is fetched later (F3, GET /api/auth/me). */
    async init(): Promise<void> {
      let saved: string | null = null;
      try { saved = await o.storage.get(); } catch { saved = null; }
      if (saved) { token = saved; set({ status: 'signedIn', user: null }); } else set({ status: 'signedOut' });
    },

    /** After a successful login or Google sign-in (F3). */
    async signIn(newToken: string, user: SessionUser | null = null): Promise<void> {
      token = newToken;
      set({ status: 'signedIn', user });
      try { await o.storage.set(newToken); } catch { /* stays signed in for this run; will ask again next launch */ }
    },

    setUser(user: SessionUser): void {
      if (state.status === 'signedIn') set({ status: 'signedIn', user });
    },

    /**
     * Sign out now, then tell the server. The screen never waits for the network.
     * serverRevoked is false when the phone was offline: the old token then stays valid on the server until it expires (up to 7 days).
     */
    async signOut(notice: SessionNotice = { kind: 'signedOut', message: MESSAGES.signedOut }): Promise<{ serverRevoked: boolean }> {
      const old = token;
      await clearLocal();
      set({ status: 'signedOut', notice });
      if (!old) return { serverRevoked: false };
      try { await o.logout(old); return { serverRevoked: true }; } catch { return { serverRevoked: false }; }
    },

    /** The server said 401 for `usedToken`. Ignored if that token is not the current one (a late reply after a new login). */
    async handleUnauthorized(usedToken: string): Promise<void> {
      if (token === null || usedToken !== token) return;
      await clearLocal();
      set({ status: 'signedOut', notice: { kind: 'expired', message: MESSAGES.expired } });
    },

    /** The server said the account is pending, rejected or suspended. No logout call: the server refuses it for such accounts. */
    async handleBlocked(usedToken: string, code: string, message: string): Promise<void> {
      if (token === null || usedToken !== token) return;
      await clearLocal();
      set({ status: 'signedOut', notice: { kind: 'blocked', code, message } });
    },

    clearNotice(): void {
      if (state.status === 'signedOut' && state.notice) set({ status: 'signedOut' });
    },
  };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
