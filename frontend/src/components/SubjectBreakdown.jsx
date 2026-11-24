import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import "../pages/exam-tools.css";

const clock = (s) => { if (s == null) return "—"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`; };

// The result slip: overall score, percentage and time, then every subject (JAMB style). Shown on the result page.
export default function SubjectBreakdown({ attemptId }) {
  const { token } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { let off = false; api(`/share/attempts/${attemptId}/breakdown`, { token }).then((x) => { if (!off) setD(x); }).catch(() => {}); return () => { off = true; }; }, [attemptId, token]);
  if (!d) return null;
  const { overall, subjects } = d;
  return (
    <section className="et rb" aria-labelledby="rb-h">
      <h2 id="rb-h">Your result</h2>
      <dl className="rb-overall">
        <div><dt>Questions</dt><dd>{overall.questions}</dd></div>
        <div><dt>Score</dt><dd>{overall.score}/{overall.total}</dd></div>
        <div><dt>Percentage</dt><dd>{overall.percentage}%</dd></div>
        <div><dt>Time spent</dt><dd>{clock(overall.timeUsedSeconds)}</dd></div>
      </dl>
      {subjects.length > 1 && (
        <>
          <h3 style={{ margin: "0 0 .4rem" }}>Breakdown by subject</h3>
          <table className="rb-table">
            <thead><tr><th scope="col">Subject</th><th scope="col">Score / total</th><th scope="col">Percentage</th></tr></thead>
            <tbody>{subjects.map((s) => (
              <tr key={s.subject}><th scope="row">{s.subject}</th><td>{s.score}/{s.total}</td>
                <td>{s.percentage}%<span className="rb-bar" aria-hidden="true"><i className={s.percentage >= 70 ? "is-high" : s.percentage < 40 ? "is-low" : ""} style={{ width: `${Math.min(100, s.percentage)}%` }} /></span></td></tr>
            ))}</tbody>
          </table>
        </>
      )}
    </section>
  );
}
