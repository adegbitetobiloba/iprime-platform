import { useState, useRef, useEffect } from "react";

// Wraps a form submit: tracks loading and error, and flags a "slow" request
// (the free server can take up to a minute to wake up after being idle).
export function useSubmit(action) {
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (...args) => {
    setError("");
    setLoading(true);
    setSlow(false);
    timer.current = setTimeout(() => setSlow(true), 6000);
    try {
      return await action(...args);
    } catch (e) {
      setError(e.message);
      return { failed: true, error: e };
    } finally {
      clearTimeout(timer.current);
      setLoading(false);
      setSlow(false);
    }
  };

  return { run, loading, slow, error, setError };
}
