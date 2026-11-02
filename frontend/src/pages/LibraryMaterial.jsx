import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch } from "../useFetch.js";
import PdfViewer from "../library/PdfViewer.jsx";
import ImageViewer from "../library/ImageViewer.jsx";
import Markdown, { sectionsOf } from "../library/Markdown.jsx";
import { KIND_LABEL, MaterialCard, SHELF_LABEL } from "../library/parts.jsx";
import "../library/library.css";

export default function LibraryMaterial() {
  const { id } = useParams();
  const { token } = useAuth();
  const { data, error, loading, reload } = useFetch(`/library/materials/${id}`);
  const m = data && data.material;
  const preview = !!(data && data.preview);
  const [shelf, setShelf] = useState("");
  const [shelfMsg, setShelfMsg] = useState("");
  const [find, setFind] = useState("");
  const contentRef = useRef(null);

  useEffect(() => { if (m) { setShelf(m.shelf || ""); setShelfMsg(""); document.title = `${m.title} | iPrime`; } }, [m]);

  const save = useCallback((body) => { if (token && data && !data.preview) api(`/library/materials/${id}/progress`, { method: "PUT", token, body }).catch(() => {}); }, [id, token, data]);

  const changeShelf = async (e) => {
    const next = e.target.value;
    setShelf(next); setShelfMsg("");
    try { await api(`/library/materials/${id}/shelf`, { method: "PUT", token, body: { shelf: next || "none" } }); setShelfMsg("Saved"); } catch (x) { setShelfMsg(x.message); }
  };

  // Written materials: contents list, search inside the text, and reading position.
  const sections = useMemo(() => (m && m.source === "text" ? sectionsOf(m.body) : []), [m]);
  const term = find.trim().toLowerCase();
  const matches = term.length >= 2 ? sections.filter((s) => `${s.title} ${s.text}`.toLowerCase().includes(term)) : null;
  const snippet = (s) => { const t = s.text.replace(/\s+/g, " "); const i = t.toLowerCase().indexOf(term); return i < 0 ? "" : `… ${t.slice(Math.max(0, i - 40), i + 80)} …`; };
  const go = (sid) => { const el = document.getElementById(sid); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

  useEffect(() => {
    if (!m || m.source !== "text" || preview) return undefined;
    let last = 0, t = 0;
    const tick = () => {
      t = 0;
      const el = contentRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = Math.min(100, Math.round((Math.min(r.height, Math.max(0, window.innerHeight - r.top)) / Math.max(1, r.height)) * 100));
      if (pct >= last + 5 || (pct >= 95 && last < 95)) { last = pct; save({ percent: pct }); }
    };
    const onScroll = () => { if (!t) t = setTimeout(tick, 1500); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, [m, preview, save]);

  const resume = () => { const el = contentRef.current; if (!el) return; const y = el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight * (m.percent || 0)) / 100 - 80; window.scrollTo({ top: y, behavior: "smooth" }); };

  return (
    <section className="section">
      <div className="container">
        <p className="lib-crumbs"><Link to="/library">Library</Link> › <Link to="/library/materials">Study materials</Link>{m ? ` › ${KIND_LABEL[m.kind]}` : ""}</p>
        {loading && !data && <div className="exam-card skeleton" aria-hidden="true" />}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
        {data && m && (
          <>
            {preview && <p className="alert" role="status">Preview: students cannot see this material yet.</p>}
            <div className="exam-tags"><span className="badge">{KIND_LABEL[m.kind]}</span>{m.subject && <span className="badge badge-quiet">{m.subject.name}</span>}{(m.examTags || []).map((t) => <span key={t} className="badge badge-quiet">{t}</span>)}</div>
            <h1 style={{ marginTop: 8 }}>{m.title}</h1>
            {m.author && <p className="muted" style={{ margin: 0 }}>{m.author}</p>}
            {m.description && <p>{m.description}</p>}
            {m.sourceNote && <p className="lib-source">{m.sourceNote}</p>}

            {!preview && (
              <div className="lib-shelfbar">
                <label htmlFor="shelf-sel"><strong>My shelf</strong></label>
                <select id="shelf-sel" value={shelf} onChange={changeShelf}>
                  <option value="">Not on my shelf</option>
                  {Object.entries(SHELF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <span className="muted" role="status">{shelfMsg}</span>
                {m.source === "text" && m.percent > 5 && m.percent < 95 && <button type="button" className="btn btn-secondary btn-sm" onClick={resume}>Continue where I stopped ({m.percent}%)</button>}
              </div>
            )}

            {m.source === "link" && (
              <div className="lib-panel" style={{ marginTop: 16 }}>
                <p style={{ marginTop: 0 }}>This material is hosted on <strong>{m.host}</strong>. It opens in a new tab, so it may use your own data.</p>
                <a className="btn btn-primary" href={m.url} target="_blank" rel="noopener noreferrer">Open on {m.host}</a>
              </div>
            )}

            {m.source === "pdf" && (m.pdfAvailable
              ? <PdfViewer key={m.id} path={`/library/materials/${m.id}/pdf`} token={token} startPage={data.lastPage} onPage={(page, pageCount) => save({ page, pageCount })} />
              : <p className="note">The document has not been uploaded yet.</p>)}

            {m.source === "image" && (m.images && m.images.length
              ? <ImageViewer key={m.id} materialId={m.id} images={m.images} token={token} startPercent={m.percent || 0} onPercent={(percent) => save({ percent })} />
              : <p className="note">No images have been added yet.</p>)}

            {m.source === "text" && (
              <>
                {sections.length > 1 && (
                  <div className="lib-panel" style={{ margin: "12px 0" }}>
                    <div className="lib-search" style={{ marginTop: 0, maxWidth: "none" }}>
                      <label className="sr-only" htmlFor="find-topic">Find a topic in this text</label>
                      <input id="find-topic" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a topic, for example: Doppler" maxLength={60} autoComplete="off" />
                    </div>
                    {matches ? (
                      <div style={{ marginTop: 10 }} role="status">
                        {matches.length === 0 ? <p style={{ margin: 0 }}>No section mentions "{find.trim()}".</p>
                          : <ul className="lib-outline">{matches.map((s) => <li key={s.id}><button type="button" className="lib-lesson-link" style={{ width: "100%", textAlign: "left", border: 0, background: "none", font: "inherit", cursor: "pointer" }} onClick={() => { setFind(""); go(s.id); }}><strong>{s.title}</strong><span className="muted">{snippet(s)}</span></button></li>)}</ul>}
                      </div>
                    ) : (
                      <details style={{ marginTop: 10 }}>
                        <summary><strong>Contents</strong> ({sections.length} sections)</summary>
                        <ul className="lib-toc" style={{ marginTop: 8 }}>{sections.map((s) => <li key={s.id}><button type="button" onClick={() => go(s.id)}>{s.title}</button></li>)}</ul>
                      </details>
                    )}
                  </div>
                )}
                <div ref={contentRef}><Markdown text={m.body} /></div>
              </>
            )}

            {data.related && data.related.length > 0 && (
              <section className="lib-section">
                <h2>More like this</h2>
                <ul className="lib-grid">{data.related.map((r) => <MaterialCard key={r.id} m={r} />)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}
