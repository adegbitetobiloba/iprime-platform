import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import { ActError, PageHead, StatusPill, problemsOf, useAct, useCall } from "./ui.jsx";

const KEYS = ["A", "B", "C", "D", "E", "F"];
const EXAMPLE = `Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B
Explanation: Add the two numbers.
Topic: Arithmetic
Marks: 1`;

// The test editor: details, questions (add one, or paste many), and sending it for review.
export default function TeacherExam() {
  const { id } = useParams();
  const call = useCall();
  const [exam, setExam] = useState(null);
  const [review, setReview] = useState(undefined);
  const [err, setErr] = useState("");
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteProblems, setPasteProblems] = useState([]);
  const [pasteOk, setPasteOk] = useState("");
  const [q, setQ] = useState({ text: "", options: ["", "", "", ""], correctKey: "A", marks: "1", topic: "", explanation: "" });
  const act = useAct();

  const load = async () => {
    try {
      const [d, list] = await Promise.all([call(`/teacher/exams/${id}`), call("/teacher/exams")]);
      setExam(d.exam);
      setReview((list.exams.find((e) => String(e.id) === String(id)) || {}).review);
      setF((x) => x || { title: d.exam.title, subject: d.exam.subject, level: d.exam.level || "", examType: d.exam.examType || "", durationMinutes: String(d.exam.durationMinutes), maxAttempts: String(d.exam.maxAttempts ?? 1), description: d.exam.description || "", instructions: d.exam.instructions || "", showAnswersAfter: !!d.exam.showAnswersAfter, shuffleQuestions: !!d.exam.shuffleQuestions, shuffleOptions: !!d.exam.shuffleOptions });
    } catch (e) { setErr(e.message); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const saveDetails = useSubmit(async () => {
    const mins = Number(f.durationMinutes), tries = Number(f.maxAttempts);
    if (!Number.isInteger(mins) || mins < 1 || mins > 360) throw new Error("Duration must be a whole number of minutes from 1 to 360.");
    if (!Number.isInteger(tries) || tries < 1 || tries > 20) throw new Error("Attempts must be a whole number from 1 to 20.");
    await call(`/teacher/exams/${id}`, { method: "PATCH", body: { title: f.title.trim(), subject: f.subject.trim(), level: f.level.trim(), examType: f.examType.trim(), durationMinutes: mins, maxAttempts: tries, description: f.description.trim(), instructions: f.instructions.trim(), showAnswersAfter: f.showAnswersAfter, shuffleQuestions: f.shuffleQuestions, shuffleOptions: f.shuffleOptions } });
    setSaved("Saved.");
    await load();
  });

  const addQuestion = useSubmit(async () => {
    const options = q.options.map((t, i) => ({ key: KEYS[i], text: t.trim() })).filter((o) => o.text);
    if (options.length < 2) throw new Error("Give at least two answer options.");
    if (!options.some((o) => o.key === q.correctKey)) throw new Error("The correct answer must be one of the options you filled in.");
    const body = { text: q.text.trim(), options, correctKey: q.correctKey };
    if (q.marks !== "") body.marks = Number(q.marks);
    if (q.topic.trim()) body.topic = q.topic.trim();
    if (q.explanation.trim()) body.explanation = q.explanation.trim();
    await call(`/teacher/exams/${id}/questions`, { method: "POST", body });
    setQ({ text: "", options: ["", "", "", ""], correctKey: "A", marks: q.marks, topic: q.topic, explanation: "" });
    await load();
  });

  const importQs = useSubmit(async () => {
    setPasteProblems([]); setPasteOk("");
    try {
      const d = await call(`/teacher/exams/${id}/questions/import`, { method: "POST", body: { text: paste } });
      setPasteOk(`${d.imported ?? "Some"} question${d.imported === 1 ? "" : "s"} added.`);
      setPaste("");
      await load();
    } catch (e) { setPasteProblems(problemsOf(e)); throw e; }
  });

  if (err) return <div className="admin-page"><p><Link to="/teacher/exams">← Tests</Link></p><div className="alert alert-error" role="alert">{err}</div></div>;
  if (!exam || !f) return <div className="admin-page"><p className="muted" role="status">Loading…</p></div>;

  const waiting = review && review.status === "pending";
  const editable = exam.status === "draft" && !waiting;
  const set = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.value })); };
  const flip = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.checked })); };
  const questions = exam.questions || [];

  return (
    <div className="admin-page">
      <p><Link to="/teacher/exams">← Tests</Link></p>
      <PageHead eyebrow="Test or mock exam" title={exam.title}><StatusPill status={exam.status} review={review} /></PageHead>
      {review && review.status === "returned" && review.note && <div className="tch-note">Returned by an administrator: {review.note}</div>}
      {!editable && <p className="note">{exam.status !== "draft" ? "This test is published. Ask an administrator if it needs to change." : "This test is waiting for review, so it is locked. Withdraw it to edit."}</p>}

      {editable && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); saveDetails.run(); }}>
          <h2 className="panel-title">Details</h2>
          <Field label="Title" id="e-title" value={f.title} onChange={set("title")} required maxLength={150} />
          <div className="grid-2">
            <Field label="Subject" id="e-subject" value={f.subject} onChange={set("subject")} required maxLength={80} />
            <Field label="Duration (minutes)" id="e-dur" type="number" min="1" max="360" value={f.durationMinutes} onChange={set("durationMinutes")} required />
          </div>
          <div className="grid-2">
            <Field label="Class or level" id="e-level" value={f.level} onChange={set("level")} maxLength={60} />
            <Field label="Type" id="e-type" value={f.examType} onChange={set("examType")} maxLength={60} />
          </div>
          <Field label="Attempts allowed per student" id="e-att" type="number" min="1" max="20" value={f.maxAttempts} onChange={set("maxAttempts")} required />
          <Field label="Description" id="e-desc"><textarea id="e-desc" rows="2" value={f.description} onChange={set("description")} maxLength={1000} /></Field>
          <Field label="Instructions shown before starting" id="e-inst"><textarea id="e-inst" rows="3" value={f.instructions} onChange={set("instructions")} maxLength={3000} /></Field>
          <label className="flag-toggle"><input type="checkbox" checked={f.shuffleQuestions} onChange={flip("shuffleQuestions")} /> Give each student their own question order</label>
          <label className="flag-toggle"><input type="checkbox" checked={f.shuffleOptions} onChange={flip("shuffleOptions")} /> Give each student their own answer-option order</label>
          <label className="flag-toggle"><input type="checkbox" checked={f.showAnswersAfter} onChange={flip("showAnswersAfter")} /> Show correct answers after the student submits</label>
          <p className="muted">Security settings (full-screen, focus warnings, time windows) are set by an administrator when the test is published.</p>
          <FormStatus error={saveDetails.error} slow={saveDetails.slow} />
          {saved && <p className="note" role="status">{saved}</p>}
          <button className="btn btn-primary" disabled={saveDetails.loading}>{saveDetails.loading ? "Saving…" : "Save details"}</button>
        </form>
      )}

      <h2>Questions ({questions.length})</h2>
      {questions.length === 0 ? <p className="muted">No questions yet.</p> : (
        <ol className="tch-list" style={{ paddingLeft: 0 }}>
          {questions.map((qu, i) => (
            <li key={qu._id} className="tch-row">
              <div>
                <strong>{i + 1}. {qu.text}</strong>
                <small>{qu.options.map((o) => `${o.key}) ${o.text}`).join("  ·  ")}</small>
                <small>Correct: {qu.correctKey}{qu.marks && qu.marks !== 1 ? ` · ${qu.marks} marks` : ""}{qu.topic ? ` · ${qu.topic}` : ""}</small>
              </div>
              {editable && <button type="button" className="link-btn link-danger" disabled={act.busy} onClick={() => { if (window.confirm("Remove this question?")) act.run(async () => { await call(`/teacher/exams/${id}/questions/${qu._id}`, { method: "DELETE" }); await load(); }); }}>Remove</button>}
            </li>
          ))}
        </ol>
      )}
      <ActError act={act} />

      {editable && (
        <>
          <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); addQuestion.run(); }}>
            <h2 className="panel-title">Add one question</h2>
            <Field label="Question" id="q-text"><textarea id="q-text" rows="2" required value={q.text} onChange={(e) => setQ((x) => ({ ...x, text: e.target.value }))} maxLength={4000} /></Field>
            {q.options.map((t, i) => <Field key={KEYS[i]} label={`Option ${KEYS[i]}${i < 2 ? "" : " (optional)"}`} id={`q-o${i}`} value={t} onChange={(e) => setQ((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? e.target.value : o)) }))} required={i < 2} maxLength={1000} />)}
            <div className="grid-2">
              <Field label="Correct answer" id="q-correct"><select id="q-correct" value={q.correctKey} onChange={(e) => setQ((x) => ({ ...x, correctKey: e.target.value }))}>{KEYS.slice(0, 4).map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
              <Field label="Marks" id="q-marks" type="number" min="0.5" max="100" step="0.5" value={q.marks} onChange={(e) => setQ((x) => ({ ...x, marks: e.target.value }))} />
            </div>
            <Field label="Topic (optional)" id="q-topic" value={q.topic} onChange={(e) => setQ((x) => ({ ...x, topic: e.target.value }))} maxLength={120} hint="Topics let you see which areas students find hard." />
            <Field label="Explanation (optional)" id="q-expl"><textarea id="q-expl" rows="2" value={q.explanation} onChange={(e) => setQ((x) => ({ ...x, explanation: e.target.value }))} maxLength={4000} /></Field>
            <FormStatus error={addQuestion.error} slow={addQuestion.slow} />
            <button className="btn btn-primary" disabled={addQuestion.loading}>{addQuestion.loading ? "Adding…" : "Add question"}</button>
          </form>

          <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); importQs.run(); }}>
            <h2 className="panel-title">Paste many questions</h2>
            <p>Paste questions in this format. Every question needs an answer line; nothing is guessed.</p>
            <pre className="note" style={{ overflowX: "auto" }}>{EXAMPLE}</pre>
            <Field label="Questions" id="p-text"><textarea id="p-text" className="tch-textarea" value={paste} onChange={(e) => setPaste(e.target.value)} maxLength={200000} /></Field>
            {pasteProblems.length > 0 && <div className="alert alert-error" role="alert"><p>Nothing was added. Fix these and try again:</p><ul>{pasteProblems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
            {pasteOk && <p className="note" role="status">{pasteOk}</p>}
            <FormStatus error={pasteProblems.length ? "" : importQs.error} slow={importQs.slow} />
            <button className="btn btn-secondary" disabled={importQs.loading || !paste.trim()}>{importQs.loading ? "Adding…" : "Add these questions"}</button>
          </form>
        </>
      )}

      {exam.status === "draft" && (
        <section className="panel">
          <h2 className="panel-title">Review</h2>
          {waiting ? (
            <>
              <p>Sent for review. An administrator will publish it or send it back with a note.</p>
              <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/teacher/exams/${id}/withdraw`, { method: "POST" }); await load(); })}>Withdraw from review</button>
            </>
          ) : (
            <>
              <p>When your questions and answers are checked, send the test for review. Only an administrator can publish it to students.</p>
              <button type="button" className="btn btn-primary" disabled={act.busy || questions.length === 0} onClick={() => act.run(async () => { await call(`/teacher/exams/${id}/submit`, { method: "POST" }); await load(); })}>Send for review</button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
