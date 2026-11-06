import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch } from "../useFetch.js";
import { useSubmit } from "../useSubmit.js";
import Field from "./Field.jsx";
import FormStatus from "./FormStatus.jsx";
import { STARTER_SET, PORTRAIT_FILES, hiddenReason } from "../achievements.js";

const blank = {
  name: "", label: "JAMB score", examType: "UTME", year: "", score: "", programme: "",
  portraitPath: "", portraitAlt: "", verified: false, evidenceRef: "", consent: "pending",
  isMinor: false, guardianConsent: false, imageConsent: false,
  testimonial: "", testimonialApproved: false, published: false, order: "0",
};
const toForm = (a) => ({
  name: a.name || "", label: a.label || "", examType: a.examType || "UTME", year: a.year ? String(a.year) : "", score: String(a.score ?? ""),
  programme: a.programme || "", portraitPath: a.portraitPath || "", portraitAlt: a.portraitAlt || "", verified: Boolean(a.verified),
  evidenceRef: a.evidenceRef || "", consent: a.consent || "pending", isMinor: Boolean(a.isMinor), guardianConsent: Boolean(a.guardianConsent),
  imageConsent: Boolean(a.imageConsent), testimonial: a.testimonial || "", testimonialApproved: Boolean(a.testimonialApproved),
  published: Boolean(a.published), order: String(a.order ?? 0),
});
const toBody = (f) => ({
  name: f.name, label: f.label, examType: f.examType || "UTME", year: f.year === "" ? null : Number(f.year), score: Number(f.score),
  programme: f.programme, portraitPath: f.portraitPath, portraitAlt: f.portraitAlt, verified: f.verified, evidenceRef: f.evidenceRef,
  consent: f.consent, isMinor: f.isMinor, guardianConsent: f.guardianConsent, imageConsent: f.imageConsent,
  testimonial: f.testimonial, testimonialApproved: f.testimonialApproved, published: f.published, order: Number(f.order) || 0,
});

