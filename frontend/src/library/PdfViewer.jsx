import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPdfBytes } from "./files.js";

// In-page PDF reader. Pages are drawn to a canvas (pdf.js loads only when a PDF lesson opens), there is no download or print button,
// and the file is fetched with the student's sign-in token. Honest limit: this deters casual saving; it cannot stop screenshots or screen recording.

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 3];

export default function PdfViewer({ lessonId, token, startPage = 1, onPage }) {
  const box = useRef(null);
  const scroller = useRef(null);
  const canvas = useRef(null);
  const docRef = useRef(null);
  const task = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [page, setPage] = useState(Math.max(1, startPage));
  const [count, setCount] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [pageText, setPageText] = useState(String(Math.max(1, startPage)));
  const [rendering, setRendering] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [searching, setSearching] = useState(false);
  const cb = useRef(onPage);
  cb.current = onPage;
  const searchRun = useRef(0);

  // Load the document once per lesson.
  useEffect(() => {
    let dead = false;
    setStatus("loading"); setError("");
    (async () => {
      try {
        const mod = await import("pdfjs-dist");
        const pdfjs = mod.getDocument ? mod : mod.default;
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const bytes = await fetchPdfBytes(lessonId, token);
        if (dead) return;
        const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
        if (dead) { doc.destroy(); return; }
        docRef.current = doc;
        setCount(doc.numPages);
        setPage((p) => Math.min(Math.max(1, p), doc.numPages));
        setStatus("ready");
      } catch (e) {
        if (!dead) { setStatus("error"); setError(e && e.message ? e.message : "The document could not be opened."); }
      }
    })();
    return () => {
      dead = true;
      try { if (task.current) task.current.cancel(); } catch { /* ignore */ }
      if (docRef.current) { docRef.current.destroy(); docRef.current = null; }
    };
  }, [lessonId, token]);

  // Draw the current page (fit to width, then zoomed).
  useEffect(() => {
    const doc = docRef.current;
    if (status !== "ready" || !doc) return undefined;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const p = await doc.getPage(page);
        if (cancelled || !canvas.current || !scroller.current) return;
        const base = p.getViewport({ scale: 1 });
        const avail = Math.max(240, scroller.current.clientWidth - 4);
        const vp = p.getViewport({ scale: (avail / base.width) * ZOOMS[zoomIdx] });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const c = canvas.current;
        c.width = Math.floor(vp.width * dpr);
        c.height = Math.floor(vp.height * dpr);
        c.style.width = `${Math.floor(vp.width)}px`;
        c.style.height = `${Math.floor(vp.height)}px`;
        if (task.current) { try { task.current.cancel(); } catch { /* ignore */ } }
        const t = p.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
        task.current = t;
        await t.promise;
      } catch (e) {
        if (!(e && e.name === "RenderingCancelledException") && !cancelled) { setStatus("error"); setError("This page could not be drawn."); }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, page, zoomIdx]);

  // Report the page so reading position and completion are saved.
  useEffect(() => { if (status === "ready" && count > 0 && cb.current) cb.current(page, count); }, [status, page, count]);
  useEffect(() => { setPageText(String(page)); }, [page]);

  const go = useCallback((n) => setPage((p) => Math.min(count || 1, Math.max(1, Number.isFinite(n) ? n : p))), [count]);

  const onKey = (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(page + 1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(page - 1); }
  };

  const fullscreen = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  // Search: reads each page's text (works for text PDFs; scanned documents have none).
  const search = async (e) => {
    e.preventDefault();
    const term = q.trim().toLowerCase();
    const doc = docRef.current;
    if (term.length < 2 || !doc) return;
    const run = ++searchRun.current;
    setSearching(true); setHits(null);
    const found = [];
    let anyText = false;
    for (let n = 1; n <= doc.numPages && found.length < 30; n++) {
      if (run !== searchRun.current) return;
      try {
        const p = await doc.getPage(n);
        const tc = await p.getTextContent();
        const text = tc.items.map((i) => i.str).join(" ").replace(/\s+/g, " ");
        if (text.trim()) anyText = true;
        const at = text.toLowerCase().indexOf(term);
        if (at >= 0) found.push({ page: n, snippet: text.slice(Math.max(0, at - 30), at + 60).trim() });
      } catch { /* skip an unreadable page */ }
    }
    if (run !== searchRun.current) return;
    setHits({ found, anyText });
    setSearching(false);
  };

  if (status === "error") return <p className="alert alert-error" role="alert">{error}</p>;

  return (
    <div className="lib-pdf" ref={box} onKeyDown={onKey}>
      <div className="lib-pdf-bar" role="toolbar" aria-label="Document controls">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(page - 1)} disabled={status !== "ready" || page <= 1} aria-label="Previous page">←</button>
        <form onSubmit={(e) => { e.preventDefault(); go(parseInt(pageText, 10)); }} className="lib-pdf-page">
          <label className="sr-only" htmlFor="pdf-page">Page number</label>
          <input id="pdf-page" inputMode="numeric" value={pageText} onChange={(e) => setPageText(e.target.value.replace(/\D/g, "").slice(0, 4))} onBlur={() => go(parseInt(pageText, 10))} disabled={status !== "ready"} />
          <span aria-hidden="true">/ {count || "…"}</span>
        </form>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(page + 1)} disabled={status !== "ready" || page >= count} aria-label="Next page">→</button>
        <span className="lib-pdf-gap" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} aria-label="Zoom out">−</button>
        <span className="lib-pdf-zoom" aria-live="polite">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fullscreen} aria-label="Toggle full screen">Full screen</button>
      </div>

      <form className="lib-pdf-search" onSubmit={search} role="search">
        <label className="sr-only" htmlFor="pdf-q">Search in this document</label>
        <input id="pdf-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in this document" maxLength={60} disabled={status !== "ready"} />
        <button className="btn btn-secondary btn-sm" type="submit" disabled={status !== "ready" || searching || q.trim().length < 2}>{searching ? "Searching..." : "Search"}</button>
      </form>
      {hits && (
        <div className="lib-panel" style={{ marginBottom: 10 }} role="status">
          {hits.found.length === 0
            ? <p style={{ margin: 0 }}>{hits.anyText ? "No match found." : "This document has no searchable text (it may be a scan)."}</p>
            : <ul className="lib-outline">{hits.found.map((h) => <li key={h.page}><button type="button" className="lib-lesson-link" style={{ width: "100%", textAlign: "left", border: 0, background: "none", font: "inherit", cursor: "pointer" }} onClick={() => { setHits(null); go(h.page); }}><strong>Page {h.page}</strong><span className="muted">… {h.snippet} …</span></button></li>)}</ul>}
        </div>
      )}

      <div className="lib-pdf-scroll" ref={scroller} tabIndex={0} aria-label={`Document page ${page}${count ? ` of ${count}` : ""}. Use the arrow keys to change page.`} onContextMenu={(e) => e.preventDefault()}>
        {status === "loading" && <p className="muted" role="status" aria-busy="true" style={{ padding: 24 }}>Opening the document...</p>}
        <canvas ref={canvas} className="lib-pdf-canvas" style={{ display: status === "ready" ? "block" : "none", opacity: rendering ? 0.6 : 1 }} aria-hidden="true" />
      </div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>Read inside iPrime only. This document cannot be downloaded.</p>
    </div>
  );
}
