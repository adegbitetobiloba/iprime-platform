import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import { ALUMNI_STATUS } from "../../accountTypes.js";
import EmptyState from "../../components/EmptyState.jsx";
import Dialog from "../../components/Dialog.jsx";
import Field from "../../components/Field.jsx";

const APPROVAL_LABEL = { pending: "Waiting for approval", approved: "Approved", rejected: "Declined" };
const approvalOf = (s) => s.approval || "approved"; // accounts created before approval existed count as approved

function Detail({ id, onClose }) {
  const { data, error, loading } = useFetch(`/admin/students/${id}`);
  return (
    <div className="panel" aria-live="polite">
      <div className="panel-head">
        <h2 className="panel-title">Account details</h2>
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
              ...(data.student.role === "student" ? [["Approval", APPROVAL_LABEL[approvalOf(data.student)]]] : []),
              ...(data.student.role === "alumni" ? [["Alumni status", ALUMNI_STATUS[data.student.alumniStatus] || data.student.alumniStatus], ["Year finished", data.student.alumni?.graduationYear || "Not added"], ["Last class", data.student.alumni?.lastClass || "Not added"], ["Note", data.student.alumni?.note || "None"]] : []),
              ["Email verified", data.student.isVerified ? "Yes" : "No"], ["Registered", fmtDate(data.student.createdAt)]].map(([k, v]) => (
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
  const { token } = useAuth();
  const [params] = useSearchParams();
  const [role, setRole] = useState("student");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [approval, setApproval] = useState(["pending", "approved", "rejected"].includes(params.get("approval")) ? params.get("approval") : "");
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState("");
  const [actionError, setActionError] = useState("");
  const [declining, setDeclining] = useState(null); // the account being declined
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Wait for the admin to stop typing before asking the server.
  useEffect(() => { const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [input]);
  useEffect(() => setPicked([]), [role, approval, search, page, status]);

  const query = `/admin/students?role=${role}&search=${encodeURIComponent(search)}&page=${page}&limit=15${role === "alumni" && status ? `&status=${status}` : ""}${role === "student" && approval ? `&approval=${approval}` : ""}`;
  const { data, error, loading, reload } = useFetch(query);
  const overview = useFetch("/admin/overview");
  const waiting = overview.data?.pendingStudents ?? 0;

  const refresh = useCallback(() => { reload(); overview.reload(); }, [reload, overview]);

  const decide = async (account, next, why) => {
    setActionError(""); setDone("");
    try {
      await api(`/admin/accounts/${account.id}/approval`, { method: "PATCH", token, body: { status: next, note: why || "" } });
      setDone(next === "approved" ? `${account.firstName} ${account.lastName} was approved. We emailed them.` : `${account.firstName} ${account.lastName} was declined.`);
      refresh();
      return true;
    } catch (e) { setActionError(e.message); return false; }
  };
  const confirmDecline = async () => {
    setBusy(true);
    const ok = await decide(declining, "rejected", note);
    setBusy(false);
    if (ok) { setDeclining(null); setNote(""); }
  };
  const approveSelected = async () => {
    setBusy(true); setActionError(""); setDone("");
    let count = 0;
    for (const id of picked) {
      try { await api(`/admin/accounts/${id}/approval`, { method: "PATCH", token, body: { status: "approved" } }); count += 1; }
      catch (e) { setActionError(`Stopped after ${count} approved: ${e.message}`); break; }
    }
    if (count) setDone(`${count} student${count === 1 ? "" : "s"} approved. We emailed them.`);
    setPicked([]); setBusy(false); refresh();
  };
  const reviewAlumni = async (id, next) => {
    setActionError("");
    try { await api(`/admin/alumni/${id}`, { method: "PATCH", token, body: { status: next } }); refresh(); } catch (e) { setActionError(e.message); }
  };

  const title = role === "student" ? "Students" : role === "parent" ? "Parents and guardians" : "Alumni";
  const rows = data?.students || [];
  const canBulk = role === "student" && approval === "pending" && rows.length > 0;
  const allPicked = canBulk && picked.length === rows.length;

  return (
    <div className="admin-page">
      <div className="page-bar">
        <div><p className="eyebrow">Administration</p><h1>{title}</h1></div>
        <div className="segmented" role="group" aria-label="Account type">
          {[["student", "Students"], ["parent", "Parents"], ["alumni", "Alumni"]].map(([r, label]) => (
            <button key={r} type="button" aria-pressed={role === r} onClick={() => { setRole(r); setPage(1); setSelected(null); setDone(""); }}>{label}</button>
          ))}
        </div>
      </div>

      {role === "student" && waiting > 0 && approval !== "pending" && (
        <div className="callout" role="status">
          <p><strong>{waiting} student{waiting === 1 ? " is" : "s are"} waiting for your approval.</strong> They cannot log in until you approve them.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setApproval("pending"); setPage(1); }}>Review now</button>
        </div>
      )}

      <div className="toolbar toolbar-row">
        <label className="sr-only" htmlFor="student-search">Search by name, email or student ID</label>
        <input id="student-search" type="search" placeholder="Search by name, email or student ID" value={input} onChange={(e) => setInput(e.target.value)} maxLength={80} />
        {role === "student" && (
          <>
            <label className="sr-only" htmlFor="approval-filter">Filter by approval</label>
            <select id="approval-filter" value={approval} onChange={(e) => { setApproval(e.target.value); setPage(1); }}>
              <option value="">All students</option>
              <option value="pending">Waiting for approval{waiting ? ` (${waiting})` : ""}</option>
              <option value="approved">Approved</option>
              <option value="rejected">Declined</option>
            </select>
          </>
        )}
        {role === "alumni" && (
          <>
            <label className="sr-only" htmlFor="alumni-status">Filter by verification status</label>
            <select id="alumni-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {Object.entries(ALUMNI_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </>
        )}
      </div>

      {done && <p className="alert alert-success" role="status">{done}</p>}
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {selected && <Detail id={selected} onClose={() => setSelected(null)} />}

      {canBulk && (
        <div className="bulkbar">
          <label className="check"><input type="checkbox" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} /> Select all on this page</label>
          <button type="button" className="btn btn-primary btn-sm" onClick={approveSelected} disabled={!picked.length || busy} aria-busy={busy}>
            {busy ? "Approving..." : `Approve selected (${picked.length})`}
          </button>
        </div>
      )}

      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={refresh}>Try again</button></p>}
      {loading && !data && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && rows.length === 0 && (
        <EmptyState icon={approval === "pending" ? "check" : "user"} title={approval === "pending" ? "Nobody is waiting for approval" : search ? "No matching accounts" : "No accounts yet"}>
          {approval === "pending" ? "New students appear here as soon as they register and verify their email." : search ? "Try a different name, email address or student ID." : "Accounts appear here as people register."}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table stack-mobile">
              <thead>
                <tr>
                  {canBulk && <th><span className="sr-only">Select</span></th>}
                  <th>Name</th><th>{role === "student" ? "Student ID" : role === "alumni" ? "Status" : "Role"}</th><th>Email</th><th>Phone</th><th>State</th>
                  {role === "student" && <th>Approval</th>}
                  <th>Registered</th><th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const ap = approvalOf(s);
                  const fullName = [s.firstName, s.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={s.id}>
                      {canBulk && <td data-label="Select"><input type="checkbox" aria-label={`Select ${fullName}`} checked={picked.includes(s.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} /></td>}
                      <td data-label="Name"><strong>{fullName}</strong></td>
                      <td data-label={role === "student" ? "Student ID" : role === "alumni" ? "Status" : "Role"}>{role === "student" ? (s.studentId || "—") : role === "alumni" ? (ALUMNI_STATUS[s.alumniStatus] || s.alumniStatus) : "Parent"}</td>
                      <td data-label="Email" className="cell-wrap">{s.email}</td>
                      <td data-label="Phone">{s.phone || "—"}</td>
                      <td data-label="State">{s.state || "—"}</td>
                      {role === "student" && <td data-label="Approval"><span className={`badge ${ap === "approved" ? "badge-ok" : ap === "rejected" ? "badge-bad" : "badge-warn"}`}>{APPROVAL_LABEL[ap]}</span></td>}
                      <td data-label="Registered">{fmtDate(s.createdAt)}</td>
                      <td className="row-actions">
                        <button type="button" className="link-btn" onClick={() => setSelected(s.id)}>View</button>
                        {role === "student" && ap !== "approved" && <button type="button" className="link-btn link-approve" onClick={() => decide(s, "approved")}>Approve</button>}
                        {role === "student" && ap !== "rejected" && <button type="button" className="link-btn link-danger" onClick={() => { setNote(""); setDeclining(s); }}>Decline</button>}
                        {role === "alumni" && s.alumniStatus !== "verified" && <button type="button" className="link-btn link-approve" onClick={() => reviewAlumni(s.id, "verified")}>Verify</button>}
                        {role === "alumni" && s.alumniStatus !== "rejected" && <button type="button" className="link-btn link-danger" onClick={() => reviewAlumni(s.id, "rejected")}>Decline</button>}
                      </td>
                    </tr>
                  );
                })}
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

      {declining && (
        <Dialog title={`Decline ${declining.firstName} ${declining.lastName}?`} onClose={() => setDeclining(null)} busy={busy}>
          <p className="muted">They will not be able to log in, and we will email them. You can approve them later if you change your mind.</p>
          <Field label="Note to the student (optional)" id="decline-note"><textarea id="decline-note" rows="3" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="form-actions" style={{ marginTop: "var(--s4)" }}>
            <button type="button" className="btn btn-danger-outline" onClick={confirmDecline} disabled={busy} aria-busy={busy}>{busy ? "Declining..." : "Decline registration"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDeclining(null)} disabled={busy}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
