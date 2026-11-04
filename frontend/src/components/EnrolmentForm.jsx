import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Field from "./Field.jsx";
import { FORM_SUBJECTS, ageOf } from "../lib/enrolmentSubjects.js";
import "../enrolment.css";

const STEPS = [
  { id: "programme", title: "Programme and study", sections: "Sections A and F" },
  { id: "personal", title: "Your details", sections: "Section B" },
  { id: "guardian", title: "Parent or guardian", sections: "Section C" },
  { id: "academic", title: "School and results", sections: "Section D" },
  { id: "subjects", title: "Subjects", sections: "Section E" },
  { id: "access", title: "Devices and fees", sections: "Sections G and H" },
  { id: "health", title: "Health, emergency and how you heard of us", sections: "Sections I and J" },
  { id: "review", title: "Review and agree", sections: "Sections K and L" },
];
const COMMITMENT = "I agree to attend classes regularly, complete assignments, respect staff and protect tutorial facilities, and uphold the values of Prime Excelerate Tutelage.";
const GUARDIAN_TEXT = "I certify that information provided is correct and agree to the tutorials payment policy and regulation.";
const EMPTY = { programmeId: "", department: "", studyMode: "", session: "", student: {}, guardian: {}, academic: {}, subjectsRequested: [], otherSubject: "", technology: {}, payment: {}, health: {}, referral: {}, mockScore: "" };

// Turns what the server stored back into form values (dates as yyyy-mm-dd, the fee in naira).
const fromRecord = (r) => ({
  ...EMPTY, ...r, programmeId: r.programmeId || "",
  student: { ...r.student, dob: r.student?.dob ? String(r.student.dob).slice(0, 10) : "" },
  academic: { ...r.academic }, guardian: { ...r.guardian }, technology: { ...r.technology }, health: { ...r.health }, referral: { ...r.referral },
  payment: { plan: r.payment?.plan, agreedFee: typeof r.payment?.agreedFeeMinor === "number" ? String(r.payment.agreedFeeMinor / 100) : "" },
  mockScore: r.mockScore ?? "",
});
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null));

// What to send for one step. Empty numbers and dates are left out so they cannot fail validation.
function payloadFor(step, f) {
  switch (step) {
    case "programme": return clean({ department: f.department, studyMode: f.studyMode, session: f.session });
    case "personal": return { student: clean({ ...f.student }) };
    case "guardian": return { guardian: clean({ ...f.guardian }) };
    case "academic": return { academic: clean({ ...f.academic, graduationYear: f.academic.graduationYear ? Number(f.academic.graduationYear) : undefined }), ...(f.mockScore !== "" ? { mockScore: Number(f.mockScore) } : {}) };
    case "subjects": return { subjectsRequested: f.subjectsRequested, otherSubject: f.otherSubject || "" };
    case "access": return { technology: { ...(typeof f.technology.ownsSmartphone === "boolean" ? { ownsSmartphone: f.technology.ownsSmartphone } : {}), ...(typeof f.technology.availableForVirtual === "boolean" ? { availableForVirtual: f.technology.availableForVirtual } : {}) }, payment: clean({ agreedFee: f.payment.agreedFee, plan: f.payment.plan }) };
    case "health": return { health: clean({ ...f.health }), referral: clean({ ...f.referral }) };
    default: return {};
  }
}

