import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);
const KEY = "iprime_token";

const readToken = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
const writeToken = (t) => {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(readToken()));
  const [notice, setNotice] = useState(null); // a short message shown to the person: { kind: "ok" | "warn", text }
  const tokenRef = useRef(token); tokenRef.current = token;

  // If another tab logs in or out, follow it, so this tab never keeps showing a stale signed-in state.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY) return;
      const t = readToken();
      setToken(t);
      if (!t) { setUser(null); setLoading(false); } else setLoading(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onUnauthorized = (e) => {
      writeToken(null); setToken(null); setUser(null); setLoading(false);
      const reason = e.detail?.reason;
      setNotice({ kind: "warn", text: reason === "PENDING_APPROVAL" ? "Your account is waiting for approval by an administrator." : reason === "ACCOUNT_REJECTED" ? "Your account is no longer approved. Please contact the institution." : "Your session has ended. Please log in again." });
    };
    window.addEventListener("iprime:unauthorized", onUnauthorized);
    return () => window.removeEventListener("iprime:unauthorized", onUnauthorized);
  }, []);

  // Ends the login on the server (so a copied token stops working), then clears this device either way.
  const logout = useCallback(async () => {
    const t = tokenRef.current;
    let serverOk = true;
    if (t) {
      try { await api("/auth/logout", { method: "POST", token: t }); } catch (e) { serverOk = e.status === 401; } // 401 = already ended
    }
    writeToken(null);
    setToken(null);
    setUser(null);
    setLoading(false);
    setNotice(serverOk
      ? { kind: "ok", text: "You have been logged out." }
      : { kind: "warn", text: "You are logged out on this device, but we could not reach the server to end the session fully." });
  }, []);

  // If a token is stored, confirm it is still valid and load the profile.
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    api("/auth/me", { token })
      .then((d) => { if (!cancelled) setUser(d.user); })
      .catch((e) => { if (!cancelled && e.status === 401) logout(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, logout]);

  const login = async (email, password) => {
    const d = await api("/auth/login", { method: "POST", body: { email, password } });
    writeToken(d.token);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  return <AuthContext.Provider value={{ token, user, loading, login, logout, notice, setNotice, clearNotice: () => setNotice(null), updateUser: setUser, acceptSession: (t, u) => { writeToken(t); setToken(t); setUser(u); setLoading(false); } }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
