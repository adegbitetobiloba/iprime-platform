import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import EmptyState from "../../components/EmptyState.jsx";
import Dialog from "../../components/Dialog.jsx";
import Field from "../../components/Field.jsx";

const STATUS_LABEL = { submitted: "Submitted", under_review: "Under review", more_info_required: "More information needed", approved: "Approved", rejected: "Declined" };
const BADGE = { submitted: "badge-warn", under_review: "badge-warn", more_info_required: "badge-warn", approved: "badge-ok", rejected: "badge-bad" };
const TABS = [["submitted", "Submitted"], ["under_review", "Under review"], ["more_info_required", "More information"], ["approved", "Approved"], ["rejected", "Declined"], ["", "All"]];
const OPEN_FOR_OFFICE = ["submitted", "under_review", "more_info_required"];
const naira = (m) => (typeof m === "number" ? (m / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" }) : "Not set");
const yesNo = (v) => (v === true ? "Yes" : v === false ? "No" : "Not answered");
const show = (v) => (v === undefined || v === null || v === "" ? "Not provided" : v);
const ageOf = (dob) => { const d = new Date(dob); if (!dob || Number.isNaN(d.getTime())) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a -= 1; return a >= 0 ? a : null; };

function KV({ rows }) {
  return <dl className="adm-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function OfficePanel({ e, onSaved }) {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState(e.subjectsRegistered || []);
  const [extra, setExtra] = useState("");
  const [fee, setFee] = useState(typeof e.office?.feeApprovedMinor === "number" ? String(e.office.feeApprovedMinor / 100) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const editable = OPEN_FOR_OFFICE.includes(e.status);
  const options = Array.from(new Set([...(e.subjectsRequested || []), ...subjects]));

  const save = async () => {
    setBusy(true); setMsg({ ok: "", err: "" });
    const all = Array.from(new Set([...subjects, ...extra.split(",").map((s) => s.trim()).filter(Boolean)]));
    const body = { subjectsRegistered: all };
    if (fee.trim() !== "") body.feeApproved = fee.trim();
    try {
      await api(`/admin/enrolments/${e.id}/office`, { method: "PATCH", token, body });
      setSubjects(all); setExtra(""); setMsg({ ok: "Saved.", err: "" }); onSaved();
    } catch (err) { setMsg({ ok: "", err: err.message }); }
    setBusy(false);
  };

  return (
    <div>
      <p className="adm-note">Subjects registered and the approved fee are recorded separately from what the student asked for and typed. Neither replaces the other.</p>
      <KV rows={[["Subjects requested by the student", (e.subjectsRequested || []).join(", ") || "None chosen"], ["Other subject typed by the student", show(e.otherSubject)], ["Agreed fee typed by the student", naira(e.payment?.agreedFeeMinor)], ["Payment plan", show(e.payment?.plan)]]} />
      <fieldset disabled={!editable || busy} style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
        <legend><strong>Subjects registered (office)</strong></legend>
        {options.length === 0 && <p className="muted">The student did not choose any subjects.</p>}
        {options.map((s) => (
          <label key={s} className="check" style={{ display: "block", margin: "6px 0" }}>
            <input type="checkbox" checked={subjects.includes(s)} onChange={(ev) => setSubjects((p) => (ev.target.checked ? [...p, s] : p.filter((x) => x !== s)))} /> {s}
            {!(e.subjectsRequested || []).includes(s) && <span className="muted"> (added by office)</span>}
          </label>
        ))}
        <Field label="Add other subjects (separate with commas)" id="extra-subjects"><input id="extra-subjects" value={extra} onChange={(ev) => setExtra(ev.target.value)} maxLength={200} /></Field>
        <Field label="Fee approved (naira)" id="fee-approved"><input id="fee-approved" inputMode="decimal" value={fee} onChange={(ev) => setFee(ev.target.value)} placeholder="For example 18000" /></Field>
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={save} aria-busy={busy}>{busy ? "Saving..." : "Save office details"}</button>
        </div>
      </fieldset>
      {!editable && <p className="adm-note">This application is closed, so office details can no longer be changed.</p>}
      {msg.ok && <p className="alert alert-success" role="status">{msg.ok}</p>}
      {msg.err && <p className="alert alert-error" role="alert">{msg.err}</p>}
    </div>
  );
}

const PANELS = [["summary", "Summary"], ["student", "Student"], ["family", "Guardian and school"], ["medical", "Medical"], ["office", "Office"], ["history", "History"]];

function Detail({ id, onClose, onChanged }) {
  const { token } = useAuth();
  const { data, error, loading, reload } = useFetch(`/admin/enrolments/${id}`);
  const [tab, setTab] = useState("summary");
  const [ask, setAsk] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const headRef = useRef(null);
  useEffect(() => { setTab("summary"); setMsg({ ok: "", err: "" }); headRef.current?.focus(); }, [id]);

  const act = async (action, body = {}) => {
    setBusy(true); setMsg({ ok: "", err: "" });
    try {
      await api(`/admin/enrolments/${id}/${action}`, { method: "POST", token, body });
      setMsg({ ok: "Done.", err: "" }); setAsk(null); setNote(""); reload(); onChanged();
    } catch (e) { setMsg({ ok: "", err: e.message }); }
    setBusy(false);
  };
  const onKey = (ev) => { // arrow keys move between tabs
    const i = PANELS.findIndex(([k]) => k === tab);
    if (ev.key === "ArrowRight") { ev.preventDefault(); setTab(PANELS[(i + 1) % PANELS.length][0]); }
    if (ev.key === "ArrowLeft") { ev.preventDefault(); setTab(PANELS[(i - 1 + PANELS.length) % PANELS.length][0]); }
  };

  const e = data?.enrolment;
  const a = data?.applicant;
  const canReview = e && OPEN_FOR_OFFICE.includes(e.status);
  const noSubjects = e && (e.subjectsRegistered || []).length === 0;
  const age = e ? ageOf(e.student?.dob) : null;

  return (
    <section className="adm-detail" aria-label="Application details">
      <div className="adm-detail-head">
        <div className="adm-detail-title">
          <h2 ref={headRef} tabIndex={-1}>{a ? `${a.firstName} ${a.lastName}` : "Application"}{e ? <span className="muted" style={{ fontWeight: 600 }}> · {e.reference}</span> : null}</h2>
          <button type="button" className="btn btn-secondary btn-sm adm-back" onClick={onClose}>Back to list</button>
          <button type="button" className="link-btn" onClick={onClose}>Close</button>
        </div>
        {e && (
          <>
            <p style={{ margin: 0 }}><span className={`badge ${BADGE[e.status] || ""}`}>{STATUS_LABEL[e.status] || e.status}</span> <span className="muted">Submitted {fmtDate(e.submittedAt)}</span></p>
            {canReview && (
              <div className="adm-actions">
                {e.status === "submitted" && <button type="button" className="btn btn-secondary btn-sm" onClick={() => act("start-review")} disabled={busy}>Start review</button>}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => act("approve")} disabled={busy || noSubjects} title={noSubjects ? "Save the registered subjects on the Office tab first" : undefined}>Approve</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setNote(""); setAsk("request-info"); }} disabled={busy}>Ask for more information</button>
                <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => { setNote(""); setAsk("reject"); }} disabled={busy}>Decline</button>
              </div>
            )}
            {canReview && noSubjects && <p className="muted" style={{ margin: 0 }}>To approve, first save the registered subjects on the Office tab.</p>}
            {e.status === "approved" && <p className="muted" style={{ margin: 0 }}>Approved. This does not activate class access: that needs verified payment.</p>}
            {msg.ok && <p className="alert alert-success" role="status" style={{ margin: 0 }}>{msg.ok}</p>}
            {msg.err && <p className="alert alert-error" role="alert" style={{ margin: 0 }}>{msg.err}</p>}
            <div className="adm-tabs" role="tablist" aria-label="Application sections" style={{ margin: 0 }} onKeyDown={onKey}>
              {PANELS.map(([k, label]) => (
                <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="app-panel" tabIndex={tab === k ? 0 : -1} className="adm-tab" onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="adm-body" role="tabpanel" id="app-panel" aria-labelledby={`tab-${tab}`}>
        {loading && !data && <p className="muted" style={{ paddingTop: 12 }}>Loading...</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {e && tab === "summary" && (
          <KV rows={[
            ["Programme", show(e.programmeTitle)], ["Mode", show(e.studyMode)], ["Session", show(e.session)],
            ["Subjects requested", (e.subjectsRequested || []).join(", ") || "None chosen"], ["Subjects registered (office)", (e.subjectsRegistered || []).join(", ") || "Not yet confirmed"],
            ["Agreed fee typed by the student", naira(e.payment?.agreedFeeMinor)], ["Fee approved (office)", naira(e.office?.feeApprovedMinor)],
            ["Age", age === null ? "Not provided" : `${age}${age < 18 ? " (under 18: guardian consent required)" : ""}`],
            ["Consents recorded", (e.consents || []).length ? (e.consents || []).map((c) => (c.kind === "guardian_consent" ? "Guardian" : "Student")).join(" and ") : "None"],
            ["Account email", show(a?.email)], ["Student ID", show(a?.studentId)],
          ]} />
        )}
        {e && tab === "student" && (
          <KV rows={[
            ["Preferred name", show(e.student?.preferredName)], ["Date of birth", e.student?.dob ? new Date(e.student.dob).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not provided"],
            ["Marital status", show(e.student?.maritalStatus)], ["State of origin", show(e.student?.stateOfOrigin)], ["LGA", show(e.student?.lga)], ["Address", show(e.student?.address)],
            ["Phone", show(e.student?.phone)], ["WhatsApp", show(e.student?.whatsapp)], ["Email", show(e.student?.email)],
            ["Owns a smartphone", yesNo(e.technology?.ownsSmartphone)], ["Available for virtual classes", yesNo(e.technology?.availableForVirtual)],
            ["How they heard about Prime", show(e.referral?.source)], ["Referrer", show(e.referral?.referrerName)],
          ]} />
        )}
        {e && tab === "family" && (
          <>
            <h3 style={{ marginTop: 14 }}>Parent or guardian</h3>
            <KV rows={[["Name", show(e.guardian?.name)], ["Relationship", show(e.guardian?.relationship)], ["Occupation", show(e.guardian?.occupation)], ["Phone", show(e.guardian?.phone)], ["Alternative phone", show(e.guardian?.altPhone)], ["Email", show(e.guardian?.email)], ["Address", show(e.guardian?.address)]]} />
            <h3 style={{ marginTop: 18 }}>Academic background</h3>
            <KV rows={[["Current school", show(e.academic?.currentSchool)], ["Current class", show(e.academic?.currentClass)], ["Year of graduation", show(e.academic?.graduationYear)], ["Examination written", show(e.academic?.examinationWritten)], ["Best grades", show(e.academic?.bestGrades)], ["Mock score (self-reported, not verified)", show(e.mockScore)]]} />
          </>
        )}
        {e && tab === "medical" && (
          <>
            <p className="adm-note">Restricted information. Use it only for student support and safety.</p>
            <KV rows={[["Medical condition or learning difficulty", show(e.health?.condition)], ["Emergency contact", show(e.health?.emergencyName)], ["Emergency number", show(e.health?.emergencyPhone)]]} />
          </>
        )}
        {e && tab === "office" && <OfficePanel key={`${e.id}-${e.status}`} e={e} onSaved={() => { reload(); onChanged(); }} />}
        {e && tab === "history" && (
          <>
            <h3 style={{ marginTop: 14 }}>Review history</h3>
            {(e.reviews || []).length === 0 ? <p className="muted">No review actions yet.</p> : <ul>{e.reviews.map((r, i) => <li key={i}>{STATUS_LABEL[r.action] || r.action}, {fmtDate(r.at)}{r.note ? `: ${r.note}` : ""}</li>)}</ul>}
            <h3 style={{ marginTop: 18 }}>Consent</h3>
            {(e.consents || []).length === 0 ? <p className="muted">None recorded.</p> : (
              <ul>{e.consents.map((c, i) => <li key={i}>{c.kind === "guardian_consent" ? "Parent or guardian consent" : "Student commitment"}{c.signerName ? ` by ${c.signerName}${c.relationship ? ` (${c.relationship})` : ""}` : ""}, typed acknowledgement, {fmtDate(c.at)}, policy {c.policyVersion || "unknown"}</li>)}</ul>
            )}
          </>
        )}
      </div>

      {ask && (
        <Dialog role="alertdialog" title={ask === "reject" ? "Decline this application?" : "Ask the student for more information?"} description={ask === "reject" ? "A reason is required and is kept in the application history." : "Say exactly what the student must correct. They can then edit and resubmit."} onClose={() => setAsk(null)} busy={busy}>
          <Field label={ask === "reject" ? "Reason (required)" : "What needs to be corrected (required)"} id="review-note"><textarea id="review-note" rows="3" maxLength={500} value={note} onChange={(ev) => setNote(ev.target.value)} /></Field>
          <div className="form-actions" style={{ marginTop: "var(--s4)" }}>
            <button type="button" className={ask === "reject" ? "btn btn-danger-outline" : "btn btn-primary"} disabled={busy || !note.trim()} aria-busy={busy} onClick={() => act(ask, { note: note.trim() })}>{busy ? "Saving..." : ask === "reject" ? "Decline application" : "Send request"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setAsk(null)} disabled={busy}>Cancel</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export default function AdminApplications() {
  const [status, setStatus] = useState("submitted");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const list = useFetch(`/admin/enrolments?status=${status}&page=${page}&limit=15`);
  const summary = useFetch("/admin/enrolments/summary");
  const rows = list.data?.enrolments || [];
  const counts = summary.data?.counts || {};
  const countFor = (k) => (k === "" ? summary.data?.total : counts[k]);
  const refresh = () => { list.reload(); summary.reload(); };

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Admissions</p><h1>Student applications</h1><p>Review each application, confirm the subjects and fee, then approve, ask for corrections, or decline.</p></div></header>

      <div className="adm-tabs" role="group" aria-label="Filter applications by status">
        {TABS.map(([k, label]) => (
          <button key={label} type="button" className="adm-tab" aria-pressed={status === k} onClick={() => { setStatus(k); setPage(1); setSelected(null); }}>
            {label}{countFor(k) !== undefined && <span className="adm-tab-n">{countFor(k)}</span>}
          </button>
        ))}
      </div>

      {list.error && <p className="alert alert-error" role="alert">{list.error} <button type="button" className="link-btn" onClick={refresh}>Try again</button></p>}
      {list.loading && !list.data && <div className="exam-card skeleton" aria-hidden="true" />}
      {list.data && rows.length === 0 && !selected && (
        <EmptyState icon={status === "submitted" ? "check" : "user"} title={status === "submitted" ? "No applications are waiting" : "No applications in this view"}>
          {status === "submitted" ? "Applications appear here once a student submits the enrolment form." : "Choose another status above."}
        </EmptyState>
      )}

      {(rows.length > 0 || selected) && (
        <div className={`adm-split${selected ? " has-detail" : ""}`}>
          <div className="adm-list-wrap">
            <ul className="adm-list" aria-label="Applications">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" className="adm-row" aria-current={selected === r.id ? "true" : undefined} onClick={() => setSelected(r.id)}>
                    <span className="adm-row-top"><span className="adm-row-name">{r.applicant ? `${r.applicant.firstName} ${r.applicant.lastName}` : r.reference}</span><span className={`badge ${BADGE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span></span>
                    <span className="adm-row-meta">{[r.programmeTitle, [r.studyMode, r.session].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No programme"}</span>
                    <span className="adm-row-meta">{r.reference} · {fmtDate(r.submittedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {list.data && list.data.pages > 1 && (
              <div className="adm-pager">
                <span className="muted">Page {list.data.page} of {list.data.pages}</span>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={list.data.page <= 1 || list.loading}>Previous</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={list.data.page >= list.data.pages || list.loading}>Next</button>
                </div>
              </div>
            )}
          </div>
          {selected && <Detail id={selected} onClose={() => setSelected(null)} onChanged={refresh} />}
        </div>
      )}
    </div>
  );
}
