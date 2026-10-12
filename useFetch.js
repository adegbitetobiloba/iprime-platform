import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { useAuth } from "./auth.jsx";

// Loads data from the API for a page and exposes loading, error and reload.
export function useFetch(path) {
  const { token } = useAuth();
  const [state, setState] = useState({ data: null, error: "", loading: true });

  const load = useCallback(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(path, { token })
      .then((data) => { if (!off) setState({ data, error: "", loading: false }); })
      .catch((e) => { if (!off) setState({ data: null, error: e.message, loading: false }); });
    return () => { off = true; };
  }, [path, token]);

  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}

export const fmtDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
};
