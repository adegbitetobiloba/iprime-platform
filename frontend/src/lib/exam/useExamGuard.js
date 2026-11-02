import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api.js";

// ExamGuard in the browser. It REPORTS what the browser can see (the exam tab or window lost focus, fullscreen was left, copy
// or paste was tried, the network dropped). The server decides what counts as a violation and when the exam ends. A web
// page cannot see other devices, second screens, screenshots or other apps, so this is a deterrent and an audit trail,
// not proof. Losing the network is logged but is never a violation.

const queueKey = (id) => `iprime.exam.events.${id}`;
const readQueue = (id) => {
  try { const v = JSON.parse(localStorage.getItem(queueKey(id)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};
const writeQueue = (id, q) => {
  try { if (q.length) localStorage.setItem(queueKey(id), JSON.stringify(q)); else localStorage.removeItem(queueKey(id)); } catch { /* storage unavailable */ }
};
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
const MAX_QUEUE = 200;

export default function useExamGuard({ id, token, policy, active, initialViolations = 0, beforeFlush, now = () => Date.now() }) {
  const [warning, setWarning] = useState(null);       // { violations, max, remaining, autoSubmit } after a counted violation
  const [violations, setViolations] = useState(initialViolations);
  const [closed, setClosed] = useState(null);         // set when the server ended the exam
  const [needFullscreen, setNeedFullscreen] = useState(false);

  const queue = useRef(readQueue(id));
  const flushing = useRef(false);
  const timer = useRef(null);
  const closedRef = useRef(false);
  const shown = useRef(initialViolations);
  const visible = useRef(true);
  const focused = useRef(true); // assume focused at the start: some browsers report false while the page is still loading
  const awayStart = useRef(null);
  const awayReasons = useRef(new Set());
  const offlineAt = useRef(null);
  const enteredFs = useRef(false);
  const throttle = useRef({});
  const cfg = useRef({ id, token, beforeFlush, now });
  cfg.current = { id, token, beforeFlush, now };

  useEffect(() => { setViolations((v) => Math.max(v, initialViolations)); shown.current = Math.max(shown.current, initialViolations); }, [initialViolations]);

  const flush = useCallback(async () => {
    if (flushing.current || closedRef.current || !queue.current.length) return;
    flushing.current = true;
    let more = false;
    try {
      // Send the answers first, so an automatic submission never loses answers that were still waiting to be saved.
      if (cfg.current.beforeFlush) await cfg.current.beforeFlush();
      const batch = queue.current.slice(0, 50);
      const r = await api(`/attempts/${cfg.current.id}/events`, { method: "POST", token: cfg.current.token, body: { events: batch } });
      queue.current = queue.current.filter((e) => !batch.includes(e));
      writeQueue(cfg.current.id, queue.current);
      setViolations(r.violations);
      if (r.closed) {
        closedRef.current = true;
        queue.current = []; writeQueue(cfg.current.id, []);
        setClosed(r);
        return;
      }
      if (r.violations > shown.current) {
        shown.current = r.violations;
        setWarning({ violations: r.violations, max: r.max, remaining: r.remaining });
      }
      more = queue.current.length > 0;
    } catch (e) {
      if (e && e.code === "SUBMITTED") { closedRef.current = true; setClosed({ closed: true }); }
      // any other failure (offline, server busy): the events stay queued and are sent later
    } finally {
      flushing.current = false;
      if (more) flush();
    }
  }, []);

  const enqueue = useCallback((evt) => {
    queue.current.push({ eid: uid(), at: new Date(cfg.current.now()).toISOString(), ...evt });
    if (queue.current.length > MAX_QUEUE) queue.current = queue.current.slice(-MAX_QUEUE);
    writeQueue(cfg.current.id, queue.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 300);
  }, [flush]);

  const throttled = useCallback((type) => {
    const t = Date.now();
    if (throttle.current[type] && t - throttle.current[type] < 5000) return;
    throttle.current[type] = t;
    enqueue({ type });
  }, [enqueue]);

  const on = Boolean(policy && policy.enabled) && active;

  // Leaving and returning to the exam tab or window.
  useEffect(() => {
    if (!on || !policy.monitorFocus) return undefined;
    const update = () => {
      const away = !visible.current || !focused.current;
      if (away) {
        if (awayStart.current == null) { awayStart.current = Date.now(); awayReasons.current = new Set(); }
        if (!visible.current) awayReasons.current.add("hidden");
        if (!focused.current) awayReasons.current.add("blur");
      } else if (awayStart.current != null) {
        enqueue({ type: "away", durationMs: Date.now() - awayStart.current, reasons: [...awayReasons.current] });
        awayStart.current = null;
      }
    };
    const onVis = () => { visible.current = document.visibilityState === "visible"; update(); };
    const onBlur = () => { focused.current = false; update(); };
    const onFocus = () => { focused.current = true; update(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [on, policy && policy.monitorFocus, enqueue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen (only where the browser supports it: iPhones do not, and are never penalised for that).
  useEffect(() => {
    if (!on || !policy.requireFullscreen) return undefined;
    if (typeof document === "undefined" || !document.fullscreenEnabled) { throttled("fullscreen_unsupported"); return undefined; }
    setNeedFullscreen(!document.fullscreenElement);
    const onChange = () => {
      if (document.fullscreenElement) { enteredFs.current = true; setNeedFullscreen(false); enqueue({ type: "fullscreen_enter" }); }
      else { setNeedFullscreen(true); if (enteredFs.current) enqueue({ type: "fullscreen_exit" }); }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [on, policy && policy.requireFullscreen, enqueue, throttled]);

  // Copy, cut, paste and the right-click menu are blocked and logged (not counted).
  useEffect(() => {
    if (!on || !policy.blockCopyPaste) return undefined;
    const block = (type) => (e) => { e.preventDefault(); throttled(type); };
    const c = block("copy_blocked"), p = block("paste_blocked"), m = block("contextmenu_blocked");
    document.addEventListener("copy", c); document.addEventListener("cut", c);
    document.addEventListener("paste", p); document.addEventListener("contextmenu", m);
    return () => {
      document.removeEventListener("copy", c); document.removeEventListener("cut", c);
      document.removeEventListener("paste", p); document.removeEventListener("contextmenu", m);
    };
  }, [on, policy && policy.blockCopyPaste, throttled]);

  // Network loss: logged for the record, never a violation. When it returns, send anything queued.
  useEffect(() => {
    if (!on) return undefined;
    const goOffline = () => { offlineAt.current = Date.now(); enqueue({ type: "offline" }); };
    const goOnline = () => {
      const ms = offlineAt.current ? Date.now() - offlineAt.current : undefined;
      offlineAt.current = null;
      enqueue({ type: "online", ...(ms !== undefined ? { durationMs: ms } : {}) });
      flush();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, [on, enqueue, flush]);

  // Anything left from before a refresh is sent now, and the queue is retried every 10 seconds.
  useEffect(() => {
    if (!on) return undefined;
    flush();
    const t = setInterval(flush, 10000);
    return () => clearInterval(t);
  }, [on, flush]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, []);

  return { warning, dismissWarning: () => setWarning(null), violations, closed, needFullscreen: on && needFullscreen, enterFullscreen };
}