function Check({ id, checked, onChange, children, hint }) {
  return (
    <div className="field">
      <label htmlFor={id} className="ws5-check-row">
        <input id={id} type="checkbox" checked={checked} onChange={onChange} />
        <span>{children}</span>
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

// Student achievements shown on the website. Lives on the admin Programmes page.
export default function AchieversAdmin() {
  const { token } = useAuth();
  const { data, error, loading, reload } = useFetch("/admin/achievers");
  const [editing, setEditing] = useState(null); // null = closed, "new" or an id
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const tick = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const save = useSubmit(async () => {
    const body = toBody(form);
    if (editing === "new") await api("/admin/achievers", { method: "POST", token, body });
    else await api(`/admin/achievers/${editing}`, { method: "PATCH", token, body });
    setSaved(editing === "new" ? "Achievement added." : "Achievement saved.");
    setEditing(null);
    reload();
  });

  const open = (a) => { setSaved(""); setActionError(""); save.setError(""); setForm(a ? toForm(a) : blank); setEditing(a ? a._id : "new"); };
  const patch = async (a, body, ok) => {
    setActionError(""); setSaved("");
    try { await api(`/admin/achievers/${a._id}`, { method: "PATCH", token, body }); if (ok) setSaved(ok); reload(); } catch (e) { setActionError(e.message); }
  };
  const post = async (a, action, ok) => {
    setActionError(""); setSaved("");
    try { await api(`/admin/achievers/${a._id}/${action}`, { method: "POST", token }); setSaved(ok); reload(); } catch (e) { setActionError(e.message); }
  };
  const addStarters = async () => {
    setBusy(true); setActionError(""); setSaved("");
    try {
      for (let i = 0; i < STARTER_SET.length; i += 1) {
        const s = STARTER_SET[i];
        await api("/admin/achievers", {
          method: "POST", token,
          body: { name: s.name, label: s.label, examType: s.examType, year: s.year, score: s.score, programme: s.programme, portraitPath: s.portrait.src, portraitAlt: s.portrait.alt,
            verified: true, evidenceRef: s.evidenceRef, consent: "granted", isMinor: false, guardianConsent: false, imageConsent: true, published: true, order: i },
        });
      }
      setSaved("The four scholars from the flyer were added. Open each one to add the proper name, year and evidence.");
      reload();
    } catch (e) { setActionError(e.message); reload(); } finally { setBusy(false); }
  };

  const list = data?.achievers || [];
  return (
    <section className="ws5-admin-section" aria-labelledby="ach-admin-title">
      <div className="page-bar">
        <div><p className="eyebrow">Website</p><h2 id="ach-admin-title">Student achievements</h2></div>
        {!editing && <button type="button" className="btn btn-primary" onClick={() => open(null)}>Add achievement</button>}
      </div>
      <p className="muted">
        These appear on the Achievements page and the home page. A person is shown only when the record is switched on, verified, and consent is granted
        (guardian consent as well for anyone under 18). Choosing "Withdrawn" removes them from the website straight away.
      </p>
      {saved && <p className="alert alert-success" role="status">{saved}</p>}
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}

      {editing && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); save.run(); }}>
          <h3 className="panel-title">{editing === "new" ? "Add achievement" : "Edit achievement"}</h3>
          <div className="grid-2">
            <Field label="Name (optional)" id="a-name" value={form.name} onChange={set("name")} maxLength={120} hint='Leave blank to show "Prime Excelerate scholar".' />
            <Field label="Score" id="a-score" type="number" min="0" max="1000" value={form.score} onChange={set("score")} required />
          </div>
          <div className="grid-2">
            <Field label="Examination" id="a-exam" value={form.examType} onChange={set("examType")} maxLength={60} hint="For example: UTME" />
            <Field label="Year (optional)" id="a-year" type="number" min="2000" max="2100" value={form.year} onChange={set("year")} />
          </div>
          <div className="grid-2">
            <Field label="Caption under the score" id="a-label" value={form.label} onChange={set("label")} maxLength={60} hint="For example: JAMB score" />
            <Field label="Programme or mode attended (optional)" id="a-prog" value={form.programme} onChange={set("programme")} maxLength={120} />
          </div>
          <div className="grid-2">
            <Field label="Photo" id="a-photo">
              <select id="a-photo" value={form.portraitPath} onChange={set("portraitPath")}>
                <option value="">No photo</option>
                {PORTRAIT_FILES.map((p) => (<option key={p.path} value={p.path}>{p.label}</option>))}
              </select>
            </Field>
            <Field label="Photo description (for screen readers)" id="a-alt" value={form.portraitAlt} onChange={set("portraitAlt")} maxLength={200} hint="Describe the person, for example their name and result." />
          </div>
          <p className="muted">New photos: add the image file to <code>frontend/public/images/achievers/</code> and list it in <code>PORTRAIT_FILES</code> in <code>src/achievements.js</code>.</p>

          <fieldset className="ws5-fieldset">
            <legend>Checks before this can appear</legend>
            <Check id="a-verified" checked={form.verified} onChange={tick("verified")}>The result has been checked against evidence</Check>
            <Field label="Evidence reference (internal only, never shown publicly)" id="a-evid" value={form.evidenceRef} onChange={set("evidenceRef")} maxLength={200} hint="For example the result slip number or where the slip is kept." />
            <Field label="Publication consent" id="a-consent">
              <select id="a-consent" value={form.consent} onChange={set("consent")}>
                <option value="pending">Pending (not shown)</option>
                <option value="granted">Granted in writing</option>
                <option value="withdrawn">Withdrawn (removed from the website)</option>
              </select>
            </Field>
            <Check id="a-minor" checked={form.isMinor} onChange={tick("isMinor")}>The student is under 18</Check>
            <Check id="a-guardian" checked={form.guardianConsent} onChange={tick("guardianConsent")} hint="Required before an under-18 student can be shown.">A parent or guardian has given written consent</Check>
            <Check id="a-image" checked={form.imageConsent} onChange={tick("imageConsent")} hint="Without this the card shows initials instead of the photo.">Consent to show the photograph</Check>
          </fieldset>

          <Field label="Testimonial (optional)" id="a-test"><textarea id="a-test" rows="3" maxLength={400} value={form.testimonial} onChange={set("testimonial")} /></Field>
          <Check id="a-testok" checked={form.testimonialApproved} onChange={tick("testimonialApproved")}>The student approved this testimonial</Check>
          <div className="grid-2">
            <Check id="a-pub" checked={form.published} onChange={tick("published")} hint="Switch on to show on the website, once the checks above are complete.">Show on the website</Check>
            <Field label="Display order (0 shows first)" id="a-order" type="number" min="0" max="1000" value={form.order} onChange={set("order")} />
          </div>
          <FormStatus error={save.error} slow={save.slow} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={save.loading} aria-busy={save.loading}>{save.loading ? "Saving..." : "Save achievement"}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)} disabled={save.loading}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && list.length === 0 && !editing && (
        <div className="panel">
          <p>No achievement records yet, so the website is showing the four scholars from the flyer. Add them here to manage their details, or add your own.</p>
          <p><button type="button" className="btn btn-secondary" onClick={addStarters} disabled={busy} aria-busy={busy}>{busy ? "Adding..." : "Add the four scholars from the flyer"}</button></p>
        </div>
      )}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="data-table data-table--stack">
            <thead><tr><th>Student</th><th>Score</th><th>On the website</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.map((a) => {
                const why = hiddenReason(a);
                return (
                  <tr key={a._id}>
                    <td className="stack-title">
                      <span className="ws5-admin-who">
                        {a.portraitPath ? <img src={a.portraitPath} alt="" width="40" height="50" className="ws5-admin-thumb" /> : <span className="ws5-admin-thumb ws5-admin-thumb-empty" aria-hidden="true" />}
                        <span><strong>{a.name || "Prime Excelerate scholar"}</strong><br /><span className="muted">{[a.examType, a.year].filter(Boolean).join(" \u00b7 ")}</span></span>
                      </span>
                    </td>
                    <td data-label="Score">{a.score}</td>
                    <td data-label="On the website">{why ? <span className="badge badge-quiet">Hidden: {why}</span> : <span className="badge badge-ok">Visible</span>}</td>
                    <td className="row-actions stack-action">
                      <button type="button" className="link-btn" onClick={() => open(a)}>Edit</button>
                      {!a.archived && <button type="button" className="link-btn" onClick={() => patch(a, { published: !a.published }, a.published ? "Hidden from the website." : "Switched on.")}>{a.published ? "Hide" : "Show"}</button>}
                      {a.archived
                        ? <button type="button" className="link-btn" onClick={() => post(a, "restore", "Restored. It stays hidden until you switch it on.")}>Restore</button>
                        : <button type="button" className="link-btn link-danger" onClick={() => { if (window.confirm("Archive this achievement? It will be removed from the website.")) post(a, "archive", "Archived and removed from the website."); }}>Archive</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
