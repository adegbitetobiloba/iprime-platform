import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";
import { KIND_LABEL, MaterialCard } from "../library/parts.jsx";
import "../library/library.css";

export default function LibraryMaterials() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "", subject = params.get("subject") || "", tag = params.get("tag") || "";
  const [text, setText] = useState(params.get("q") || "");
  const [q, setQ] = useState(text);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 300); return () => clearTimeout(t); }, [text]);

  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  if (subject) qs.set("subject", subject);
  if (tag) qs.set("tag", tag);
  if (q.length >= 2) qs.set("q", q);
  const { data, error, loading, reload } = useFetch(`/library/materials?${qs}`);

  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  const total = data ? Object.values(data.kinds).reduce((a, b) => a + b, 0) : 0;

  return (
    <section className="section">
      <div className="container">
        <p className="lib-crumbs"><Link to="/library">Library</Link> › Study materials</p>
        <div className="page-bar"><div><h1>Study materials</h1><p className="muted" style={{ margin: 0 }}>Syllabus, textbooks, past questions and notes.</p></div><Link to="/library/utme" className="btn btn-secondary">UTME hub</Link></div>

        <form className="lib-search" role="search" onSubmit={(e) => e.preventDefault()} style={{ marginBottom: 14 }}>
          <label htmlFor="mat-q" className="sr-only">Search study materials</label>
          <input id="mat-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by title, author or topic" maxLength={60} autoComplete="off" />
        </form>

        <div className="lib-pills" role="group" aria-label="Type of material">
          <button type="button" className="lib-pill" aria-pressed={!kind} onClick={() => set("kind", "")}>All{data ? ` (${total})` : ""}</button>
          {Object.keys(KIND_LABEL).map((k) => (data && data.kinds[k]) || kind === k ? <button key={k} type="button" className="lib-pill" aria-pressed={kind === k} onClick={() => set("kind", kind === k ? "" : k)}>{KIND_LABEL[k]}{data && data.kinds[k] ? ` (${data.kinds[k]})` : ""}</button> : null)}
        </div>
        {data && data.subjects.length > 0 && (
          <div className="lib-pills" role="group" aria-label="Subject">
            {data.subjects.map((s) => <button key={s.slug} type="button" className="lib-pill" aria-pressed={subject === s.slug} onClick={() => set("subject", subject === s.slug ? "" : s.slug)}>{s.name}</button>)}
          </div>
        )}
        {tag && <p>Showing {tag} materials. <button type="button" className="link-btn" onClick={() => set("tag", "")}>Clear</button></p>}

        {loading && !data && <div className="exam-card skeleton" aria-hidden="true" />}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
        {data && data.materials.length === 0 && <EmptyState icon="test" title={total === 0 ? "No study materials yet" : "Nothing matches"}>{total === 0 ? "Materials added by your tutors will appear here." : "Try a different word or clear a filter."}</EmptyState>}
        {data && data.materials.length > 0 && <ul className="lib-grid">{data.materials.map((m) => <MaterialCard key={m.id} m={m} />)}</ul>}
      </div>
    </section>
  );
}
