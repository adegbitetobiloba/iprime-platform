import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import { ALUMNI_STATUS } from "../../accountTypes.js";
import EmptyState from "../../components/EmptyState.jsx";

function Detail({ id, onClose }) {
  const { data, error, loading } = useFetch(`/admin/students/${id}`);
  return (
    <div className="panel" aria-live="polite">
      <div className="panel-head">
        <h2 className="panel-title">Student details</h2>
        <button type="button" className="link-btn" onClick={onClose}>Close</button>
      </div>
      {loading && <p className="muted">Loading...</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {data && (
        <>
          <dl className="details">
            {[["Name", [data.student.firstName, data.student.otherNames, data.student.lastName].filter(Boolean).join(" ")],
              ["Student ID", data.student.studentId || "Not assigned"], ["Email", data.student.email], ["Phone", data.student.phone || "Not added"],
              ["State", data.student.state || "Not added"],
              ...(data.student.role === "alumni" ? [["Alumni status", ALUMNI_STATUS[data.student.alumniStatus] || data.student.alumniStatus], ["Year finished", data.student.alumni?.graduationYear || "Not added"], ["Last class", data.student.alumni?.lastClass || "Not added"], ["Note", data.student.alumni?.note || "None"]] : []), ["Email verified", data.student.isVerified ? "Yes" : "No"], ["Registered", fmtDate(data.student.createdAt)]].map(([k, v]) => (
              <div key={k} className="details-row"><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <h3 style={{ marginTop: "var(--s5)" }}>Submitted examinations</h3>
          {data.attempts.length === 0 ? <p className="note">No submitted examinations yet.</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Examination</th><th>Submitted</th><th>Score</th></tr></thead>
                <tbody>
                  {data.attempts.map((a) => (
                    <tr key={a.id}><td><strong>{a.examTitle}</strong><br /><span className="muted">{a.subject}</span></td><td>{fmtDate(a.submittedAt)}</td><td>{a.score} / {a.totalMarks} ({a.percentage}%)</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminStudents() {
  const [role, setRole] = useState("student");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [actionError, setActionError] = useState("");
  const { token } = useAuth();

  // Wait for the admin to stop typing before asking the server.
  useEffect(() => { const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [input]);

  const { data, error, loading, reload } = useFetch(`/admin/students?role=${role}&search=${encodeURIComponent(search)}&page=${page}&limit=15${role === "alumni" && status ? `&status=${status}` : ""}`);

  const review = async (id, next) => {
    setActionError("");
    try { await api(`/admin/alumni/${id}`, { method: "PATCH", token, body: { status: next } }); reload(); } catch (e) { setActionError(e.message); }
  };
  const title = role === "student" ? "Students" : role === "parent" ? "Parents and guardians" : "Alumni";

  return (
    <div className="admin-page">
      <div className="page-bar">
        <div><p className="eyebrow">Administration</p><h1>{title}</h1></div>
        <div className="segmented" role="group" aria-label="Account type">
          <button type="button" aria-pressed={role === "student"} onClick={() => { setRole("student"); setPage(1); setSelected(null); }}>Students</button>
          <button type="button" aria-pressed={role === "parent"} onClick={() => { setRole("parent"); setPage(1); setSelected(null); }}>Parents</button>
          <button type="button" aria-pressed={role === "alumni"} onClick={() => { setRole("alumni"); setPage(1); setSelected(null); }}>Alumni</button>
        </div>
      </div>

      <div className="toolbar">
        <label className="sr-only" htmlFor="student-search">Search by name, email or student ID</label>
        <input id="student-search" type="search" placeholder="Search by name, email or student ID" value={input} onChange={(e) => setInput(e.target.value)} maxLength={80} />
      </div>

      {role === "alumni" && (
        <div className="toolbar">
          <label className="sr-only" htmlFor="alumni-status">Filter by verification status</label>
          <select id="alumni-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(ALUMNI_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}

      {selected && <Detail id={selected} onClose={() => setSelected(null)} />}

      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}
      {loading && !data && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && data.students.length === 0 && (
        <EmptyState icon="user" title={search ? "No matching accounts" : "No accounts yet"}>
          {search ? "Try a different name, email address or student ID." : "Accounts appear here as people register."}
        </EmptyState>
      )}
      {data && data.students.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>{role === "student" ? "Student ID" : role === "alumni" ? "Status" : "Role"}</th><th>Email</th><th>Phone</th><th>State</th><th>Verified</th><th>Registered</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{[s.firstName, s.lastName].filter(Boolean).join(" ")}</strong></td>
                    <td>{role === "student" ? (s.studentId || "—") : role === "alumni" ? (ALUMNI_STATUS[s.alumniStatus] || s.alumniStatus) : "Parent"}</td>
                    <td className="cell-wrap">{s.email}</td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.state || "—"}</td>
                    <td>{s.isVerified ? "Yes" : "No"}</td>
                    <td>{fmtDate(s.createdAt)}</td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => setSelected(s.id)}>View</button>
                      {role === "alumni" && s.alumniStatus !== "verified" && <button type="button" className="link-btn" onClick={() => review(s.id, "verified")}>Verify</button>}
                      {role === "alumni" && s.alumniStatus !== "rejected" && <button type="button" className="link-btn link-danger" onClick={() => review(s.id, "rejected")}>Decline</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted">{data.total} account{data.total === 1 ? "" : "s"} · page {data.page} of {data.pages}</span>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1 || loading}>Previous</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={data.page >= data.pages || loading}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
