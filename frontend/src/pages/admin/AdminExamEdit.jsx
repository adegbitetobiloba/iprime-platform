import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import ExamSettings from "../../components/ExamSettings.jsx";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";

const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);

const FORMAT_HELP = `Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B
Explanation: optional
Marks: optional
Topic: optional

Q: Next question...`;

function Details({ exam, locked, onSaved }) {
  const { token } = useAuth();
  const [f, setF] = useState(null);
  useEffect(() => {
    setF({
      title: exam.title || "", description: exam.description || "", subject: exam.subject || "", level: exam.level || "",
      examType: exam.examType || "", instructions: exam.instructions || "", durationMinutes: String(exam.durationMinutes || ""),
      maxAttempts: String(exam.maxAttempts || 1), showAnswersAfter: Boolean(exam.showAnswersAfter),
      availableFrom: toLocal(exam.availableFrom), availableUntil: toLocal(exam.availableUntil),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam._id]);
  const [saved, setSaved] = useState("");
  const save = useSubmit(async () => {
    const body = { ...f, durationMinutes: Number(f.durationMinutes), maxAttempts: Number(f.maxAttempts), availableFrom: toIso(f.availableFrom), availableUntil: toIso(f.availableUntil) };
    const d = await api(`/admin/exams/${exam._id}`, { method: "PATCH", token, body });
    onSaved(d.exam);
    setSaved("Details saved.");
    return d;
  });
  if (!f) return null;
  const set = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.value })); };

  return (
    <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); save.run(); }}>
      <h2 className="panel-title">Details</h2>
      <Field label="Title" id="e-title" value={f.title} onChange={set("title")} required maxLength={150} />
      <div className="grid-2">
        <Field label="Subject" id="e-subject" value={f.subject} onChange={set("subject")} required maxLength={80} />
        <Field label="Class or level" id="e-level" value={f.level} onChange={set("level")} maxLength={60} />
      </div>
      <div className="grid-2">
        <Field label="Examination type" id="e-type" value={f.examType} onChange={set("examType")} maxLength={60} />
        <Field label="Duration (minutes)" id="e-duration" type="number" min="1" max="360" value={f.durationMinutes} onChange={set("durationMinutes")} required />
      </div>
      <Field label="Description" id="e-desc"><textarea id="e-desc" rows="2" value={f.description} onChange={set("description")} maxLength={1000} /></Field>
      <Field label="Instructions shown before starting" id="e-inst"><textarea id="e-inst" rows="3" value={f.instructions} onChange={set("instructions")} maxLength={3000} /></Field>
      <div className="grid-2">
        <Field label="Attempts allowed per student" id="e-attempts" type="number" min="1" max="20" value={f.maxAttempts} onChange={set("maxAttempts")} required />
        <div />
      </div>
      <div className="grid-2">
        <Field label="Opens (optional)" id="e-from" type="datetime-local" value={f.availableFrom} onChange={set("availableFrom")} />
        <Field label="Closes (optional)" id="e-until" type="datetime-local" value={f.availableUntil} onChange={set("availableUntil")} hint="Students cannot start after this time." />
      </div>
      <label className="flag-toggle">
        <input type="checkbox" checked={f.showAnswersAfter} onChange={(e) => { setSaved(""); setF((x) => ({ ...x, showAnswersAfter: e.target.checked })); }} />
        Let students review the correct answers after they submit
      </label>
      {locked && <p className="note">Question changes are locked, but these details can still be edited.</p>}
      {saved && <p className="alert alert-success" role="status">{saved}</p>}
      <FormStatus error={save.error} slow={save.slow} />
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={save.loading} aria-busy={save.loading}>{save.loading ? "Saving..." : "Save details"}</button>
      </div>
    </form>
  );
}

const blankQ = { text: "", A: "", B: "", C: "", D: "", E: "", correctKey: "A", marks: "1", explanation: "", topic: "" };