export default function EnrolmentForm({ record, onSubmitted }) {
  const { token } = useAuth();
  const [programmes, setProgrammes] = useState([]);
  const [rec, setRec] = useState(record || null);
  const [f, setF] = useState(record ? fromRecord(record) : EMPTY);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [commit, setCommit] = useState(false);
  const [guard, setGuard] = useState({ signerName: "", relationship: "", agree: false });

  useEffect(() => { api("/public/programmes").then((d) => setProgrammes(d.programmes || [])).catch(() => {}); }, []);
  const set = (path, value) => setF((p) => { const next = structuredClone(p); const ks = path.split("."); let c = next; ks.slice(0, -1).forEach((k) => { c[k] = c[k] || {}; c = c[k]; }); c[ks.at(-1)] = value; return next; });
  const val = (path) => path.split(".").reduce((c, k) => (c == null ? "" : c[k]), f) ?? "";

  const age = ageOf(f.student.dob);
  const minor = age !== null && age < 18;
  const step = STEPS[i];

  // The same rules the server applies at submission, so the student sees what is still missing.
  const checks = useMemo(() => [
    ["A programme is chosen", !!f.programmeId], ["Date of birth is entered", !!f.student.dob], ["A phone number is entered", !!(f.student.phone || "").trim()],
    ["Physical, Online or Hybrid is chosen", !!f.studyMode], ["Morning, Afternoon or Evening is chosen", !!f.session], ["At least one subject is chosen", f.subjectsRequested.length > 0],
    ...(minor ? [["Parent or guardian name, relationship and phone are entered", !!(f.guardian.name && f.guardian.relationship && f.guardian.phone)], ["Parent or guardian consent is given below", !!(guard.agree && guard.signerName.trim() && guard.relationship.trim())]] : []),
    ["The student commitment is accepted", commit],
  ], [f, minor, guard, commit]);
  const ready = checks.every(([, ok]) => ok);

  // Saves the current step to the server (creating the draft on the first save)
  async function save(stepId) {
    if (stepId === "review") return true;
    setBusy(true); setErr(""); setSaved("");
    try {
      if (!rec) {
        if (!f.programmeId) throw new Error("Choose a programme first.");
        const d = await api("/enrolments", { method: "POST", token, body: { programmeId: f.programmeId, ...payloadFor("programme", f) } });
        setRec(d.enrolment);
      } else {
        const body = payloadFor(stepId, f);
        if (Object.keys(body).length) { const d = await api(`/enrolments/${rec.id}`, { method: "PATCH", token, body }); setRec(d.enrolment); }
      }
      setSaved("Saved. You can leave and come back later.");
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  const go = async (dir) => { if (dir > 0 && !(await save(step.id))) return; if (dir < 0 && rec) await save(step.id); setI((x) => Math.min(STEPS.length - 1, Math.max(0, x + dir))); window.scrollTo?.({ top: 0 }); };

  async function submit() {
    setBusy(true); setErr("");
    try {
      const d = await api(`/enrolments/${rec.id}/submit`, { method: "POST", token, body: { acknowledgements: { studentCommitment: true, ...(minor ? { guardian: { signerName: guard.signerName.trim(), relationship: guard.relationship.trim() } } : {}) } } });
      onSubmitted?.(d.enrolment);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const T = ({ label, path, type = "text", ...rest }) => <Field label={label} id={`f-${path}`}><input id={`f-${path}`} type={type} value={val(path)} onChange={(e) => set(path, e.target.value)} {...rest} /></Field>;
  const Pick = ({ label, path, options }) => (
    <fieldset className="enr-choice"><legend>{label}</legend>
      {options.map(([v, l]) => <label key={v}><input type="radio" name={path} checked={val(path) === v} onChange={() => set(path, v)} /> {l}</label>)}
    </fieldset>
  );
  const YesNo = ({ label, path }) => (
    <fieldset className="enr-choice"><legend>{label}</legend>
      <label><input type="radio" name={path} checked={val(path) === true} onChange={() => set(path, true)} /> Yes</label>
      <label><input type="radio" name={path} checked={val(path) === false} onChange={() => set(path, false)} /> No</label>
    </fieldset>
  );

  return (
    <div className="enr-card" aria-labelledby="enr-form-h">
      <h2 id="enr-form-h">Student registration form</h2>
      {rec && <p className="muted" style={{ margin: 0 }}>Your reference: <strong>{rec.reference}</strong></p>}
      <p style={{ margin: "10px 0 0" }}><strong>Step {i + 1} of {STEPS.length}: {step.title}</strong> <span className="muted">({step.sections})</span></p>
      <div className="enr-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1} aria-label="Form progress"><span style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>

      <div className="enr-grid" style={{ marginTop: 14 }}>
        {step.id === "programme" && (<>
          <Field label="Programme or school" id="f-programme"><select id="f-programme" value={f.programmeId} disabled={!!rec} onChange={(e) => set("programmeId", e.target.value)}><option value="">Choose a programme</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
          {T({ label: "Department (if you know it)", path: "department", maxLength: 80 })}
          <div className="wide">{Pick({ label: "How will you study?", path: "studyMode", options: [["physical", "Physical"], ["online", "Online"], ["hybrid", "Hybrid"]] })}</div>
          <div className="wide">{Pick({ label: "Preferred session", path: "session", options: [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]] })}</div>
          <p className="muted wide" style={{ margin: 0 }}>Date of registration and registration number are created for you when you start. They are shown above as your reference.</p>
        </>)}
        {step.id === "personal" && (<>
          {T({ label: "Preferred name or nickname", path: "student.preferredName", maxLength: 60 })}
          <Field label="Gender" id="f-gender"><select id="f-gender" value={val("student.gender")} onChange={(e) => set("student.gender", e.target.value)}><option value="">Choose</option><option value="male">Male</option><option value="female">Female</option></select></Field>
          {T({ label: "Date of birth", path: "student.dob", type: "date", max: new Date().toISOString().slice(0, 10) })}
          <p className="muted" style={{ margin: 0, alignSelf: "end" }}>{age === null ? "Your age is worked out from your date of birth." : `Age: ${age}${minor ? " (a parent or guardian must give consent)" : ""}`}</p>
          {T({ label: "Marital status", path: "student.maritalStatus", maxLength: 30 })}
          {T({ label: "State of origin", path: "student.stateOfOrigin", maxLength: 60 })}
          {T({ label: "Local government area", path: "student.lga", maxLength: 80 })}
          <div className="wide">{T({ label: "Residential address", path: "student.address", maxLength: 300 })}</div>
          {T({ label: "Phone number", path: "student.phone", type: "tel", inputMode: "tel", maxLength: 20 })}
          {T({ label: "WhatsApp number", path: "student.whatsapp", type: "tel", inputMode: "tel", maxLength: 20 })}
          {T({ label: "Email address", path: "student.email", type: "email", maxLength: 120 })}
        </>)}
        {step.id === "guardian" && (<>
          <p className="wide" style={{ margin: 0 }}>{minor ? "You are under 18, so a parent or guardian's details are required." : "Fill this in if a parent or guardian is responsible for your fees or you are under 18."}</p>
          {T({ label: "Full name", path: "guardian.name", maxLength: 100 })}
          {T({ label: "Relationship to the student", path: "guardian.relationship", maxLength: 60 })}
          {T({ label: "Occupation", path: "guardian.occupation", maxLength: 100 })}
          {T({ label: "Phone number", path: "guardian.phone", type: "tel", inputMode: "tel", maxLength: 20 })}
          {T({ label: "Alternative phone number", path: "guardian.altPhone", type: "tel", inputMode: "tel", maxLength: 20 })}
          {T({ label: "Email address", path: "guardian.email", type: "email", maxLength: 120 })}
          <div className="wide">{T({ label: "Residential address", path: "guardian.address", maxLength: 300 })}</div>
        </>)}
        {step.id === "academic" && (<>
          {T({ label: "Current school", path: "academic.currentSchool", maxLength: 120 })}
          {T({ label: "Current class", path: "academic.currentClass", maxLength: 60 })}
          {T({ label: "Year of graduation (if applicable)", path: "academic.graduationYear", type: "number", inputMode: "numeric", min: 1950, max: new Date().getFullYear() + 10 })}
          {T({ label: "Examination written", path: "academic.examinationWritten", maxLength: 120 })}
          <div className="wide"><Field label="Best grades obtained" id="f-grades"><textarea id="f-grades" rows="2" maxLength={500} value={val("academic.bestGrades")} onChange={(e) => set("academic.bestGrades", e.target.value)} /></Field></div>
          {T({ label: "Mock score (your own figure, not yet verified)", path: "mockScore", type: "number", inputMode: "numeric", min: 0, max: 1000 })}
        </>)}
        {step.id === "subjects" && (
          <div className="wide">
            <fieldset className="enr-subjects"><legend style={{ fontWeight: 700, marginBottom: 8 }}>Subjects you want to be taught</legend>
              {FORM_SUBJECTS.map((s) => <label key={s}><input type="checkbox" checked={f.subjectsRequested.includes(s)} onChange={(e) => set("subjectsRequested", e.target.checked ? [...f.subjectsRequested, s] : f.subjectsRequested.filter((x) => x !== s))} /> {s}</label>)}
            </fieldset>
            <div style={{ marginTop: 12 }}>{T({ label: "Others (write the subject)", path: "otherSubject", maxLength: 80 })}</div>
            <p className="muted">The office confirms the final subjects for you.</p>
          </div>
        )}
        {step.id === "access" && (<>
          {YesNo({ label: "Do you own a smartphone?", path: "technology.ownsSmartphone" })}
          {YesNo({ label: "Are you available for virtual classes?", path: "technology.availableForVirtual" })}
          {T({ label: "Tuition fee you agree to pay (naira)", path: "payment.agreedFee", inputMode: "decimal", placeholder: "For example 18000" })}
          {Pick({ label: "Payment plan", path: "payment.plan", options: [["weekly", "Weekly"], ["biweekly", "Bi-weekly"], ["monthly", "Monthly"]] })}
          <p className="muted wide" style={{ margin: 0 }}>The office confirms the approved fee. What you type here is only what you agree to pay and does not set the price.</p>
        </>)}
        {step.id === "health" && (<>
          <p className="muted wide" style={{ margin: 0 }}>Only share what helps us look after you. Only authorised office staff can see this section.</p>
          <div className="wide"><Field label="Medical condition or learning difficulty (optional)" id="f-cond"><textarea id="f-cond" rows="2" maxLength={500} value={val("health.condition")} onChange={(e) => set("health.condition", e.target.value)} /></Field></div>
          {T({ label: "Emergency contact name", path: "health.emergencyName", maxLength: 100 })}
          {T({ label: "Emergency contact number", path: "health.emergencyPhone", type: "tel", inputMode: "tel", maxLength: 20 })}
          {T({ label: "How did you hear about Prime Excelerate Tutelage?", path: "referral.source", maxLength: 120 })}
          {T({ label: "Referrer's name (if any)", path: "referral.referrerName", maxLength: 100 })}
        </>)}
        {step.id === "review" && (
          <div className="wide">
            <h3 style={{ marginTop: 0 }}>Before you submit</h3>
            <ul className="enr-check" aria-label="Checklist">{checks.map(([l, ok]) => <li key={l} className={ok ? "ok" : ""}><span className="sr-only">{ok ? "Done: " : "Still needed: "}</span>{l}</li>)}</ul>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "12px 0" }}><input type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)} style={{ width: "auto", marginTop: 4 }} /><span><strong>Student commitment.</strong> {COMMITMENT}</span></label>
            {minor && (
              <div className="enr-card" style={{ margin: "12px 0" }}>
                <h3 style={{ marginTop: 0 }}>Parent or guardian consent</h3>
                <p>{GUARDIAN_TEXT}</p>
                <div className="enr-grid">
                  <Field label="Parent or guardian's full name" id="g-name"><input id="g-name" value={guard.signerName} maxLength={100} onChange={(e) => setGuard({ ...guard, signerName: e.target.value })} /></Field>
                  <Field label="Relationship to the student" id="g-rel"><input id="g-rel" value={guard.relationship} maxLength={60} onChange={(e) => setGuard({ ...guard, relationship: e.target.value })} /></Field>
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 10 }}><input type="checkbox" checked={guard.agree} onChange={(e) => setGuard({ ...guard, agree: e.target.checked })} style={{ width: "auto", marginTop: 4 }} /><span>I am the parent or guardian and I agree to the statement above. (Typing my name is my acknowledgement; it is not a handwritten signature.)</span></label>
              </div>
            )}
            <div className="enr-card enr-office"><strong>Section M: office use only.</strong> The office completes the subjects registered, the approved fee and the registrar's details. You do not fill this in.</div>
          </div>
        )}
      </div>

      {err && <p className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{err}</p>}
      {saved && !err && <p className="alert alert-success" role="status" style={{ marginTop: 12 }}>{saved}</p>}
      <div className="enr-actions">
        <button type="button" className="btn btn-secondary" onClick={() => go(-1)} disabled={busy || i === 0}>Back</button>
        <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {step.id !== "review" && rec && <button type="button" className="btn btn-secondary" onClick={() => save(step.id)} disabled={busy}>Save draft</button>}
          {step.id !== "review"
            ? <button type="button" className="btn btn-primary" onClick={() => go(1)} disabled={busy || (!rec && !f.programmeId)} aria-busy={busy}>{busy ? "Saving..." : "Save and continue"}</button>
            : <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !ready || !rec} aria-busy={busy}>{busy ? "Submitting..." : "Submit my application"}</button>}
        </span>
      </div>
    </div>
  );
}
