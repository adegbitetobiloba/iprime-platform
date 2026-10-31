import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import Field from "../../components/Field.jsx";
import { checkFile, readTable, questionsFromSheet, runImport, newSessionId } from "../../lib/import/importPipeline.js";
import { FILTERS, filterQuestions, summarise, applyCorrection, recheckAll, canSelect, defaultSelection, buildItems, stampUids, templateCsv, isIncompleteState } from "../../lib/import/importFlow.js";
import { colLetter, OPTION_LETTERS } from "../../lib/import/columns.js";
import { CODE_INFO, STATE_LABELS } from "../../lib/import/codes.js";
import "../../import.css";

const PAGE = 25;
const stateTone = (s) => (s === "ready" || s === "ready_partial" ? "ok" : s === "needs_review" || s === "possible_duplicate" || s === "conflicting_answer" ? "warn" : "bad");
const snippet = (t, n = 110) => (t.length > n ? `${t.slice(0, n)}…` : t);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ---- manual column mapping ----
const MAP_FIELDS = [["externalId", "Question ID"], ["subject", "Subject"], ["topic", "Topic"], ["text", "Question"], ["correctKey", "Correct answer"], ["explanation", "Explanation"], ["sourceReference", "Source reference"], ["questionType", "Question type"]];
function ColumnMapper({ rows, initial, onApply, onCancel }) {
  const width = Math.max(1, ...rows.slice(0, 50).map((r) => r.length));
  const sample = (i) => { for (const r of rows.slice(0, 50)) { const v = String(r[i] ?? "").replace(/<[^>]*>/g, " ").trim(); if (v) return snippet(v, 28); } return "(empty)"; };
  const [fields, setFields] = useState({ ...(initial?.fields || {}) });
  const [options, setOptions] = useState({ ...(initial?.options || {}) });
  const [header, setHeader] = useState(initial ? initial.hasHeader !== false : false);
  const cols = Array.from({ length: width }, (_, i) => i);
  const pick = (value, set, key) => (e) => { const v = e.target.value; set((m) => { const n = { ...m }; if (v === "") delete n[key]; else n[key] = Number(v); return n; }); };
  const select = (id, value, onChange) => (
    <select id={id} className="ix-select" value={value ?? ""} onChange={onChange}>
      <option value="">Not in this file</option>
      {cols.map((i) => <option key={i} value={i}>Column {colLetter(i)}: {sample(i)}</option>)}
    </select>
  );
  const ok = fields.text !== undefined && Object.keys(options).length >= 2;
  return (
    <div className="panel ix-mapper">
      <h2 className="panel-title">Choose which column holds what</h2>
      <label className="ix-check"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> The first row is a heading row, not a question</label>
      <div className="ix-map-grid">
        {MAP_FIELDS.map(([k, label]) => (<div key={k}><label htmlFor={`m-${k}`}>{label}</label>{select(`m-${k}`, fields[k], pick(fields, setFields, k))}</div>))}
        {OPTION_LETTERS.map((L) => (<div key={L}><label htmlFor={`m-o${L}`}>Option {L}</label>{select(`m-o${L}`, options[L], pick(options, setOptions, L))}</div>))}
      </div>
      {!ok && <p className="muted">Choose at least the Question column and two option columns.</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={!ok} onClick={() => onApply({ fields, options, unmapped: [], duplicates: [], guessed: true, hasHeader: header }, header)}>Use this mapping</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---- correcting one question ----
function Editor({ q, onSave, onClose }) {
  const [f, setF] = useState({ text: q.text, subject: q.subject || "", topic: q.topic || "", correctKey: q.correctKey || "", explanation: q.explanation || "", options: OPTION_LETTERS.map((L) => ({ key: L, text: (q.options.find((o) => o.key === L) || {}).text || "" })) });
  const formatted = !!(q.textHtml || q.explanationHtml || q.options.some((o) => o.html));
  const setOpt = (L, text) => setF((x) => ({ ...x, options: x.options.map((o) => (o.key === L ? { ...o, text } : o)) }));
  const filled = f.options.filter((o) => o.text.trim());
  const save = () => onSave({ ...f, options: f.options.filter((o) => o.text.trim()) });
  return (
    <div className="dialog-overlay">
      <div className="dialog ix-editor" role="dialog" aria-modal="true" aria-labelledby="ix-edit-title">
        <h2 id="ix-edit-title">Correct this question{q.externalId ? ` (${q.externalId})` : ` (row ${q.provenance?.row ?? q.uid})`}</h2>
        {formatted && <p className="alert alert-warn">This question has formatting (such as underlining). Changing its wording removes that formatting.</p>}
        <label htmlFor="e-text">Question</label>
        <textarea id="e-text" className="ix-textarea" rows={5} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <div className="ix-opts">
          {f.options.map((o) => (
            <div key={o.key} className="ix-opt">
              <label htmlFor={`e-${o.key}`}>Option {o.key}</label>
              <input id={`e-${o.key}`} className="ix-input" value={o.text} onChange={(e) => setOpt(o.key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="grid-2">
          <div><label htmlFor="e-ans">Correct answer</label>
            <select id="e-ans" className="ix-select" value={f.correctKey} onChange={(e) => setF({ ...f, correctKey: e.target.value })}>
              <option value="">Not decided</option>
              {filled.map((o) => <option key={o.key} value={o.key}>{o.key}</option>)}
            </select>
          </div>
          <Field label="Topic" id="e-topic" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} maxLength={120} />
        </div>
        <Field label="Subject" id="e-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={80} />
        <label htmlFor="e-expl">Explanation (as stated by the source, if any)</label>
        <textarea id="e-expl" className="ix-textarea" rows={3} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={save}>Apply correction</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminImport() {
  const { token } = useAuth();
  const [step, setStep] = useState("upload"); // upload | review | importing | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [analysis, setAnalysis] = useState(null);     // { questions, mapping, report }
  const [mapCtx, setMapCtx] = useState({});           // manual mapping / confirmation
  const [mapping, setMapping] = useState(false);      // showing the column mapper
  const [questions, setQuestions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [onConflict, setOnConflict] = useState("skip");
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const session = useRef(null);
  const abort = useRef(null);
  const sent = useRef([]);

  const post = (path, body) => api(path, { method: "POST", token, body });

  const analyse = (sheet, ctx) => {
    const a = questionsFromSheet(sheet, ctx);
    setAnalysis(a);
    if (a.report.error) { setQuestions([]); setError(a.report.error); setMapping(true); return; }
    setError("");
    const qs = stampUids(a.questions);
    setQuestions(qs); setSelected(defaultSelection(qs)); setFilter("all"); setPage(0);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(""); setResult(null);
    const c = checkFile(f);
    if (!c.ok || (c.kind !== "xlsx" && c.kind !== "csv")) { setError(c.ok ? "On this screen, upload an .xlsx workbook or a .csv file. (PDF and text imports are handled separately.)" : c.message); return; }
    setBusy(true);
    try {
      const t = await readTable(await f.arrayBuffer(), c.kind);
      const usable = t.sheets.filter((s) => s.rows.some((r) => r.some((x) => String(x).trim())));
      if (!usable.length) throw new Error("This file has no data in it.");
      setFile(f); setSheets(usable); setSheetIdx(0); setMapCtx({}); setMapping(false);
      analyse(usable[0], {});
      session.current = newSessionId();
      setStep("review");
    } catch (err) { setError(err.message || "The file could not be read."); } finally { setBusy(false); }
  };

  const switchSheet = (i) => { setSheetIdx(i); setMapCtx({}); setMapping(false); analyse(sheets[i], {}); };
  const applyMapping = (m, header) => { const ctx = { mapping: m, mappingConfirmed: true, firstRowIsHeader: header }; setMapCtx(ctx); setMapping(false); analyse(sheets[sheetIdx], ctx); };
  const confirmMapping = () => { const ctx = { ...mapCtx, mapping: analysis.mapping, mappingConfirmed: true }; setMapCtx(ctx); analyse(sheets[sheetIdx], ctx); };

  const stats = useMemo(() => summarise(questions), [questions]);
  const shown = useMemo(() => filterQuestions(questions, filter), [questions, filter]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const rows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const needsConfirm = analysis?.report?.needsMappingConfirmation;

  const toggle = (uid) => setSelected((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const approve = (uid, on) => { setQuestions((qs) => qs.map((q) => (q.uid === uid ? { ...q, approved: on } : q))); if (on) setSelected((s) => new Set(s).add(uid)); };
  const correct = (patch) => {
    setQuestions((qs) => { const next = qs.map((q) => (q.uid === editing.uid ? applyCorrection(q, patch) : q)); recheckAll(next); const u = next.find((q) => q.uid === editing.uid); if (u.importable) setSelected((s) => new Set(s).add(u.uid)); return [...next]; });
    setEditing(null);
  };
  const selectReadyOnFilter = () => setSelected((s) => { const n = new Set(s); shown.forEach((q) => { if (q.importable) n.add(q.uid); }); return n; });
  const approveFiltered = () => { const ids = shown.filter((q) => !q.importable && !isIncompleteState(q.state)).map((q) => q.uid); setQuestions((qs) => qs.map((q) => (ids.includes(q.uid) ? { ...q, approved: true } : q))); setSelected((s) => new Set([...s, ...ids])); };

  const plan = useMemo(() => buildItems(questions, selected, { allowIncomplete }), [questions, selected, allowIncomplete]);

  const start = async (startBatch = 0) => {
    setConfirming(false); setStep("importing"); setError("");
    abort.current = new AbortController();
    if (startBatch === 0) sent.current = plan.items;
    const out = await runImport({
      items: sent.current, sessionId: session.current, post, document: file?.name, allowIncomplete, onConflict, startBatch,
      onProgress: setProgress, signal: abort.current.signal,
    });
    setResult((prev) => (startBatch === 0 || !prev ? out : { ...out, created: out.created + prev.created, unchanged: out.unchanged + prev.unchanged, updated: out.updated + prev.updated, conflicts: [...prev.conflicts, ...out.conflicts], rejected: [...prev.rejected, ...out.rejected], possibleDuplicates: [...prev.possibleDuplicates, ...out.possibleDuplicates] }));
    setStep("done");
  };

  const reset = () => { setStep("upload"); setFile(null); setSheets([]); setQuestions([]); setAnalysis(null); setResult(null); setProgress(null); setError(""); };

  return (
    <div className="admin-page ix">
      <div className="page-bar">
        <div><p className="eyebrow">Question bank</p><h1>Import questions</h1></div>
        <Link to="/admin/bank" className="btn btn-secondary">Open the question bank</Link>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {step === "upload" && (
        <section className="panel ix-drop">
          <h2 className="panel-title">1. Choose your workbook</h2>
          <p className="muted">Upload an .xlsx workbook that follows the iPrime question-bank template (any subject, any number of questions), or an older workbook without a heading row. Nothing is saved until you review it and confirm.</p>
          <label className="btn btn-primary ix-file">
            {busy ? "Reading the file…" : "Choose .xlsx or .csv file"}
            <input type="file" accept=".xlsx,.xlsm,.csv,.tsv" onChange={onFile} disabled={busy} />
          </label>
          <button type="button" className="btn btn-quiet" onClick={() => download("iprime-question-template.csv", templateCsv(), "text/csv")}>Download the template</button>
          <p className="muted ix-small">The template lists the 20 columns iPrime recognises: Question_ID, Subject, Topic, Question, Option_A to Option_F, Correct_Answer, Explanation, Source_Reference, Source_Page, Question_Type, Review_Status, Review_Notes, Explanation_Source, Image_Reference and Source_Label. Other columns are kept with the question, not thrown away.</p>
        </section>
      )}

      {step === "review" && analysis && (
        <>
          <section className="panel">
            <h2 className="panel-title">2. What was found in {file?.name}</h2>
            {sheets.length > 1 && (
              <div className="ix-sheet"><label htmlFor="sheet">Worksheet</label>
                <select id="sheet" className="ix-select" value={sheetIdx} onChange={(e) => switchSheet(Number(e.target.value))}>{sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}</select>
              </div>
            )}
            {analysis.mapping && !analysis.report.error && (
              <p className="muted">
                {analysis.report.headerRow ? "Headings recognised." : "No heading row: columns were worked out from the data."} {analysis.report.rowsRead} rows read, {analysis.report.blankRows} blank, {analysis.report.questions} questions.
                {analysis.report.unmappedColumns?.length > 0 && ` Extra columns kept with each question: ${analysis.report.unmappedColumns.join(", ")}.`}
              </p>
            )}
            {needsConfirm && (
              <div className="alert alert-warn" role="status">
                <strong>Please confirm the columns{analysis.report.mappingConfidence === "low" ? " (low confidence)" : ""}:</strong>
                <ul className="plain-list">{analysis.report.mappingSummary?.map((l) => <li key={l}>{l}</li>)}</ul>
                <div className="form-actions"><button type="button" className="btn btn-primary btn-sm" onClick={confirmMapping}>Yes, this is correct</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setMapping(true)}>Change the columns</button></div>
              </div>
            )}
            {!needsConfirm && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMapping(true)}>Change the columns</button>}
          </section>

          {mapping && <ColumnMapper rows={sheets[sheetIdx].rows} initial={analysis.mapping} onApply={applyMapping} onCancel={() => setMapping(false)} />}

          {questions.length > 0 && (
            <>
              <section className="ix-stats" aria-label="Summary">
                {[["all", "Questions", stats.total], ["ready", "Ready", stats.ready], ["needs_review", "Needs review", stats.needsReview], ["missing_answer", "No answer", stats.missingAnswer], ["invalid_options", "Bad options", stats.invalidOptions], ["incomplete", "Incomplete", stats.incomplete], ["duplicates", "Duplicates", stats.duplicates], ["visual", "Diagram", stats.visual]].map(([id, label, n]) => (
                  <button key={id} type="button" className={`ix-stat${filter === id ? " is-active" : ""}`} onClick={() => { setFilter(id); setPage(0); }} aria-pressed={filter === id}><strong>{n}</strong><span>{label}</span></button>
                ))}
              </section>

              <section className="panel">
                <h2 className="panel-title">3. Review and correct</h2>
                <div className="ix-toolbar">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={selectReadyOnFilter}>Select ready questions shown</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={approveFiltered}>Approve the “needs review” questions shown</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
                </div>
                <div className="table-wrap">
                  <table className="data-table ix-table">
                    <thead><tr><th><span className="sr-only">Import</span></th><th>ID / row</th><th>Question</th><th>Status</th><th>What to check</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {rows.map((q) => {
                        const can = canSelect(q, { allowIncomplete });
                        return (
                          <tr key={q.uid}>
                            <td><input type="checkbox" aria-label={`Import question ${q.externalId || q.uid}`} checked={selected.has(q.uid) && can} disabled={!can} onChange={() => toggle(q.uid)} /></td>
                            <td><strong>{q.externalId || `Row ${q.provenance?.row ?? q.uid}`}</strong>{q.sharedPassage && <><br /><span className="muted ix-small">Passage group {q.sharedPassage.group}</span></>}</td>
                            <td><p className="ix-q">{snippet(q.text || "(no question text)")}</p>{q.textHtml && <span className="badge badge-quiet">Formatted</span>}{q.options.length > 0 && <span className="muted ix-small">{q.options.length} options{q.correctKey ? ` · answer ${q.correctKey}` : ""}</span>}</td>
                            <td><span className={`badge ix-badge-${stateTone(q.state)}`}>{STATE_LABELS[q.state] || q.state}</span>{q.approved && <span className="badge badge-quiet">Approved</span>}{q.edited && <span className="badge badge-quiet">Corrected</span>}</td>
                            <td className="ix-issues">{q.issues.length === 0 ? <span className="muted">Nothing</span> : q.issues.slice(0, 3).map((i) => <span key={i.code} title={CODE_INFO[i.code]?.explain} className="ix-issue">{CODE_INFO[i.code]?.title || i.code}{i.detail && i.code !== "MATH" ? `: ${snippet(i.detail, 60)}` : ""}</span>)}{q.issues.length > 3 && <span className="muted ix-small">+{q.issues.length - 3} more</span>}</td>
                            <td className="ix-actions">
                              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(q)}>Correct</button>
                              {!q.importable && !isIncompleteState(q.state) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => approve(q.uid, !q.approved)}>{q.approved ? "Un-approve" : "Approve"}</button>}
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && <tr><td colSpan={6} className="note">No questions in this group.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="ix-pager">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <span>Page {page + 1} of {pages} · {shown.length} shown</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </section>

              <section className="panel">
                <h2 className="panel-title">4. Import</h2>
                <label className="ix-check"><input type="checkbox" checked={allowIncomplete} onChange={(e) => setAllowIncomplete(e.target.checked)} /> Also keep incomplete questions (no answer, too few options, no text, needs a diagram) in the bank so they can be finished later. They cannot be used in an exam until they are complete.</label>
                <label className="ix-check"><input type="checkbox" checked={onConflict === "update"} onChange={(e) => setOnConflict(e.target.checked ? "update" : "skip")} /> If a question ID already exists with different content, replace it (never replaces a question an administrator has edited). Otherwise it is skipped and reported.</label>
                <p className="ix-count"><strong>{plan.items.length}</strong> question{plan.items.length === 1 ? "" : "s"} will be sent{plan.leftOut.length > 0 ? `, ${plan.leftOut.length} left out until approved` : ""}.</p>
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" disabled={plan.items.length === 0 || needsConfirm} onClick={() => setConfirming(true)}>Review and import</button>
                  <button type="button" className="btn btn-secondary" onClick={reset}>Start again</button>
                </div>
                {needsConfirm && <p className="muted">Confirm the columns above first.</p>}
              </section>
            </>
          )}
        </>
      )}

      {step === "importing" && (
        <section className="panel" aria-live="polite">
          <h2 className="panel-title">Importing…</h2>
          <progress className="ix-progress" max={progress?.total || 1} value={progress?.sent || 0} />
          <p>{progress ? `${progress.sent} of ${progress.total} sent (batch ${progress.batch} of ${progress.totalBatches})` : "Starting…"}</p>
          <button type="button" className="btn btn-secondary" onClick={() => abort.current?.abort()}>Stop after this batch</button>
        </section>
      )}

      {step === "done" && result && (
        <section className="panel" aria-live="polite">
          <h2 className="panel-title">{result.status === "done" ? "Import finished" : result.status === "cancelled" ? "Import stopped" : "Import interrupted"}</h2>
          {result.status === "failed" && <p className="alert alert-error" role="alert">{result.error} Nothing is lost: questions already saved stay saved, and resuming will not create copies.</p>}
          <ul className="ix-summary">
            <li><strong>{result.created}</strong> added to the question bank</li>
            <li><strong>{result.unchanged}</strong> already there, unchanged</li>
            <li><strong>{result.updated}</strong> updated</li>
            <li><strong>{result.conflicts.length}</strong> skipped because the ID already exists with different content or was edited by an administrator</li>
            <li><strong>{result.rejected.length}</strong> not accepted by the server</li>
            <li><strong>{result.possibleDuplicates.length}</strong> possible duplicates of existing questions (kept; check them in the bank)</li>
            <li><strong>{Math.max(0, questions.length - sent.current.length)}</strong> not sent (not selected, or waiting for approval)</li>
          </ul>
          {result.rejected.length > 0 && (
            <details><summary>Why some were not accepted</summary>
              <ul className="plain-list">{result.rejected.slice(0, 50).map((r) => <li key={`${r.index}-${r.reason}`}>{r.externalId || `Item ${r.index + 1}`}: {(r.problems || []).map((p) => p.message).join(" ") || r.reason}</li>)}</ul>
            </details>
          )}
          <div className="form-actions">
            {result.status !== "done" && <button type="button" className="btn btn-primary" onClick={() => start(result.nextBatch)}>Resume</button>}
            <Link to="/admin/bank" className="btn btn-primary">Open the question bank</Link>
            <button type="button" className="btn btn-secondary" onClick={reset}>Import another file</button>
          </div>
        </section>
      )}

      {editing && <Editor q={editing} onSave={correct} onClose={() => setEditing(null)} />}

      {confirming && (
        <div className="dialog-overlay">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="ix-confirm">
            <h2 id="ix-confirm">Import {plan.items.length} questions?</h2>
            <ul className="plain-list">
              <li>Existing questions are never overwritten or deleted by default.</li>
              <li>Questions an administrator has already edited are never replaced.</li>
              {allowIncomplete && <li>Incomplete questions will be saved as incomplete, ready for you to finish.</li>}
              <li>You can stop at any time and resume later without creating copies.</li>
            </ul>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => start(0)}>Import now</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>Go back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
