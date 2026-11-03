import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import Field from "./Field.jsx";
import FormStatus from "./FormStatus.jsx";
import DurationPicker from "./DurationPicker.jsx";
import { problem as durationProblem } from "../lib/exam/duration.js";
import { describe as describePool, MAX_PER_STUDENT } from "../lib/exam/pool.js";
import "../pages/admin/builder.css";

const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);

// ExamGuard defaults. They mirror backend/utils/guard.js: an exam with nothing saved behaves like this.
const GUARD_DEFAULTS = { enabled: true, monitorFocus: true, requireFullscreen: false, maxViolations: 3, autoSubmit: true, minAwaySeconds: 2, blockCopyPaste: true };
const guardFrom = (g) => {
  const o = { ...GUARD_DEFAULTS, ...(g || {}) };
  return { ...o, maxViolations: String(o.maxViolations), minAwaySeconds: String(o.minAwaySeconds) };
};

// The examination's details. Replaces the old "Details" panel on the edit page: same fields, plus the duration picker,
// the two randomisation switches and the ExamGuard security settings.
export default function ExamSettings({ exam, locked, onSaved }) {
  const { token } = useAuth();
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    setF({
      title: exam.title || "", description: exam.description || "", subject: exam.subject || "", level: exam.level || "",
      examType: exam.examType || "", instructions: exam.instructions || "", durationMinutes: exam.durationMinutes ?? "",
      maxAttempts: String(exam.maxAttempts || 1), showAnswersAfter: Boolean(exam.showAnswersAfter),
      shuffleQuestions: Boolean(exam.shuffleQuestions), shuffleOptions: Boolean(exam.shuffleOptions),
      questionsPerStudent: exam.questionsPerStudent ? String(exam.questionsPerStudent) : "", drawSpread: exam.drawSpread !== false, drawBalance: exam.drawBalance !== false, drawMixDifficulty: Boolean(exam.drawMixDifficulty),
      availableFrom: toLocal(exam.availableFrom), availableUntil: toLocal(exam.availableUntil),
      guard: guardFrom(exam.guard),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam._id]);

  const save = useSubmit(async () => {
    const bad = durationProblem(f.durationMinutes);
    if (bad) throw new Error(bad);
    if (f.questionsPerStudent !== "" && !(Number.isInteger(Number(f.questionsPerStudent)) && Number(f.questionsPerStudent) >= 1 && Number(f.questionsPerStudent) <= MAX_PER_STUDENT)) throw new Error("Questions per student must be a whole number from 1 to 500.");
    const mv = Number(f.guard.maxViolations);
    if (!Number.isInteger(mv) || mv < 1 || mv > 20) throw new Error("Allowed warnings must be a whole number from 1 to 20.");
    const ma = Number(f.guard.minAwaySeconds);
    if (!Number.isFinite(ma) || ma < 0 || ma > 30) throw new Error("Ignore short absences must be from 0 to 30 seconds.");
    const guard = { ...f.guard, maxViolations: mv, minAwaySeconds: ma };
    const body = { ...f, guard, questionsPerStudent: f.questionsPerStudent === "" ? null : Number(f.questionsPerStudent), durationMinutes: Number(f.durationMinutes), maxAttempts: Number(f.maxAttempts), availableFrom: toIso(f.availableFrom), availableUntil: toIso(f.availableUntil) };
    const d = await api(`/admin/exams/${exam._id}`, { method: "PATCH", token, body });
    onSaved(d.exam);
    setSaved("Details saved.");
    return d;
  });
  if (!f) return null;
  const set = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.value })); };
  const flip = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.checked })); };
  const gset = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, guard: { ...x.guard, [k]: e.target.value } })); };
  const gflip = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, guard: { ...x.guard, [k]: e.target.checked } })); };
  const g = f.guard;

  return (
    <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); save.run(); }}>
      <h2 className="panel-title">Details</h2>
      <Field label="Title" id="e-title" value={f.title} onChange={set("title")} required maxLength={150} />
      <div className="grid-2">
        <Field label="Subject" id="e-subject" value={f.subject} onChange={set("subject")} required maxLength={80} />
        <Field label="Class or level" id="e-level" value={f.level} onChange={set("level")} maxLength={60} />
      </div>
      <Field label="Examination type" id="e-type" value={f.examType} onChange={set("examType")} maxLength={60} />
      <DurationPicker id="e-duration" value={f.durationMinutes} onChange={(v) => { setSaved(""); setF((x) => ({ ...x, durationMinutes: v })); }} />
      <Field label="Description" id="e-desc"><textarea id="e-desc" rows="2" value={f.description} onChange={set("description")} maxLength={1000} /></Field>
      <Field label="Instructions shown before starting" id="e-inst"><textarea id="e-inst" rows="3" value={f.instructions} onChange={set("instructions")} maxLength={3000} /></Field>
      <Field label="Attempts allowed per student" id="e-attempts" type="number" min="1" max="20" value={f.maxAttempts} onChange={set("maxAttempts")} required />
      <div className="grid-2">
        <Field label="Opens (optional)" id="e-from" type="datetime-local" value={f.availableFrom} onChange={set("availableFrom")} />
        <Field label="Closes (optional)" id="e-until" type="datetime-local" value={f.availableUntil} onChange={set("availableUntil")} hint="Students cannot start after this time." />
      </div>

      <fieldset className="xb-switches">
        <legend>Question pool</legend>
        <Field label="Questions per student (leave empty so everyone gets all questions)" id="e-per" type="number" min="1" max={MAX_PER_STUDENT} value={f.questionsPerStudent} onChange={set("questionsPerStudent")} disabled={locked} hint={locked ? "Locked because the examination is published or has attempts." : undefined} />
        <p className="note" role="status">{describePool(f.questionsPerStudent, (exam.questions || []).length || exam.questionCount || 0).text}</p>
        {f.questionsPerStudent !== "" && (
          <>
            <label className="flag-toggle"><input type="checkbox" checked={f.drawSpread} disabled={locked} onChange={flip("drawSpread")} /> Give new students questions nobody has had yet (least-used first)</label>
            <label className="flag-toggle"><input type="checkbox" checked={f.drawBalance} disabled={locked} onChange={flip("drawBalance")} /> Give every student an even mix of topics (or subjects)</label>
            <label className="flag-toggle"><input type="checkbox" checked={f.drawMixDifficulty} disabled={locked} onChange={flip("drawMixDifficulty")} /> Give every student the same easy / medium / hard mix</label>
          </>
        )}
      </fieldset>

      <fieldset className="xb-switches">
        <legend>Randomisation</legend>
        <label className="flag-toggle"><input type="checkbox" checked={f.shuffleQuestions} onChange={flip("shuffleQuestions")} /> Give each student their own question order</label>
        <label className="flag-toggle"><input type="checkbox" checked={f.shuffleOptions} onChange={flip("shuffleOptions")} /> Give each student their own answer-option order</label>
        <p className="muted xb-help">The order is fixed for each student when they start, so refreshing or resuming shows the same order. Answers are marked against the option itself, so shuffling can never change a score. Questions whose options refer to each other (for example, &ldquo;All of the above&rdquo;) always keep their option order.</p>
        {(f.shuffleQuestions !== Boolean(exam.shuffleQuestions) || f.shuffleOptions !== Boolean(exam.shuffleOptions)) && <p className="note">Students who have already started keep the order they began with.</p>}
      </fieldset>

      <fieldset className="xb-switches">
        <legend>Exam security (ExamGuard)</legend>
        <label className="flag-toggle"><input type="checkbox" checked={g.enabled} onChange={gflip("enabled")} /> Monitor this examination</label>
        {g.enabled && (
          <>
            <label className="flag-toggle"><input type="checkbox" checked={g.monitorFocus} onChange={gflip("monitorFocus")} /> Warn when the student leaves the exam tab or window</label>
            <label className="flag-toggle"><input type="checkbox" checked={g.requireFullscreen} onChange={gflip("requireFullscreen")} /> Require fullscreen (leaving it counts as a warning; phones that cannot do fullscreen are not penalised)</label>
            <label className="flag-toggle"><input type="checkbox" checked={g.blockCopyPaste} onChange={gflip("blockCopyPaste")} /> Protect the questions: no selecting, copying, long-press search or printing, and hide them whenever the student leaves the exam screen (recorded, not counted)</label>
            <label className="flag-toggle"><input type="checkbox" checked={g.autoSubmit} onChange={gflip("autoSubmit")} /> Submit the examination automatically when the limit is reached</label>
            <div className="grid-2">
              <Field label="Warnings allowed" id="g-max" type="number" min="1" max="20" value={g.maxViolations} onChange={gset("maxViolations")} hint={g.autoSubmit ? `The ${g.maxViolations || "?"}${Number(g.maxViolations) === 1 ? "st" : Number(g.maxViolations) === 2 ? "nd" : Number(g.maxViolations) === 3 ? "rd" : "th"} warning submits the exam.` : "Warnings are recorded and shown to the student."} />
              <Field label="Ignore absences shorter than (seconds)" id="g-away" type="number" min="0" max="30" value={g.minAwaySeconds} onChange={gset("minAwaySeconds")} hint="Avoids penalising a notification or pop-up." />
            </div>
          </>
        )}
        <p className="muted xb-help">A web page can only see that the exam tab or window lost focus, fullscreen was left, or copy and paste were tried. It cannot see other devices, screenshots or another person helping, and it cannot stop a screenshot or a system search tool (such as Google Lens or Circle to Search), or stop the notification panel being pulled down. Use this as a deterrent and a record to review, not as proof. For phones, Screen pinning (Android) or Guided Access (iPhone) also stops notification swipes. Losing the internet connection is recorded but is never counted as a warning. Changes apply to students who start after you save; students already examining keep the settings they began with.</p>
      </fieldset>

      <label className="flag-toggle"><input type="checkbox" checked={f.showAnswersAfter} onChange={flip("showAnswersAfter")} /> Let students review the correct answers after they submit</label>
      {locked && <p className="note">Question changes are locked, but these details can still be edited.</p>}
      <p><Link to={`/admin/attempts?exam=${exam._id}`}>View student attempts for this examination</Link></p>
      {saved && <p className="alert alert-success" role="status">{saved}</p>}
      <FormStatus error={save.error} slow={save.slow} />
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={save.loading} aria-busy={save.loading}>{save.loading ? "Saving..." : "Save details"}</button>
      </div>
    </form>
  );
}
