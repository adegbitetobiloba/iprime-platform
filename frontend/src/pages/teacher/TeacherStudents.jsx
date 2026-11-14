import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { Async, Empty, PageHead, Pill } from "./ui.jsx";

const trendWord = (c) => (c == null ? "" : c > 2 ? "Improving" : c < -2 ? "Slipping" : "Steady");

// The students an administrator gave this teacher (directly or by subject), with real results.
export default function TeacherStudents() {
  const s = useFetch("/teacher/analytics/students");
  const [q, setQ] = useState("");
  const rows = (s.data?.students || []).filter((x) => `${x.firstName} ${x.lastName} ${x.studentId}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="admin-page">
      <PageHead eyebrow="Teacher area" title="My students" />
      <p className="muted">You see the students an administrator has given you, and only their results (no contact, payment or personal details). If you have a student through a subject, you see their results in that subject only.</p>
      <Async state={s}>
        {s.data && s.data.students.length === 0 ? (
          <Empty>No students yet. An administrator gives you students directly, or a whole subject group.</Empty>
        ) : (
          <>
            <label className="field-inline" style={{ display: "block", margin: "0 0 1rem" }}>
              <span className="sr-only">Search students</span>
              <input type="search" placeholder="Search by name or student ID" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", maxWidth: "26rem" }} />
            </label>
            {rows.length === 0 ? <Empty>Nobody matches “{q}”.</Empty> : (
              <ul className="tch-list">
                {rows.map((st) => (
                  <li key={st.id} className="tch-row">
                    <div>
                      <strong>{st.firstName} {st.lastName}</strong>
                      <small>{st.studentId} · {(st.via || []).join(", ") || "Assigned"}</small>
                      <small>{st.attempts ? `${st.attempts} attempt${st.attempts === 1 ? "" : "s"} · average ${st.averagePercentage}% · latest ${st.latest}%` : "No submitted attempts yet"}</small>
                    </div>
                    <div className="tch-actions">
                      {st.change != null && <Pill tone={st.change > 2 ? "ok" : st.change < -2 ? "bad" : undefined}>{trendWord(st.change)}</Pill>}
                      {st.checkIn && <Pill tone="warn">Worth a check-in</Pill>}
                      <Link className="btn btn-secondary" to={`/teacher/students/${st.id}`}>View</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Async>
    </div>
  );
}
