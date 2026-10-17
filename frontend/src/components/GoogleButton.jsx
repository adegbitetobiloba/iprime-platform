import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise = null;
const loadGis = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_SRC; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error("load failed")); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
};

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

// "Continue with Google" using Google's own sign-in (Google Identity Services): Google shows its account chooser,
// and our server verifies the result. We never see a Google password. mode="link" attaches Google to the signed-in account.
export default function GoogleButton({ role, mode = "signin", onDone, onSignedIn, onLinkRequired, onOnboarding }) {
  const { token, acceptSession, updateUser } = useAuth();
  const boxRef = useRef(null);
  const alive = useRef(true);
  const roleRef = useRef(role); roleRef.current = role;
  const cb = useRef({}); cb.current = { onDone, onSignedIn, onLinkRequired, onOnboarding };
  const [state, setState] = useState("loading"); // loading | ready | notconfigured | unavailable
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const prepare = useCallback(async () => {
    try {
      // A fresh single-use nonce from our server for every attempt, so a captured Google token cannot be replayed.
      const { nonce, clientId } = await api("/auth/google/nonce");
      await loadGis();
      if (!alive.current || !boxRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId, nonce, ux_mode: "popup", auto_select: false, cancel_on_tap_outside: true,
        callback: async (resp) => {
          if (!resp?.credential) return;
          setBusy(true); setError("");
          try {
            if (mode === "link") {
              const d = await api("/auth/google/link", { method: "POST", token, body: { credential: resp.credential } });
              updateUser(d.user);
              cb.current.onDone?.(d.user);
            } else {
              const body = { credential: resp.credential };
              if (roleRef.current) body.role = roleRef.current; // only when the person already chose an account type
              const d = await api("/auth/google", { method: "POST", body });
              if (d.status === "link_required") cb.current.onLinkRequired?.(d);
              else if (d.status === "onboarding") cb.current.onOnboarding?.(d);
              else { acceptSession(d.token, d.user); cb.current.onSignedIn?.(d.user); }
            }
          } catch (e) {
            if (alive.current) setError(e.message);
          } finally {
            if (alive.current) { setBusy(false); prepare(); } // the old nonce is used up: get a new one
          }
        },
      });
      boxRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(boxRef.current, {
        type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "left",
        width: Math.max(200, Math.min(400, boxRef.current.clientWidth || 320)),
      });
      setState("ready");
    } catch (e) {
      if (!alive.current) return;
      setState(e.code === "GOOGLE_NOT_CONFIGURED" ? "notconfigured" : "unavailable");
    }
  }, [mode, token, acceptSession, updateUser]);

  useEffect(() => { alive.current = true; prepare(); return () => { alive.current = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="google-wrap">
      {state === "notconfigured" && (
        <>
          <button type="button" className="btn btn-google" disabled><GoogleG /> Continue with Google</button>
          <p className="hint">Google sign-in is not available yet.</p>
        </>
      )}
      {state === "unavailable" && (
        <>
          <button type="button" className="btn btn-google" onClick={() => { setState("loading"); prepare(); }}><GoogleG /> Continue with Google</button>
          <p className="hint">We could not load Google sign-in. Check your connection and tap the button to try again.</p>
        </>
      )}
      <div ref={boxRef} className={`google-box${state === "ready" ? "" : " google-box-hidden"}${busy ? " google-box-busy" : ""}`} />
      {state === "loading" && <div className="google-skeleton skeleton" aria-hidden="true" />}
      {busy && <p className="hint" role="status">Signing you in...</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </div>
  );
}
