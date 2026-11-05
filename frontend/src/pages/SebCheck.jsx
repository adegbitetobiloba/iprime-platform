import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";

// Open this page INSIDE Safe Exam Browser (with ?exam=<examination id>) to confirm the examiner's keys work before exam day.
export default function SebCheck() {
  const [params] = useSearchParams();
  const exam = params.get("exam") || "";
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!exam) return; api(`/share/seb-check?exam=${encodeURIComponent(exam)}`).then(setR).catch((e) => setError(e.message)); }, [exam]);
  return (
    <section className="section"><div className="container narrow">
      <h1>Safe Exam Browser check</h1>
      {!exam && <p className="alert alert-error">Add <code>?exam=</code> and the examination's id to the address.</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {r && (
        <ul className="plain-list" role="status">
          <li>{r.sebDetected ? "✓ Safe Exam Browser was detected." : "✕ Safe Exam Browser was not detected. You are in an ordinary browser."}</li>
          <li>{!r.required ? "This examination does not require Safe Exam Browser." : r.ok ? "✓ Your browser's key matches an approved key. Students using this configuration will be accepted." : "✕ Your browser's key does NOT match an approved key. Students would be refused. Check the keys you entered."}</li>
        </ul>
      )}
    </div></section>
  );
}
