import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Calculator from "../calculator/Calculator.jsx";
import SafeHtml from "../components/SafeHtml.jsx";

const fmt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// The examination screen. The countdown is derived from the deadline the SERVER set when the attempt began,
// corrected by the server's clock, so refreshing the page or changing the device clock cannot add time.
export default function ExamRunner() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef(navigate); // kept in a ref so a changing navigate function can never trigger a reload of the attempt
  navRef.current = navigate;

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [idx, setIdx] = useState(0);
  const [saveState, setSaveState] = useState({}); // questionId -> "pending" | "failed"
  const [remaining, setRemaining] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const offsetRef = useRef(0);        // server clock minus device clock
  const deadlineRef = useRef(0);
  const inflight = useRef({});
  const submittingRef = useRef(false);
  const nextTryRef = useRef(0);
  const submitRef = useRef(() => {});
  const cardRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const answersRef = useRef(answers); answersRef.current = answers;
  const flaggedRef = useRef(flagged); flaggedRef.current = flagged;
  const saveStateRef = useRef(saveState); saveStateRef.current = saveState;

  // Load (or resume) the attempt from the server.
  useEffect(() => {
    let off = false;
    api(`/attempts/${id}`, { token })
      .then((d) => {
        if (off) return;
        if (d.submitted) { navRef.current(`/results/${id}`, { replace: true }); return; }
        offsetRef.current = new Date(d.attempt.serverNow).getTime() - Date.now();
        deadlineRef.current = new Date(d.attempt.deadline).getTime();
        setAnswers(d.attempt.answers || {});
        setFlagged(d.attempt.flagged || []);
        setData(d);
      })
      .catch((e) => { if (!off) setLoadError(e.message); });
    return () => { off = true; };
  }, [id, token]);

  // Saves one change. Never pretends: a failure is shown and retried.
  const save = useCallback(async (qid, body) => {
    inflight.current[qid] = (inflight.current[qid] || 0) + 1;
    setSaveState((s) => ({ ...s, [qid]: "pending" }));
    try {
      const r = await api(`/attempts/${id}/answers`, { method: "PUT", token, body: { questionId: qid, ...body } });
      offsetRef.current = new Date(r.serverNow).getTime() - Date.now();
      inflight.current[qid] -= 1;
      if (inflight.current[qid] === 0) setSaveState((s) => { const n = { ...s }; delete n[qid]; return n; });
      return true;
    } catch (e) {
      inflight.current[qid] -= 1;
      if (e.code === "EXPIRED" || e.code === "SUBMITTED") { navRef.current(`/results/${id}`, { replace: true }); return false; }
      if (inflight.current[qid] === 0) setSaveState((s) => ({ ...s, [qid]: "failed" }));
      return false;
    }
  }, [id, token]);

  // Re-sends the current local value of every question whose last save failed.
  const retryFailed = useCallback(async () => {
    const failed = Object.keys(saveStateRef.current).filter((q) => saveStateRef.current[q] === "failed");
    let ok = true;
    for (const q of failed) {
      const r = await save(q, { choice: answersRef.current[q] ?? null, flagged: flaggedRef.current.includes(q) });
      ok = ok && r;
    }
    return ok;
  }, [save]);

  const submit = useCallback(async (auto) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      if (!auto) await retryFailed();
      const r = await api(`/attempts/${id}/submit`, { method: "POST", token });
      navRef.current(`/results/${r.result.id}`, { replace: true });
    } catch (e) {
      setSubmitError(e.message);
      submittingRef.current = false;
      setSubmitting(false);
      nextTryRef.current = Date.now() + 5000;
    }
  }, [id, token, retryFailed]);
  submitRef.current = submit;

  // Countdown from the server deadline. At zero the attempt is submitted automatically (retrying if the network fails).
  useEffect(() => {
    if (!data) return undefined;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((deadlineRef.current - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(rem);
      if (rem === 0 && !submittingRef.current && Date.now() >= nextTryRef.current) submitRef.current(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);

  // Retry failed saves in the background, and warn before leaving with unsaved answers.
  useEffect(() => {
    const t = setInterval(() => { if (Object.values(saveStateRef.current).includes("failed")) retryFailed(); }, 6000);
    return () => clearInterval(t);
  }, [retryFailed]);

  useEffect(() => {
    const warn = (e) => { if (Object.keys(saveStateRef.current).length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (!confirming) return undefined;
    confirmBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !submittingRef.current) setConfirming(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  useEffect(() => { cardRef.current?.scrollIntoView({ block: "start" }); }, [idx]);

  if (loadError) {
    return (
      <section className="section"><div className="container narrow">
        <p className="alert alert-error" role="alert">{loadError}</p>
        <Link to="/exams">Back to examinations</Link>
      </div></section>
    );
  }
  if (!data) return <p className="page-note" role="status">Loading your examination...</p>;

  const questions = data.questions;
  const total = questions.length;
  const q = questions[idx];
  const answeredCount = questions.filter((x) => answers[x.id]).length;
  const flaggedCount = questions.filter((x) => flagged.includes(x.id)).length;
  const failedCount = Object.values(saveState).filter((v) => v === "failed").length;
  const unsavedCount = Object.keys(saveState).length;
  const low = remaining !== null && remaining <= 300;
  const st = saveState[q.id];

  const choose = (qid, key) => {
    setAnswers((a) => { const n = { ...a }; if (key === null) delete n[qid]; else n[qid] = key; return n; });
    save(qid, { choice: key });
  };
  const toggleFlag = (qid) => {
    const on = !flagged.includes(qid);
    setFlagged((f) => (on ? [...f, qid] : f.filter((x) => x !== qid)));
    save(qid, { flagged: on });
  };

  return (
    <div className="runner">
      <header className="runner-bar">
        <div className="runner-title">
          <strong>{data.exam.title}</strong>
          <span className="muted">{data.exam.subject}</span>
        </div>
        <div className={`timer${low ? " timer-low" : ""}`} role="timer">
          <span className="sr-only">Time remaining: </span>
          <span className="timer-num">{fmt(remaining ?? 0)}</span>
          {low && <span className="timer-note">Time is running low</span>}
        </div>
        <div className="runner-actions">
          <Calculator />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirming(true)}>Submit</button>
        </div>
      </header>

      {failedCount > 0 && (
        <p className="alert alert-error runner-alert" role="alert">
          {failedCount} answer{failedCount > 1 ? "s have" : " has"} not been saved. Check your connection.{" "}
          <button type="button" className="link-btn" onClick={retryFailed}>Retry now</button>
        </p>
      )}

      <div className="runner-body">
        <section className="q-card" ref={cardRef} aria-labelledby="q-title">
          <p className="q-meta">
            <span id="q-title">Question {idx + 1} of {total}</span>
            <span>{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
          </p>
          <SafeHtml className="q-text" html={q.textHtml} text={q.text} />

          <fieldset className="options">
            <legend className="sr-only">Choose your answer</legend>
            {q.options.map((o) => (
              <label key={o.key} className={`option${answers[q.id] === o.key ? " is-selected" : ""}`}>
                <input type="radio" name={`q-${q.id}`} value={o.key} checked={answers[q.id] === o.key} onChange={() => choose(q.id, o.key)} />
                <span className="option-key">{o.label || o.key}</span>
                <SafeHtml as="span" inline className="option-text" html={o.html} text={o.text} />
              </label>
            ))}
          </fieldset>

          <div className="q-tools">
            <label className="flag-toggle">
              <input type="checkbox" checked={flagged.includes(q.id)} onChange={() => toggleFlag(q.id)} /> Mark for review
            </label>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => choose(q.id, null)} disabled={!answers[q.id]}>Clear answer</button>
            <span className="save-status" role="status">
              {st === "pending" ? "Saving..." : st === "failed" ? "Not saved" : answers[q.id] ? "Saved" : ""}
            </span>
          </div>

          <div className="q-nav">
            <button type="button" className="btn btn-secondary" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>Previous</button>
            {idx < total - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>Next</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>Finish and submit</button>
            )}
          </div>
        </section>

        <aside className="palette-card" aria-label="Question navigator">
          <h2>Questions</h2>
          <p className="muted palette-count">{answeredCount} of {total} answered</p>
          <ol className="palette">
            {questions.map((x, i) => {
              const a = Boolean(answers[x.id]);
              const f = flagged.includes(x.id);
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    className={`palette-btn${a ? " is-answered" : ""}${f ? " is-flagged" : ""}${i === idx ? " is-current" : ""}`}
                    aria-current={i === idx ? "true" : undefined}
                    aria-label={`Question ${i + 1}, ${a ? "answered" : "not answered"}${f ? ", marked for review" : ""}`}
                    onClick={() => setIdx(i)}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <ul className="palette-key">
            <li><span className="key-swatch is-answered" aria-hidden="true" /> Answered</li>
            <li><span className="key-swatch" aria-hidden="true" /> Not answered</li>
            <li><span className="key-swatch is-flagged" aria-hidden="true" /> Marked for review</li>
          </ul>
        </aside>
      </div>

      {confirming && (
        <div className="dialog-overlay">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title">Submit your examination?</h2>
            <ul className="plain-list">
              <li><strong>{answeredCount}</strong> of {total} questions answered</li>
              <li><strong>{total - answeredCount}</strong> unanswered</li>
              {flaggedCount > 0 && <li><strong>{flaggedCount}</strong> marked for review</li>}
              <li>Time left: <strong>{fmt(remaining ?? 0)}</strong></li>
            </ul>
            {unsavedCount > 0 && <p className="alert alert-error" role="alert">{unsavedCount} answer{unsavedCount > 1 ? "s are" : " is"} still being saved or could not be saved. Unsaved answers will not count.</p>}
            {submitError && <p className="alert alert-error" role="alert">{submitError}</p>}
            <p className="muted">You cannot change your answers after submitting.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" ref={confirmBtnRef} onClick={() => submit(false)} disabled={submitting} aria-busy={submitting}>
                {submitting ? "Submitting..." : unsavedCount > 0 ? "Submit anyway" : "Submit now"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={submitting}>Keep working</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