function AddQuestion({ examId, onChanged }) {
  const { token } = useAuth();
  const [q, setQ] = useState(blankQ);
  const set = (k) => (e) => setQ((x) => ({ ...x, [k]: e.target.value }));
  const add = useSubmit(async () => {
    const options = ["A", "B", "C", "D", "E"].filter((k) => q[k].trim()).map((k) => ({ key: k, text: q[k].trim() }));
    const body = { text: q.text, options, correctKey: q.correctKey, marks: Number(q.marks) || 1, explanation: q.explanation, topic: q.topic };
    const d = await api(`/admin/exams/${examId}/questions`, { method: "POST", token, body });
    onChanged(d.exam);
    setQ(blankQ);
    return d;
  });

  return (
    <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); add.run(); }}>
      <h3>Add one question</h3>
      <Field label="Question" id="q-text"><textarea id="q-text" rows="3" value={q.text} onChange={set("text")} required maxLength={4000} /></Field>
      {["A", "B", "C", "D", "E"].map((k, i) => (
        <Field key={k} label={`Option ${k}${i < 2 ? "" : " (optional)"}`} id={`q-${k}`} value={q[k]} onChange={set(k)} required={i < 2} maxLength={1000} />
      ))}
      <div className="grid-2">
        <Field label="Correct answer" id="q-correct">
          <select id="q-correct" value={q.correctKey} onChange={set("correctKey")}>
            {["A", "B", "C", "D", "E"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Marks" id="q-marks" type="number" min="0.5" max="100" step="0.5" value={q.marks} onChange={set("marks")} />
      </div>
      <Field label="Topic (optional)" id="q-topic" value={q.topic} onChange={set("topic")} maxLength={120} />
      <Field label="Explanation (optional)" id="q-expl"><textarea id="q-expl" rows="2" value={q.explanation} onChange={set("explanation")} maxLength={2000} /></Field>
      <FormStatus error={add.error} slow={add.slow} />
      <div className="form-actions"><button className="btn btn-secondary" type="submit" disabled={add.loading} aria-busy={add.loading}>{add.loading ? "Adding..." : "Add question"}</button></div>
    </form>
  );
}

function ImportBox({ examId, onChanged }) {
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [problems, setProblems] = useState([]);
  const [done, setDone] = useState("");
  const imp = useSubmit(async () => {
    setProblems([]); setDone("");
    try {
      const d = await api(`/admin/exams/${examId}/questions/import`, { method: "POST", token, body: { text } });
      onChanged(d.exam);
      setText("");
      setDone(`${d.imported} question${d.imported === 1 ? "" : "s"} imported.`);
      return d;
    } catch (e) {
      // Show the per-question problems the server found.
      if (e.details) setProblems(e.details);
      throw e;
    }
  });

  return (
    <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); imp.run(); }}>
      <h3>Paste several questions</h3>
      <p className="muted">Use this format. Every question needs an explicit <code>Answer:</code> line. Nothing is imported if any question has a problem.</p>
      <pre className="format-help">{FORMAT_HELP}</pre>
      <Field label="Questions" id="imp-text"><textarea id="imp-text" rows="10" value={text} onChange={(e) => setText(e.target.value)} required /></Field>
      {done && <p className="alert alert-success" role="status">{done}</p>}
      <FormStatus error={imp.error} slow={imp.slow} />
      {problems.length > 0 && (
        <ul className="problem-list">
          {problems.map((p, i) => <li key={i}>{p.question ? `Question ${p.question}` : "Text"}{p.label ? ` ("${p.label}")` : ""}: {p.message}</li>)}
        </ul>
      )}
      <div className="form-actions"><button className="btn btn-secondary" type="submit" disabled={imp.loading || !text.trim()} aria-busy={imp.loading}>{imp.loading ? "Checking..." : "Import questions"}</button></div>
    </form>
  );
}

