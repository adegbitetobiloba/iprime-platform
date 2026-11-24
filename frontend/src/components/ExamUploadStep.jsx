import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { checkFile, readTable, questionsFromSheet, newSessionId, runImport } from "../lib/import/importPipeline.js";
import { defaultSelection, buildItems, summarise } from "../lib/import/importFlow.js";
import { questionFingerprint } from "../lib/import/fingerprint.js";
import "../pages/exam-tools.css";

const NOISE = /\b(questions?|bank|mock|exam|examination|test|utme|jamb|waec|neco|past|paper|file|final|new|copy|\d+(st|nd|rd|th)?)\b/gi;
export const guessSubject = (filename) => {
  const s = String(filename).replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.()]+/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "General";
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "x";

// Upload questions while building an exam: Excel / CSV, one file or several (for example one per subject).
// Complete questions are saved to the question bank (so they can be reused) and become this exam's pool.
export default function ExamUploadStep({ token, onReady }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const analyse = (entry, ctx = entry.ctx) => {
    const a = questionsFromSheet(entry.sheets[entry.sheetIdx], ctx);
    if (a.report && a.report.error) return { ...entry, ctx, error: a.report.error, questions: [], analysis: a };
    return { ...entry, ctx, error: "", analysis: a, questions: a.questions };
  };
  const add = async (list) => {
    setError(""); setDone(null);
    const out = [];
    for (const file of Array.from(list)) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (files.some((f) => f.id === id) || out.some((f) => f.id === id)) continue;
      const c = checkFile(file);
      if (!c.ok || !["xlsx", "csv"].includes(c.kind)) { out.push({ id, name: file.name, error: (c && c.message) || "Only Excel (.xlsx) and CSV files can be uploaded here.", questions: [], sheets: [] }); continue; }
      try {
        const t = await readTable(await file.arrayBuffer(), c.kind);
        const sheets = (t.sheets || []).filter((s) => s.rows && s.rows.length > 1);
        if (!sheets.length) { out.push({ id, name: file.name, error: "This file has no questions in it.", questions: [], sheets: [] }); continue; }
        const sheetIdx = sheets.reduce((best, s, i) => (s.rows.length > sheets[best].rows.length ? i : best), 0);
        out.push(analyse({ id, name: file.name, sheets, sheetIdx, ctx: {}, subject: guessSubject(file.name) }));
      } catch (e) { out.push({ id, name: file.name, error: e.message || "That file could not be read.", questions: [], sheets: [] }); }
    }
    setFiles((f) => [...f, ...out]);
  };
  const patch = (id, fn) => setFiles((fs) => fs.map((f) => (f.id === id ? fn(f) : f)));

  // Everything that will be saved: subject filled in, permanent IDs that cannot clash between files.
  const prepared = () => {
    const all = [];
    files.forEach((f, fi) => f.questions.forEach((q) => all.push({ ...q, subject: String(q.subject || f.subject || "General").trim(), _file: fi })));
    all.forEach((q) => { if (!q.externalId) q.externalId = `UPL-${questionFingerprint(q.text, (q.options || []).map((o) => o.text)).slice(0, 16)}`; });
    const seen = new Map(); all.forEach((q) => seen.set(q.externalId, (seen.get(q.externalId) || 0) + 1));
    all.forEach((q) => { if (seen.get(q.externalId) > 1) q.externalId = `${slug(q.subject)}-${q.externalId}`; }); // the same ID in two files: keep them apart
    const again = new Map(); all.forEach((q) => again.set(q.externalId, (again.get(q.externalId) || 0) + 1));
    all.forEach((q, i) => { if (again.get(q.externalId) > 1) q.externalId = `${q.externalId}-${q._file}-${i}`; });
    return all.map((q, i) => ({ ...q, uid: i + 1 }));
  };
  const all = prepared();
  const selected = defaultSelection(all);
  const importable = all.filter((q) => selected.has(q.uid));
  const left = all.length - importable.length;
  const bySubject = importable.reduce((m, q) => { m[q.subject] = (m[q.subject] || 0) + 1; return m; }, {});
  const needsConfirm = files.some((f) => f.analysis && f.analysis.report && f.analysis.report.needsMappingConfirmation && !f.ctx.mappingConfirmed);

  const go = async () => {
    setBusy(true); setError(""); setProgress({ done: 0, total: importable.length });
    try {
      const plan = buildItems(all, selected, { allowIncomplete: false });
      const post = (path, body) => api(path, { method: "POST", token, body });
      const r = await runImport({ items: plan.items, sessionId: newSessionId(), post, document: files.map((f) => f.name).join(", ").slice(0, 200), allowIncomplete: false, onConflict: "skip", onProgress: (p) => setProgress({ done: p.done ?? p.sent ?? 0, total: importable.length }) });
      const ids = plan.items.map((i) => i.externalId);
      let found = [], missing = 0;
      for (let i = 0; i < ids.length; i += 1000) { const d = await api("/admin/bank/by-external", { method: "POST", token, body: { externalIds: ids.slice(i, i + 1000) } }); found = found.concat(d.questions); missing += d.missing; }
      if (!found.length) throw new Error("None of the uploaded questions could be saved. Open the full importer to see why.");
      setDone({ n: found.length, left }); onReady({ questions: found, saved: r, missing, leftOut: left });
    } catch (e) { setError(e.message || "The upload failed. Nothing was lost: questions already saved stay saved, and uploading again will not create copies."); }
    finally { setBusy(false); }
  };

  return (
    <div className="et">
      <div className="up-drop">
        <p style={{ margin: 0 }}><strong>Upload your questions</strong><br /><span className="ax-hint">Excel (.xlsx) or CSV. Choose one file, or several (for example one per subject). The system sorts them by subject and saves them to the question bank so you can reuse them.</span></p>
        <input type="file" multiple accept=".xlsx,.csv" aria-label="Choose question files" disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <p className="ax-hint" style={{ margin: 0 }}>Not sure of the layout? <Link to="/admin/import">Download the template in the full importer.</Link></p>
      </div>
      {files.length > 0 && (
        <ul className="up-files">
          {files.map((f) => {
            const noSubject = f.questions.filter((q) => !String(q.subject || "").trim()).length;
            const sum = f.questions.length ? summarise(f.questions) : null;
            const confirm = f.analysis && f.analysis.report && f.analysis.report.needsMappingConfirmation && !f.ctx.mappingConfirmed;
            return (
              <li className="up-file" key={f.id}>
                <h4>{f.name}</h4>
                {f.error && <p className="alert alert-error" role="alert">{f.error}</p>}
                {confirm && (
                  <div className="alert alert-info">
                    <p style={{ margin: "0 0 .5rem" }}>This file has no heading row. We read it as: <strong>{f.analysis.report.mappingSummary || "the standard column order"}</strong>. Is that right?</p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => patch(f.id, (x) => analyse(x, { ...x.ctx, mapping: x.analysis.mapping, mappingConfirmed: true }))}>Yes, read it this way</button>
                  </div>
                )}
                {!f.error && !confirm && f.questions.length > 0 && (
                  <>
                    <ul className="up-chips" aria-label="Questions found">
                      <li>{f.questions.length} question{f.questions.length === 1 ? "" : "s"} found</li>
                      {sum && sum.incomplete > 0 && <li className="is-bad">{sum.incomplete} incomplete (left out)</li>}
                      {sum && sum.duplicates > 0 && <li className="is-bad">{sum.duplicates} possible duplicate{sum.duplicates === 1 ? "" : "s"}</li>}
                    </ul>
                    {noSubject > 0 && (
                      <div className="up-field">
                        <label htmlFor={`sub-${f.id}`}>{noSubject === f.questions.length ? "These questions have no subject column. Subject for this file:" : `${noSubject} question${noSubject === 1 ? " has" : "s have"} no subject. Put them under:`}</label>
                        <input id={`sub-${f.id}`} type="text" maxLength={80} value={f.subject} onChange={(e) => patch(f.id, (x) => ({ ...x, subject: e.target.value }))} />
                      </div>
                    )}
                    {f.sheets.length > 1 && (
                      <div className="up-field"><label htmlFor={`sh-${f.id}`}>Sheet to read</label>
                        <select id={`sh-${f.id}`} value={f.sheetIdx} onChange={(e) => patch(f.id, (x) => analyse({ ...x, sheetIdx: Number(e.target.value) }, {}))}>{f.sheets.map((s, i) => <option key={i} value={i}>{s.name || `Sheet ${i + 1}`} ({s.rows.length - 1} rows)</option>)}</select></div>
                    )}
                  </>
                )}
                <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))}>Remove file</button>
              </li>
            );
          })}
        </ul>
      )}
      {done && <p className="alert alert-success" role="status">✓ {done.n} question{done.n === 1 ? "" : "s"} saved to the question bank and ready to use{done.left ? ` (${done.left} left out)` : ""}. You can add more files, or continue below.</p>}
      {importable.length > 0 && !needsConfirm && !done && (
        <div className="xb-result" role="region" aria-label="What will be added">
          <h3>{importable.length} question{importable.length === 1 ? "" : "s"} ready</h3>
          <ul className="up-chips">{Object.entries(bySubject).map(([s, n]) => <li key={s}>{s}: {n}</li>)}</ul>
          {left > 0 && <p className="note">{left} incomplete or invalid question{left === 1 ? " is" : "s are"} left out. Fix them in the <Link to="/admin/import">full importer</Link> if you need them.</p>}
          {busy && progress && <div className="up-bar" role="progressbar" aria-valuemin="0" aria-valuemax={progress.total} aria-valuenow={progress.done}><span style={{ width: `${progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0}%` }} /></div>}
          <button type="button" className="btn btn-primary" onClick={go} disabled={busy} aria-busy={busy}>{busy ? "Saving to the question bank..." : `Add ${importable.length} question${importable.length === 1 ? "" : "s"} to the question bank and continue`}</button>
        </div>
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </div>
  );
}
