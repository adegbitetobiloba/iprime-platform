import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch } from "../../useFetch.js";
import Field from "../../components/Field.jsx";
import DurationPicker from "../../components/DurationPicker.jsx";
import { label as durationLabel, problem as durationProblem } from "../../lib/exam/duration.js";
import { describe as describePool, MAX_PER_STUDENT } from "../../lib/exam/pool.js";
import SectionQuotas from "../../components/SectionQuotas.jsx";
import ExamUploadStep from "../../components/ExamUploadStep.jsx";
import "../exam-tools.css";
import { checkPassword } from "../../lib/guestName.js";
import "./builder.css";

const STEPS = ["Basics", "Questions", "Settings", "Review"];
const LEVELS = ["easy", "medium", "hard"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Plain-language versions of the engine's notes.
function noteText(n) {
  switch (n.code) {
    case "SHORTFALL": return `Only ${n.got} matching question${n.got === 1 ? " is" : "s are"} available; you asked for ${n.wanted}. Nothing from other topics was added to make up the number.`;
    case "TOPIC_EMPTY": return `The topic "${n.topic}" has no usable questions in the bank.`;
    case "NO_DIFFICULTY_DATA": return "None of these questions has a difficulty rating, so the difficulty mix could not be applied. They were chosen at random instead.";
    case "LEVEL_SHORT": return `Only ${n.got} ${n.level} question${n.got === 1 ? "" : "s"} available (wanted ${n.wanted}); other questions filled the gap.`;
    case "MANUAL_NOT_ELIGIBLE": return "A question you picked by hand is not eligible (incomplete, archived, or not verified while verified-only is on), so it was left out.";
    case "MANUAL_EXCEEDS_COUNT": return `You picked ${n.manual} questions by hand, which is more than the ${n.count} requested. All of them were kept.`;
    default: return "";
  }
}

export default function AdminExamBuilder() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const facets = useFetch("/admin/bank/facets");

  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState({ title: "", subject: "", level: "", examType: "", instructions: "" });
  const [src, setSrc] = useState({ subjects: [], balanceBy: "topic", topics: [], count: "20", mode: "random", difficultyMode: "any", mix: { easy: 30, medium: 50, hard: 20 }, verifiedOnly: false, balanceTopics: true, source: "bank", all: false });
  const [manual, setManual] = useState({});            // id -> question view, picked by hand
  const [excluded, setExcluded] = useState([]);        // ids the administrator removed, so a re-pick never brings them back
  const [quotas, setQuotas] = useState({});            // questions each student gets, per subject
  const [result, setResult] = useState(null);          // latest answer from /admin/bank/select
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState("");
  const [cfg, setCfg] = useState({ lbEnabled: false, lbNames: "short", password: "", perStudent: "", drawSpread: true, drawBalance: true, drawMix: false, durationMinutes: 60, maxAttempts: "1", shuffleQuestions: false, shuffleOptions: false, showAnswersAfter: false, marksMode: "bank", marksAll: "1" });
  const [saving, setSaving] = useState("");
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPool, setShowPool] = useState(false); // with per-student draws the list is hidden until asked for

  const subjects = facets.data?.subjects || [];
  const topicsHere = useMemo(() => (facets.data?.topics || []).filter((t) => !src.subjects.length || src.subjects.includes(t.subject)), [facets.data, src.subjects]);
  const setB = (k) => (e) => setBasics((b) => ({ ...b, [k]: e.target.value }));
  const setS = (k, v) => { setSrc((s) => ({ ...s, [k]: v })); setResult(null); };

  // Questions the exam will contain: the latest pick, with anything the administrator removed taken out.
  const chosen = result ? result.questions : [];
  // The subjects in the pool and how many questions each has, for the per-subject quota table.
  const quotaRows = useMemo(() => {
    const m = new Map();
    for (const [name, n] of Object.entries((result && result.breakdown && result.breakdown.bySubject) || {})) { const subject = name === "(no subject)" ? (basics.subject.trim() || "General") : name; m.set(subject, (m.get(subject) || 0) + n); }
    return [...m].map(([subject, available]) => ({ subject, available }));
  }, [result, basics.subject]);
  useEffect(() => { // sensible starting quotas: 40 per subject, or all of it if the subject has fewer
    setQuotas((q) => { const n = { ...q }; let changed = false; for (const r of quotaRows) if (n[r.subject] === undefined) { n[r.subject] = String(Math.min(r.available, 40)); changed = true; } return changed ? n : q; });
  }, [quotaRows]);
  const quotaTotal = quotaRows.reduce((t, r) => { const v = Math.floor(Number(quotas[r.subject])); return t + (Number.isFinite(v) && v > 0 ? Math.min(v, r.available) : 0); }, 0);
  useEffect(() => { setCfg((c) => (c.perStudent === "" || c.perStudent === String(quotaTotal || 1) ? c : { ...c, perStudent: String(quotaTotal || 1) })); }, [quotaTotal]);
  const manualCount = Object.keys(manual).length;

  const pick = useCallback(async (keepManualOnly) => {
    setPicking(true); setPickError("");
    try {
      const manualIds = Object.keys(manual);
      const count = src.mode === "manual" ? manualIds.length : src.all ? 1 : Number(src.count);
      if (!Number.isInteger(count) || count < 1) throw new Error(src.mode === "manual" ? "Tick at least one question to include." : "Enter how many questions you need.");
      const body = {
        subjects: src.subjects, balanceBy: src.subjects.length > 1 ? src.balanceBy : "topic", topics: src.topics, count, all: src.all && src.mode !== "manual" ? true : undefined, manualIds, excludeIds: excluded, verifiedOnly: src.verifiedOnly, balanceTopics: src.balanceTopics,
        difficulty: src.difficultyMode === "mix" ? { mode: "mix", mix: { easy: Number(src.mix.easy) || 0, medium: Number(src.mix.medium) || 0, hard: Number(src.mix.hard) || 0 } } : { mode: "any" },
      };
      if (keepManualOnly) body.count = Math.max(count, manualIds.length);
      const d = await api("/admin/bank/select", { method: "POST", token, body });
      setResult(d);
    } catch (e) { setPickError(e.message); } finally { setPicking(false); }
  }, [manual, excluded, src, token]);

  const removeQ = (id) => {
    setExcluded((x) => [...x, id]);
    setManual((m) => { const n = { ...m }; delete n[id]; return n; });
    setResult((r) => (r ? { ...r, questions: r.questions.filter((q) => q.id !== id), selected: r.selected - 1, totalMarks: r.totalMarks - (r.questions.find((q) => q.id === id)?.marks ?? 0), shortfall: r.shortfall + 1 } : r));
  };

  // Manual browsing (used by Manual and Mixed modes)
  const [q, setQ] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [page, setPage] = useState(1);
  const browseUrl = useMemo(() => { const p = new URLSearchParams({ page: String(page), limit: "15", flag: "usable" }); if (src.subjects.length === 1) p.set("subject", src.subjects[0]); if (topicFilter) p.set("topic", topicFilter); if (q.trim()) p.set("q", q.trim()); return `/admin/bank?${p}`; }, [src.subjects, topicFilter, q, page]);
  const browse = useFetch(src.mode === "random" || step !== 1 ? "/admin/bank?limit=1&flag=usable" : browseUrl);
  useEffect(() => { setPage(1); }, [src.subjects, topicFilter, q]);

  const toggleManual = (row) => {
    setResult(null);
    setManual((m) => { const n = { ...m }; if (n[row.id]) delete n[row.id]; else n[row.id] = { id: row.id, externalId: row.externalId, topic: row.topic, text: row.text, marks: row.marks ?? 1 }; return n; });
    setExcluded((x) => x.filter((i) => i !== row.id));
  };

  const problems = {
    0: [!basics.title.trim() && "Give the examination a title.", !basics.subject.trim() && "Enter the subject."].filter(Boolean),
    1: [!result && "Pick the questions first.", result && result.selected < 1 && "No questions are selected."].filter(Boolean),
    2: [durationProblem(cfg.durationMinutes), !(Number(cfg.maxAttempts) >= 1 && Number(cfg.maxAttempts) <= 20) && "Attempts must be between 1 and 20.", cfg.marksMode === "all" && !(Number(cfg.marksAll) >= 0.5 && Number(cfg.marksAll) <= 100) && "Marks per question must be between 0.5 and 100.", cfg.password !== "" && !checkPassword(cfg.password).ok && checkPassword(cfg.password).error, cfg.perStudent !== "" && quotaTotal < 1 && "Give each student at least one question from at least one subject.", cfg.perStudent !== "" && !(Number.isInteger(Number(cfg.perStudent)) && Number(cfg.perStudent) >= 1 && Number(cfg.perStudent) <= MAX_PER_STUDENT) && "Questions per student must be a whole number from 1 to 20000."].filter(Boolean),
  };
  const go = (n) => { if (n > step) for (let i = step; i < n; i++) if (problems[i]?.length) { setStep(i); return; } setStep(n); };
  const canLeave = (i) => !problems[i] || problems[i].length === 0;

  const totalMarks = cfg.marksMode === "all" ? chosen.length * (Number(cfg.marksAll) || 0) : (result?.totalMarks ?? 0);

  const build = async (publish) => {
    setSaving(publish ? "Creating and publishing..." : "Creating draft..."); setSaveError(""); setCreated(null);
    let examId = null;
    try {
      const d = await api("/admin/exams", { method: "POST", token, body: {
        title: basics.title.trim(), subject: basics.subject.trim(), level: basics.level.trim(), examType: basics.examType.trim(), instructions: basics.instructions.trim(),
        durationMinutes: Number(cfg.durationMinutes), maxAttempts: Number(cfg.maxAttempts), showAnswersAfter: cfg.showAnswersAfter, shuffleQuestions: cfg.shuffleQuestions, shuffleOptions: cfg.shuffleOptions,
      } });
      examId = d.exam._id;
      if (cfg.password) { // the optional examination password: if it cannot be saved we stop BEFORE publishing
        try { await api(`/admin/access/exams/${examId}/password`, { method: "PUT", token, body: { password: cfg.password } }); }
        catch (e) { throw new Error(`The examination was created, but its password could not be saved (${e.message}). It has NOT been published. Open the draft and set the password there.`); }
      }
      const ids = chosen.map((c) => c.id);
      let added = 0;
      for (let i = 0; i < ids.length; i += 200) {
        setSaving(`Adding questions (${Math.min(i + 200, ids.length)} of ${ids.length})...`);
        const r = await api("/admin/bank/add-to-exam", { method: "POST", token, body: { examId, ids: ids.slice(i, i + 200), ...(cfg.marksMode === "all" ? { marks: Number(cfg.marksAll) } : {}) } });
        added += r.added;
      }
      if (added !== ids.length) { setCreated({ examId, added, wanted: ids.length }); throw new Error(`Only ${added} of ${ids.length} questions could be added (some were no longer usable). Your draft was saved: open it to check.`); }
      if (cfg.perStudent !== "") { // each student's own draw, per subject (stopped BEFORE publishing if it cannot be saved)
        setSaving("Saving each student's question plan...");
        const sections = quotaRows.map((r) => ({ subject: r.subject, count: Math.floor(Number(quotas[r.subject])) })).filter((x) => Number.isFinite(x.count) && x.count > 0);
        try { await api(`/admin/access/exams/${examId}/draw`, { method: "PUT", token, body: { sections, drawSpread: cfg.drawSpread, drawBalance: cfg.drawBalance, drawMixDifficulty: cfg.drawMix } }); }
        catch (e) { setCreated({ examId }); throw new Error(`The examination and its questions were saved, but the per-subject plan could not be (${e.message}). It has NOT been published. Open the draft to fix it.`); }
      }
      if (cfg.lbEnabled) {
        try { await api(`/admin/access/exams/${examId}/leaderboard`, { method: "PUT", token, body: { enabled: true, names: cfg.lbNames } }); }
        catch (e) { setCreated({ examId }); throw new Error(`The examination was saved, but the scoreboard setting could not be (${e.message}). It has NOT been published. Open the draft to set it.`); }
      }
      if (publish) { setSaving("Publishing..."); await api(`/admin/exams/${examId}/publish`, { method: "POST", token }); }
      navigate(`/admin/exams/${examId}`);
    } catch (e) {
      setSaveError(e.message + (examId && !created ? " Your draft was created and can be opened from the examinations list." : ""));
      if (examId) setCreated((c) => c || { examId });
      setSaving("");
    }
  };

  const hidePool = cfg.perStudent !== "" && !showPool;
  const warn = result?.warnings;
  const short = result && result.shortfall > 0;

  const perStudentFieldset = (
          <fieldset className="xb-fieldset">
            <legend>Different questions for each student?</legend>
            <label className="flag-toggle">
              <input type="checkbox" checked={cfg.perStudent !== ""} onChange={(e) => setCfg((c) => ({ ...c, perStudent: e.target.checked ? String(Math.min(40, Math.max(1, Math.floor((Number(src.count) || 2) / 2)))) : "" }))} />
              Give each student their own different questions
            </label>
            {cfg.perStudent === "" ? (
              <p className="muted xb-help">Off: every student gets exactly the questions you pick below, the same for everyone. Turn this on to pick a large pool and let iPrime give each student a different set from it.</p>
            ) : (
              <>
                <p className="muted xb-help">On: the number you pick above is the <strong>pool</strong> (the bigger, the more different the papers). Each student is given their own draw from it when they start.</p>
                <p className="note">Set how many questions each student gets <strong>from each subject</strong> in the next step (Settings).</p>

                {result && result.available.total > result.selected && (
                  <p className="note">You have {result.available.total} usable questions available but are only using {result.selected} as the pool. For more different papers, set <strong>Number of questions to pick</strong> to {result.available.total} and press <strong>Pick again</strong>.{" "}
                    <button type="button" className="link-btn" onClick={() => setS("count", String(result.available.total))}>Use all {result.available.total}</button>
                  </p>
                )}
              </>
            )}
          </fieldset>
  );

  return (
    <div className="admin-page">
      <p><Link to="/admin/exams">← All examinations</Link></p>
      <div className="page-bar"><div><p className="eyebrow">Administration</p><h1>Build an examination</h1><p className="muted">Choose questions from the question bank, set the rules, and publish. Nothing is visible to students until you publish.</p></div></div>

      <ol className="xb-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" className={`xb-step${i < step ? " is-done" : ""}`} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
              <span className="xb-step-n" aria-hidden="true">{i < step ? "✓" : i + 1}</span><span className="xb-step-t">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="panel form form-tight" aria-labelledby="s0">
          <h2 className="panel-title" id="s0">1. Basics</h2>
          <Field label="Examination title" id="b-title" value={basics.title} onChange={setB("title")} required maxLength={150} />
          <div className="grid-2">
            <Field label="Subject" id="b-subject" value={basics.subject} onChange={setB("subject")} required maxLength={80} hint="Shown to students. Usually the same as the question-bank subject." list="bank-subjects" />
            <Field label="Class or level (optional)" id="b-level" value={basics.level} onChange={setB("level")} maxLength={60} hint="For example: SS 3" />
          </div>
          <datalist id="bank-subjects">{subjects.map((s) => <option key={s.name} value={s.name} />)}</datalist>
          <Field label="Examination type (optional)" id="b-type" value={basics.examType} onChange={setB("examType")} maxLength={60} hint="For example: Practice test" />
          <Field label="Instructions shown before starting (optional)" id="b-inst"><textarea id="b-inst" rows="3" value={basics.instructions} onChange={setB("instructions")} maxLength={3000} /></Field>
        </section>
      )}

      {step === 1 && (
        <section className="panel form form-tight" aria-labelledby="s1">
          <h2 className="panel-title" id="s1">2. Questions</h2>
          <div className="xb-radios" role="radiogroup" aria-label="Where the questions come from">
            <label className={src.source === "bank" ? "is-on" : ""}><input type="radio" name="source" checked={src.source === "bank"} onChange={() => { setSrc((x) => ({ ...x, source: "bank" })); setResult(null); }} /><span><strong>Choose from the question bank</strong><small>Pick subjects and topics you already have.</small></span></label>
            <label className={src.source === "upload" ? "is-on" : ""}><input type="radio" name="source" checked={src.source === "upload"} onChange={() => { setSrc((x) => ({ ...x, source: "upload" })); setResult(null); }} /><span><strong>Upload my own questions</strong><small>Excel or CSV files, one or several (for example one per subject). They are saved to the question bank for reuse.</small></span></label>
          </div>
          {src.source === "upload" && (
            <ExamUploadStep token={token} onReady={(d) => {
              const q = d.questions, tally = (key, none) => q.reduce((m, x) => { const k = key(x) || none; m[k] = (m[k] || 0) + 1; return m; }, {});
              setResult({ questions: q.map((x) => ({ ...x, manual: false, neighbour: false, fixedOptions: false })), requested: q.length, selected: q.length, shortfall: 0, manualCount: 0, notes: [], breakdown: { bySubject: tally((x) => x.subject, "(no subject)"), byTopic: tally((x) => x.topic, "(no topic)"), byDifficulty: tally((x) => x.difficulty, "unrated") }, totalMarks: q.reduce((n, x) => n + (x.marks ?? 1), 0), available: { total: q.length, byTopic: [], byDifficulty: {}, verified: 0, unverified: q.length }, warnings: { unverified: q.length, neighbourDependent: 0, fixedOptions: 0 } });
            }} />
          )}
          {src.source === "upload" && result && perStudentFieldset}
          {facets.loading && <p className="muted" role="status">Loading the question bank...</p>}
          {facets.error && <p className="alert alert-error" role="alert">{facets.error}</p>}
          {facets.data && facets.data.totals.usable === 0 && <p className="alert alert-info">The question bank has no usable questions yet. <Link to="/admin/import">Import some first.</Link></p>}

          {src.source === "bank" && (<>
          <fieldset className="xb-fieldset">
            <legend>Where from</legend>
            <p><strong>Question banks</strong> <span className="muted">(tick one, or several to combine them; leave all unticked to use every subject)</span></p>
            <div className="xb-topics" role="group" aria-label="Question bank subjects">
              {subjects.map((s) => (
                <label key={s.name}><input type="checkbox" checked={src.subjects.includes(s.name)} onChange={(e) => { setSrc((x) => ({ ...x, subjects: e.target.checked ? [...x.subjects, s.name] : x.subjects.filter((n) => n !== s.name), topics: [], balanceBy: (e.target.checked ? x.subjects.length + 1 : x.subjects.length - 1) > 1 ? "subject" : "topic" })); setResult(null); setManual({}); setExcluded([]); }} /> {s.name} <span className="muted">({s.count})</span></label>
              ))}
            </div>
            {src.subjects.length > 1 && (
              <div className="xb-radios" role="radiogroup" aria-label="Spread evenly across">
                <label className={src.balanceBy === "subject" ? "is-on" : ""}><input type="radio" name="balanceBy" checked={src.balanceBy === "subject"} onChange={() => setS("balanceBy", "subject")} /><span><strong>Evenly across subjects</strong><small>Each subject contributes the same number of questions.</small></span></label>
                <label className={src.balanceBy === "topic" ? "is-on" : ""}><input type="radio" name="balanceBy" checked={src.balanceBy === "topic"} onChange={() => setS("balanceBy", "topic")} /><span><strong>Evenly across topics</strong></span></label>
              </div>
            )}
            {topicsHere.length > 0 && (
              <>
                <p><strong>Topics</strong> <span className="muted">(leave all unticked to use every topic)</span></p>
                <div className="form-actions"><button type="button" className="link-btn" onClick={() => setS("topics", topicsHere.map((t) => t.name))}>Select all</button><button type="button" className="link-btn" onClick={() => setS("topics", [])}>Clear</button></div>
                <div className="xb-topics" role="group" aria-label="Topics">
                  {topicsHere.map((t) => (
                    <label key={`${t.subject}-${t.name}`}><input type="checkbox" checked={src.topics.includes(t.name)} onChange={(e) => setS("topics", e.target.checked ? [...src.topics, t.name] : src.topics.filter((x) => x !== t.name))} /> {t.name} <span className="muted">({t.count})</span></label>
                  ))}
                </div>
              </>
            )}
          </fieldset>

          <fieldset className="xb-fieldset">
            <legend>How to choose</legend>
            <div className="xb-radios" role="radiogroup" aria-label="Selection method">
              {[["random", "Random", "iPrime picks the questions for you."], ["manual", "Manual", "You tick every question yourself."], ["mixed", "Mixed", "You tick some; iPrime picks the rest at random."]].map(([v, t, d]) => (
                <label key={v} className={src.mode === v ? "is-on" : ""}><input type="radio" name="mode" value={v} checked={src.mode === v} onChange={() => { setS("mode", v); }} /><span><strong>{t}</strong><small>{d}</small></span></label>
              ))}
            </div>
            {src.mode !== "manual" && (
              <>
                <label className="flag-toggle"><input type="checkbox" checked={src.all} onChange={(e) => setS("all", e.target.checked)} /> Use every matching question <span className="muted">(best for a pool: students are drawn from all of it)</span></label>
                {!src.all && <Field label="Number of questions to pick" id="s-count" type="number" min="1" value={src.count} onChange={(e) => setS("count", e.target.value)} hint="There is no upper limit. This is the exam, or the pool students are drawn from." />}
              </>
            )}
            {src.mode !== "manual" && (
              <>
                <div className="xb-radios" role="radiogroup" aria-label="Difficulty">
                  <label className={src.difficultyMode === "any" ? "is-on" : ""}><input type="radio" name="diff" checked={src.difficultyMode === "any"} onChange={() => setS("difficultyMode", "any")} /><span><strong>Any difficulty</strong></span></label>
                  <label className={src.difficultyMode === "mix" ? "is-on" : ""}><input type="radio" name="diff" checked={src.difficultyMode === "mix"} onChange={() => setS("difficultyMode", "mix")} /><span><strong>Mixed difficulty</strong><small>Only works for questions that have a difficulty rating. Unrated ones are used only to fill gaps.</small></span></label>
                </div>
                {src.difficultyMode === "mix" && (
                  <div className="xb-mix" role="group" aria-label="Difficulty mix in percent">
                    {LEVELS.map((l) => <label key={l}>{cap(l)} %<input type="number" min="0" max="100" value={src.mix[l]} onChange={(e) => setS("mix", { ...src.mix, [l]: e.target.value })} /></label>)}
                  </div>
                )}
                <label className="flag-toggle"><input type="checkbox" checked={src.balanceTopics} onChange={(e) => setS("balanceTopics", e.target.checked)} /> Spread questions evenly across the chosen topics</label>
              </>
            )}
            <label className="flag-toggle"><input type="checkbox" checked={src.verifiedOnly} onChange={(e) => setS("verifiedOnly", e.target.checked)} /> Use verified questions only</label>
          </fieldset>

          {perStudentFieldset}

          {src.mode !== "random" && (
            <fieldset className="xb-fieldset">
              <legend>Pick by hand ({manualCount} ticked)</legend>
              <div className="xb-browser">
                <div className="xb-browser-head">
                  <input type="search" placeholder="Search questions" aria-label="Search questions" value={q} onChange={(e) => setQ(e.target.value)} />
                  <select aria-label="Filter by topic" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}><option value="">All topics</option>{topicsHere.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}</select>
                </div>
                {browse.loading && <p className="muted" style={{ padding: ".6rem" }} role="status">Loading...</p>}
                {browse.data && browse.data.questions.length === 0 && <p className="note" style={{ padding: ".6rem" }}>No matching usable questions.</p>}
                {browse.data?.questions.map((row) => (
                  <label key={row.id} className="xb-pick"><input type="checkbox" checked={Boolean(manual[row.id])} onChange={() => toggleManual(row)} aria-label={`Include ${row.externalId || "question"}`} />
                    <span><p>{row.text}</p><span className="muted">{[row.externalId, row.topic, row.difficulty].filter(Boolean).join(" · ")}</span></span></label>
                ))}
                {browse.data && browse.data.pages > 1 && (
                  <div className="xb-browser-head"><button type="button" className="btn btn-quiet btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="muted">Page {page} of {browse.data.pages}</span><button type="button" className="btn btn-quiet btn-sm" disabled={page >= browse.data.pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>
                )}
              </div>
            </fieldset>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => pick(false)} disabled={picking} aria-busy={picking}>{picking ? "Choosing..." : result ? (src.mode === "manual" ? "Update selection" : "Pick again") : (src.mode === "manual" ? "Use my ticked questions" : "Pick questions")}</button>
          </div>
          </>)}
          {pickError && <p className="alert alert-error" role="alert">{pickError}</p>}

          {result && (
            <div className={`xb-result${short ? " is-short" : ""}`} role="region" aria-label="Selected questions" aria-live="polite">
              <h3>{result.selected} of {result.requested} question{result.requested === 1 ? "" : "s"} selected{short ? ` (${result.shortfall} short)` : ""}</h3>
              <p className="muted">Available to choose from: {result.available.total} ({result.available.verified} verified, {result.available.unverified} not yet verified).</p>
              <ul className="xb-stats" aria-label="Breakdown">
                {Object.entries(result.breakdown.byTopic).map(([t, n]) => <li key={t}>{t}: {n}</li>)}
                {Object.entries(result.breakdown.byDifficulty).filter(([, n]) => n).map(([d, n]) => <li key={d}>{cap(d)}: {n}</li>)}
                <li>Total marks: {result.totalMarks}</li>
              </ul>
              <ul className="xb-notes">
                {result.notes.map((n, i) => noteText(n) && <li key={i}>{noteText(n)}</li>)}
                {warn?.unverified > 0 && <li>{plural(warn.unverified, "selected question")} {warn.unverified === 1 ? "has" : "have"} not been verified. You can still use them; consider verifying them in the question bank.</li>}
                {warn?.neighbourDependent > 0 && <li>{plural(warn.neighbourDependent, "question")} may refer to a shared passage or to neighbouring questions. If you randomise question order, those could be separated from what they refer to.</li>}
                {warn?.fixedOptions > 0 && <li>{plural(warn.fixedOptions, "question")} will always keep {warn.fixedOptions === 1 ? "its" : "their"} option order because the options refer to each other.</li>}
              </ul>
              {hidePool ? (
                <p className="note">The list of questions is hidden because every student will be given their own draw from this pool, so you do not need to check them one by one. The breakdown above shows what the pool contains.{" "}
                  <button type="button" className="link-btn" onClick={() => setShowPool(true)}>Show the pool's questions</button></p>
              ) : (
                <>
              <ol className="xb-qlist" aria-label="Chosen questions">
                {(showAll ? chosen : chosen.slice(0, 25)).map((c, i) => (
                  <li key={c.id} className="xb-q">
                    <div><p><strong>{i + 1}.</strong> {c.text}</p><div className="meta">{[c.externalId, c.topic, c.difficulty && cap(c.difficulty), `${c.marks} mark${c.marks === 1 ? "" : "s"}`, c.manual && "picked by you", !c.verified && "not verified"].filter(Boolean).map((m) => <span key={m}>{m}</span>)}</div></div>
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => removeQ(c.id)} aria-label={`Remove question ${i + 1}`}>Remove</button>
                  </li>
                ))}
              </ol>
              {chosen.length > 25 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${chosen.length}`}</button>}
                  {cfg.perStudent !== "" && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowPool(false)}>Hide the questions</button>}
                </>
              )}
              {short && <p className="muted">Removed or short? Press <strong>Pick again</strong> to fill the gap with other matching questions.</p>}
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="panel form form-tight" aria-labelledby="s2">
          <h2 className="panel-title" id="s2">3. Settings</h2>
          <fieldset className="xb-fieldset">
            <legend>Questions each student gets</legend>
            <div className="xb-radios" role="radiogroup" aria-label="Question delivery">
              <label className={cfg.perStudent === "" ? "is-on" : ""}><input type="radio" name="delivery" checked={cfg.perStudent === ""} onChange={() => setCfg((c) => ({ ...c, perStudent: "" }))} /><span><strong>Everyone gets all {chosen.length} questions</strong></span></label>
              <label className={cfg.perStudent !== "" ? "is-on" : ""}><input type="radio" name="delivery" checked={cfg.perStudent !== ""} onChange={() => setCfg((c) => ({ ...c, perStudent: String(Math.min(40, Math.max(1, chosen.length - 1))) }))} /><span><strong>Each student gets their own different questions</strong><small>The {chosen.length} questions become a pool; every student is given their own draw from it when they start.</small></span></label>
            </div>
            {cfg.perStudent !== "" && (
              <>
                <p style={{ margin: "0 0 .4rem" }}><strong>How many questions does each student get from each subject?</strong> For example English 60 and Maths, Physics and Chemistry 40 each, like a JAMB paper. Each student's questions are drawn at random from the pool, so papers differ.</p>
                <SectionQuotas rows={quotaRows} values={quotas} onChange={setQuotas} />
                <p className="note" role="status">{describePool(cfg.perStudent, chosen.length).text}</p>
                <label className="flag-toggle"><input type="checkbox" checked={cfg.drawSpread} onChange={(e) => setCfg((c) => ({ ...c, drawSpread: e.target.checked }))} /> Give new students questions nobody has had yet (least-used first)</label>
                <label className="flag-toggle"><input type="checkbox" checked={cfg.drawBalance} onChange={(e) => setCfg((c) => ({ ...c, drawBalance: e.target.checked }))} /> Give every student an even mix of topics{src.subjects.length > 1 ? " and subjects" : ""}</label>
                <label className="flag-toggle"><input type="checkbox" checked={cfg.drawMix} onChange={(e) => setCfg((c) => ({ ...c, drawMix: e.target.checked }))} /> Give every student the same easy / medium / hard mix <span className="muted">(only for questions with a difficulty rating)</span></label>
                <p className="muted xb-help">Students do not all get equally hard papers unless you keep the mix even, so scores are most comparable when the topic and difficulty options above are on. A retake draws questions the student has not had before whenever the pool allows.</p>
              </>
            )}
          </fieldset>
          <DurationPicker id="b-duration" value={cfg.durationMinutes} onChange={(v) => setCfg((c) => ({ ...c, durationMinutes: v }))} />
          <Field label="Attempts allowed per student" id="b-attempts" type="number" min="1" max="20" value={cfg.maxAttempts} onChange={(e) => setCfg((c) => ({ ...c, maxAttempts: e.target.value }))} />
          <fieldset className="xb-switches">
            <legend>Randomisation</legend>
            <label className="flag-toggle"><input type="checkbox" checked={cfg.shuffleQuestions} onChange={(e) => setCfg((c) => ({ ...c, shuffleQuestions: e.target.checked }))} /> Give each student their own question order</label>
            <label className="flag-toggle"><input type="checkbox" checked={cfg.shuffleOptions} onChange={(e) => setCfg((c) => ({ ...c, shuffleOptions: e.target.checked }))} /> Give each student their own answer-option order</label>
            <p className="muted xb-help">Order is fixed per student when they start, so a refresh shows the same order. Marking follows the option itself, so a shuffle can never change a score.{warn?.neighbourDependent > 0 && cfg.shuffleQuestions ? " Some chosen questions may refer to a shared passage; consider leaving question order alone." : ""}</p>
          </fieldset>
          <fieldset className="xb-fieldset">
            <legend>Marks</legend>
            <div className="xb-radios" role="radiogroup" aria-label="Marks">
              <label className={cfg.marksMode === "bank" ? "is-on" : ""}><input type="radio" name="marks" checked={cfg.marksMode === "bank"} onChange={() => setCfg((c) => ({ ...c, marksMode: "bank" }))} /><span><strong>Use each question's own marks</strong><small>As set in the question bank (usually 1).</small></span></label>
              <label className={cfg.marksMode === "all" ? "is-on" : ""}><input type="radio" name="marks" checked={cfg.marksMode === "all"} onChange={() => setCfg((c) => ({ ...c, marksMode: "all" }))} /><span><strong>Same marks for every question</strong></span></label>
            </div>
            {cfg.marksMode === "all" && <Field label="Marks per question" id="b-marks" type="number" min="0.5" max="100" step="0.5" value={cfg.marksAll} onChange={(e) => setCfg((c) => ({ ...c, marksAll: e.target.value }))} />}
          </fieldset>
          <fieldset className="xb-fieldset">
            <legend>Scoreboard</legend>
            <label className="flag-toggle"><input type="checkbox" checked={cfg.lbEnabled} onChange={(e) => setCfg((c) => ({ ...c, lbEnabled: e.target.checked }))} /> Show a top-10 scoreboard for this examination</label>
            <p className="muted xb-help">Anyone who opens the examination, or its share link, can see the top 10, even before they sit it. Each person's first attempt counts. You can switch it off later.</p>
            {cfg.lbEnabled && (
              <div className="xb-radios" role="radiogroup" aria-label="How names appear on the scoreboard">
                {[["short", "First name and initial", "Ada O."], ["full", "Full names", "Ada Obi"], ["none", "No names", "Student"]].map(([v, t, ex]) => (
                  <label key={v} className={cfg.lbNames === v ? "is-on" : ""}><input type="radio" name="lbnames" checked={cfg.lbNames === v} onChange={() => setCfg((c) => ({ ...c, lbNames: v }))} /><span><strong>{t}</strong><small>For example: {ex}</small></span></label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="xb-fieldset">
            <legend>Examination password (optional)</legend>
            <p className="muted xb-help">If you set one, everyone who sits this examination, through a link or from the list, must enter it before they can start. It is not a login password. Share it with your students separately. It cannot be shown again after you save.</p>
            <div className="xb-browser-head" style={{ border: 0, padding: 0 }}>
              <input id="b-pw" aria-label="Examination password" type={showPw ? "text" : "password"} autoComplete="new-password" value={cfg.password} onChange={(e) => setCfg((c) => ({ ...c, password: e.target.value }))} placeholder="Leave empty for no password" />
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowPw((s) => !s)}>{showPw ? "Hide" : "Show"}</button>
            </div>
          </fieldset>
          <label className="flag-toggle"><input type="checkbox" checked={cfg.showAnswersAfter} onChange={(e) => setCfg((c) => ({ ...c, showAnswersAfter: e.target.checked }))} /> Let students review the correct answers after they submit</label>
        </section>
      )}

      {step === 3 && (
        <section className="panel" aria-labelledby="s3">
          <h2 className="panel-title" id="s3">4. Review and publish</h2>
          <dl className="xb-summary">
            <div><dt>Title</dt><dd>{basics.title || "—"}</dd></div>
            <div><dt>Subject</dt><dd>{basics.subject || "—"}{basics.level ? ` · ${basics.level}` : ""}</dd></div>
            <div><dt>Questions in the exam</dt><dd>{chosen.length}</dd></div>
            <div><dt>Each student gets</dt><dd>{cfg.perStudent !== "" && Number(cfg.perStudent) < chosen.length ? `${cfg.perStudent} (their own draw)` : `All ${chosen.length}`}</dd></div>
            <div><dt>Total marks (per student)</dt><dd>{cfg.perStudent !== "" && Number(cfg.perStudent) < chosen.length ? Math.round((totalMarks / (chosen.length || 1)) * Number(cfg.perStudent) * 100) / 100 : totalMarks}</dd></div>
            <div><dt>Duration</dt><dd>{durationLabel(cfg.durationMinutes) || "—"}</dd></div>
            <div><dt>Attempts</dt><dd>{cfg.maxAttempts}</dd></div>
            <div><dt>Examination password</dt><dd>{cfg.password ? "Required" : "None"}</dd></div>
            <div><dt>Scoreboard</dt><dd>{cfg.lbEnabled ? "Top 10 shown" : "Off"}</dd></div>
            <div><dt>Question order</dt><dd>{cfg.shuffleQuestions ? "Different for each student" : "Same for everyone"}</dd></div>
            <div><dt>Option order</dt><dd>{cfg.shuffleOptions ? "Different for each student" : "As written"}</dd></div>
          </dl>
          <ul className="xb-check" aria-label="Checklist">
            <li>{chosen.length} question{chosen.length === 1 ? "" : "s"} ready{cfg.perStudent !== "" ? `, drawn ${cfg.perStudent} per student` : ""}</li>
            {cfg.perStudent !== "" && <li>{describePool(cfg.perStudent, chosen.length).text}</li>}
            <li>Duration: {durationLabel(cfg.durationMinutes)}</li>
            {warn?.unverified > 0 && <li className="is-warn">{plural(warn.unverified, "question")} not yet verified</li>}
            {short && <li className="is-warn">{result.shortfall} fewer questions than requested</li>}
            {warn?.neighbourDependent > 0 && cfg.shuffleQuestions && <li className="is-warn">Question order is randomised but {plural(warn.neighbourDependent, "question")} may depend on a shared passage</li>}
            {!cfg.showAnswersAfter && <li>Students will not see correct answers after submitting</li>}
          </ul>
          {hidePool ? (
            <p className="note">Each student gets their own {cfg.perStudent} of the {chosen.length} questions, so there is no single paper to preview. <button type="button" className="link-btn" onClick={() => setShowPool(true)}>Show the pool's questions</button></p>
          ) : (
            <>
          <h3>Preview of questions{chosen.length > 25 && !showAll ? ` (first 25 of ${chosen.length})` : ""}</h3>
          {chosen.length > 25 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${chosen.length}`}</button>}
          <ol className="xb-qlist">{(showAll ? chosen : chosen.slice(0, 25)).map((c, i) => <li key={c.id} className="xb-q"><div><p><strong>{i + 1}.</strong> {c.text}</p><div className="meta">{[c.topic, c.difficulty && cap(c.difficulty)].filter(Boolean).map((m) => <span key={m}>{m}</span>)}</div></div></li>)}</ol>
            </>
          )}
          {saveError && <p className="alert alert-error" role="alert">{saveError} {created?.examId && <Link to={`/admin/exams/${created.examId}`}>Open the draft</Link>}</p>}
          {saving && <p className="alert alert-info" role="status">{saving}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" disabled={Boolean(saving) || !chosen.length} onClick={() => build(false)}>Save as draft</button>
            <button type="button" className="btn btn-primary" disabled={Boolean(saving) || !chosen.length} onClick={() => { if (window.confirm(`Publish "${basics.title}" to students now?`)) build(true); }}>Publish now</button>
          </div>
        </section>
      )}

      <div className="xb-nav">
        <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || Boolean(saving)}>Back</button>
        {step < 3 && <button type="button" className="btn btn-primary" onClick={() => go(step + 1)}>Next</button>}
      </div>
      {step < 3 && problems[step]?.length > 0 && <p className="muted" role="status">{problems[step][0]}</p>}
    </div>
  );
}