export default function AdminExamEdit() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(`/admin/exams/${id}`);
  const attempts = useFetch(`/admin/exams/${id}/attempts`);
  const [exam, setExam] = useState(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => { if (data) setExam(data.exam); }, [data]);

  const act = async (fn) => {
    setActionError("");
    try { await fn(); reload(); } catch (e) { setActionError(e.message); }
  };

  if (loading && !exam) return <p className="page-note" role="status">Loading...</p>;
  if (error) return <div className="admin-page"><p className="alert alert-error" role="alert">{error}</p><Link to="/admin/exams">Back to examinations</Link></div>;
  if (!exam) return null;

  const published = exam.status === "published";
  const locked = data?.locked || null;
  const questions = exam.questions || [];
  const attemptRows = attempts.data?.attempts || [];

  return (
    <div className="admin-page">
      <p><Link to="/admin/exams">← All examinations</Link></p>
      <div className="page-bar">
        <div>
          <p className="eyebrow">{published ? "Published" : "Draft"}</p>
          <h1>{exam.title}</h1>
          <p className="muted">{questions.length} question{questions.length === 1 ? "" : "s"}</p>
        </div>
        <div className="form-actions">
          {published ? (
            <button type="button" className="btn btn-secondary" onClick={() => act(() => api(`/admin/exams/${id}/unpublish`, { method: "POST", token }))}>Unpublish</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => act(() => api(`/admin/exams/${id}/publish`, { method: "POST", token }))}>Publish to students</button>
          )}
        </div>
      </div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {published && <p className="alert alert-info" role="status">This examination is visible to students. Unpublish it to edit its questions.</p>}

      <ExamSettings exam={exam} locked={Boolean(locked)} onSaved={setExam} />

      <div className="panel">
        <h2 className="panel-title">Questions</h2>
        {locked && <p className="alert alert-info" role="status">{locked}</p>}
        {questions.length === 0 && <p className="note">No questions yet.</p>}
        <ol className="admin-questions">
          {questions.map((q) => (
            <li key={q._id} className="admin-q">
              <p className="admin-q-text">{q.text}</p>
              <ul className="review-options">
                {q.options.map((o) => (
                  <li key={o.key} className={o.key === q.correctKey ? "is-correct" : ""}>
                    <strong>{o.key}.</strong> {o.text}{o.key === q.correctKey && <span className="tag"> Correct answer</span>}
                  </li>
                ))}
              </ul>
              <p className="muted admin-q-meta">{q.marks ?? 1} mark{(q.marks ?? 1) === 1 ? "" : "s"}{q.topic ? ` · ${q.topic}` : ""}{q.explanation ? " · has explanation" : ""}</p>
              {!locked && (
                <button type="button" className="link-btn link-danger"
                  onClick={() => { if (window.confirm("Delete this question?")) act(() => api(`/admin/exams/${id}/questions/${q._id}`, { method: "DELETE", token })); }}>
                  Delete question
                </button>
              )}
            </li>
          ))}
        </ol>
        {!locked && (
          <div className="admin-forms">
            <AddQuestion examId={id} onChanged={(e) => { setExam(e); reload(); }} />
            <ImportBox examId={id} onChanged={(e) => { setExam(e); reload(); }} />
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">Attempts</h2>
        {attempts.loading && <p className="muted">Loading...</p>}
        {!attempts.loading && attemptRows.length === 0 && <p className="note">No attempts yet.</p>}
        {attemptRows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Status</th><th>Score</th><th>Started</th></tr></thead>
              <tbody>
                {attemptRows.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.student}</strong><br /><span className="muted">{a.studentId}</span></td>
                    <td>{a.status === "submitted" ? (a.autoSubmitted ? "Submitted (time up)" : "Submitted") : "In progress"}</td>
                    <td>{a.status === "submitted" ? `${a.score} / ${a.totalMarks} (${a.percentage}%)` : "—"}</td>
                    <td>{fmtDate(a.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!published && attemptRows.length === 0 && (
        <div className="panel">
          <h2 className="panel-title">Delete</h2>
          <button type="button" className="btn btn-secondary link-danger"
            onClick={() => { if (window.confirm("Delete this draft examination and its questions?")) act(async () => { await api(`/admin/exams/${id}`, { method: "DELETE", token }); navigate("/admin/exams"); }); }}>
            Delete this draft
          </button>
        </div>
      )}
    </div>
  );
}
