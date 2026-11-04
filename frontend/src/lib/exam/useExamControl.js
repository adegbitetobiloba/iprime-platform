import { useEffect, useRef } from "react";
import { api } from "../../api.js";

// The exam screen checks in with the server about every 20 seconds. That tells administrators the student is connected,
// and it is how an administrator's pause, extra time or "please submit" reaches this screen (plain polling: no paid
// real-time service). A failed check-in is ignored: losing the network is never a problem for the student.
const EVERY_MS = 20000;

export default function useExamControl({ id, token, active, onState }) {
  const cb = useRef(onState);
  cb.current = onState;
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;
    const beat = async () => {
      try {
        const r = await api(`/attempts/${id}/heartbeat`, { method: "POST", token });
        if (!stopped) cb.current(r);
      } catch { /* offline or busy: try again at the next beat */ }
    };
    beat();
    const t = setInterval(beat, EVERY_MS);
    const onOnline = () => beat();
    window.addEventListener("online", onOnline);
    return () => { stopped = true; clearInterval(t); window.removeEventListener("online", onOnline); };
  }, [id, token, active]);
}
