import { createContext, useContext, useEffect, useState, useCallback } from "react";
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

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
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

  return <AuthContext.Provider value={{ token, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
