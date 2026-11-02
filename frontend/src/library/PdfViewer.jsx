import { useCallback, useEffect, useRef, useState } from "react";
import { BASE } from "./files.js";

// Continuous-scroll PDF reader: pages are stacked in one scrolling column (like reading a long page), only pages near the screen are drawn,
// and far-away pages are released so weak phones do not run out of memory. The file is fetched in byte ranges, so page 1 appears before the
// whole file arrives. No download or print button. Honest limit: this deters casual saving; it cannot stop screenshots or screen recording.
// `path` is the API path of the PDF, e.g. /library/lessons/ID/pdf or /library/materials/ID/pdf.

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 3];
const NEAR = 1.5;  // draw pages within this many screens of the view
const FAR = 4;     // release pages beyond this many screens

export default function PdfViewer({ path, token, startPage = 1, onPage }) {
  const box = useRef(null);
  const scroller = useRef(null);
  const docRef = useRef(null);
  const slots = useRef([]);       // DOM slot per page
  const ratios = useRef([]);      // height / width per page, learned as pages load
  const drawn = useRef(new Map()); // page -> { task }
  const zoomRef = useRef(1);
  const queue = useRef(Promise.resolve());
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Math.max(1, startPage));
  const [pageText, setPageText] = useState(String(Math.max(1, startPage)));
  const [zoomIdx, setZoomIdx] = useState(1);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchRun = useRef(0);
  const cb = useRef(onPage);
  cb.current = onPage;
  zoomRef.current = ZOOMS[zoomIdx];

  const width = () => Math.max(240, (scroller.current ? scroller.current.clientWidth : 320) - 8) * zoomRef.current;
  const sizeSlot = (n) => { const el = slots.current[n - 1]; if (el) { el.style.width = `${Math.floor(width())}px`; el.style.height = `${Math.floor(width() * (ratios.current[n - 1] || 1.414))}px`; } };

  // Load the document (range requests; the worker sends the sign-in token with every request).
  useEffect(() => {
    let dead = false;
    setStatus("loading"); setError("");
    (async () => {
      try {
        const mod = await import("pdfjs-dist");
        const pdfjs = mod.getDocument ? mod : mod.default;
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
        const doc = await pdfjs.getDocument({ url: `${BASE}${path}`, httpHeaders: { Authorization: `Bearer ${token}` }, rangeChunkSize: 131072, disableAutoFetch: true, isEvalSupported: false }).promise;
        if (dead) { doc.destroy(); return; }
        docRef.current = doc;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        ratios.current = new Array(doc.numPages).fill(vp.height / vp.width);
        slots.current = new Array(doc.numPages).fill(null);
        setCount(doc.numPages);
        setStatus("ready");
      } catch (e) {
        if (!dead) { setStatus("error"); setError(e && e.status === 404 ? "No document is attached yet." : "The document could not be opened. Check your connection and try again."); }
      }
    })();
    return () => {
      dead = true;
      drawn.current.forEach((d) => { try { d.task.cancel(); } catch { /* ignore */ } });
      drawn.current.clear();
      if (docRef.current) { docRef.current.destroy(); docRef.current = null; }
    };
  }, [path, token]);

  const drawPage = useCallback((n) => {
    const doc = docRef.current;
    const slot = slots.current[n - 1];
    if (!doc || !slot || drawn.current.has(n)) return;
    const rec = { task: { cancel() {} } };
    drawn.current.set(n, rec);
    queue.current = queue.current.then(async () => {
      if (docRef.current !== doc || drawn.current.get(n) !== rec) return;
      try {
        const p = await doc.getPage(n);
        const base = p.getViewport({ scale: 1 });
        ratios.current[n - 1] = base.height / base.width;
        const vp = p.getViewport({ scale: width() / base.width });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
        c.style.cssText = `width:${Math.floor(vp.width)}px;height:${Math.floor(vp.height)}px;display:block`;
        c.setAttribute("aria-hidden", "true");
        const t = p.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
        rec.task = t;
        await t.promise;
        if (drawn.current.get(n) !== rec) return;
        sizeSlot(n);
        slot.replaceChildren(c);
      } catch (e) {
        if (!(e && e.name === "RenderingCancelledException")) drawn.current.delete(n);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const release = (n) => {
    const rec = drawn.current.get(n);
    if (!rec) return;
    try { rec.task.cancel(); } catch { /* ignore */ }
    drawn.current.delete(n);
    const slot = slots.current[n - 1];
    if (slot) slot.replaceChildren();
  };

  // On scroll (once per frame): find the page in view, draw nearby pages, release far ones, report the page.
  const lastSent = useRef(0);
  const update = useCallback(() => {
    const sc = scroller.current;
    if (!sc || !slots.current.length) return;
    const top = sc.scrollTop, h = sc.clientHeight, mid = top + h / 2;
    let lo = 0, hi = slots.current.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (slots.current[m].offsetTop <= mid) lo = m; else hi = m - 1; }
    const cur = lo + 1;
    setPage((p) => (p === cur ? p : cur));
    for (let n = 1; n <= slots.current.length; n++) {
      const el = slots.current[n - 1];
      const y = el.offsetTop;
      const dist = y + el.offsetHeight < top ? top - (y + el.offsetHeight) : y > top + h ? y - (top + h) : 0;
      if (dist <= h * NEAR) drawPage(n);
      else if (dist > h * FAR) release(n);
    }
  }, [drawPage]);

  const raf = useRef(0);
  const onScroll = () => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; update(); }); };

  // After the slots exist: size them, jump to the saved page, draw the first screen.
  useEffect(() => {
    if (status !== "ready") return;
    for (let n = 1; n <= count; n++) sizeSlot(n);
    const start = Math.min(Math.max(1, startPage), count);
    const el = slots.current[start - 1];
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 4;
    update();
  }, [status, count]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom: resize every slot, redraw what is near.
  useEffect(() => {
    if (status !== "ready") return;
    const keep = page;
    [...drawn.current.keys()].forEach(release);
    for (let n = 1; n <= count; n++) sizeSlot(n);
    const el = slots.current[keep - 1];
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 4;
    update();
  }, [zoomIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === "ready") window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("resize", onScroll); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report the reading position at most once a second.
  useEffect(() => {
    setPageText(String(page));
    if (status !== "ready" || !count || !cb.current) return undefined;
    const wait = Math.max(0, 1000 - (Date.now() - lastSent.current));
    const t = setTimeout(() => { lastSent.current = Date.now(); cb.current(page, count); }, wait);
    return () => clearTimeout(t);
  }, [page, count, status]);

  const jump = (n) => {
    const target = Math.min(count, Math.max(1, Number.isFinite(n) ? n : page));
    const el = slots.current[target - 1];
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 4 });
  };
  const fullscreen = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

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
        const tc = await (await doc.getPage(n)).getTextContent();
        const text = tc.items.map((i) => i.str).join(" ").replace(/\s+/g, " ");
        if (text.trim()) anyText = true;
        const at = text.toLowerCase().indexOf(term);
        if (at >= 0) found.push({ page: n, snippet: text.slice(Math.max(0, at - 30), at + 60).trim() });
      } catch { /* skip unreadable page */ }
    }
    if (run !== searchRun.current) return;
    setHits({ found, anyText });
    setSearching(false);
  };

  if (status === "error") return <p className="alert alert-error" role="alert">{error}</p>;
  const ready = status === "ready";

  return (
    <div className="lib-pdf" ref={box}>
      <div className="lib-pdf-bar" role="toolbar" aria-label="Document controls">
        <form onSubmit={(e) => { e.preventDefault(); jump(parseInt(pageText, 10)); }} className="lib-pdf-page">
          <label className="sr-only" htmlFor="pdf-page">Go to page</label>
          <input id="pdf-page" inputMode="numeric" value={pageText} onChange={(e) => setPageText(e.target.value.replace(/\D/g, "").slice(0, 4))} onBlur={() => jump(parseInt(pageText, 10))} disabled={!ready} />
          <span aria-hidden="true">/ {count || "…"}</span>
        </form>
        <span className="lib-pdf-gap" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} aria-label="Zoom out">−</button>
        <span className="lib-pdf-zoom" aria-live="polite">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fullscreen} aria-label="Toggle full screen">Full screen</button>
      </div>

      <form className="lib-pdf-search" onSubmit={search} role="search">
        <label className="sr-only" htmlFor="pdf-q">Search in this document</label>
        <input id="pdf-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in this document" maxLength={60} disabled={!ready} />
        <button className="btn btn-secondary btn-sm" type="submit" disabled={!ready || searching || q.trim().length < 2}>{searching ? "Searching..." : "Search"}</button>
      </form>
      {hits && (
        <div className="lib-panel" style={{ marginBottom: 10 }} role="status">
          {hits.found.length === 0
            ? <p style={{ margin: 0 }}>{hits.anyText ? "No match found." : "This document has no searchable text (it may be a scan)."}</p>
            : <ul className="lib-outline">{hits.found.map((h) => <li key={h.page}><button type="button" className="lib-lesson-link" style={{ width: "100%", textAlign: "left", border: 0, background: "none", font: "inherit", cursor: "pointer" }} onClick={() => { setHits(null); jump(h.page); }}><strong>Page {h.page}</strong><span className="muted">… {h.snippet} …</span></button></li>)}</ul>}
        </div>
      )}

      <div className="lib-pdf-scroll" ref={scroller} onScroll={onScroll} onContextMenu={(e) => e.preventDefault()} tabIndex={0} aria-label={`Document, page ${page}${count ? ` of ${count}` : ""}. Scroll to read.`}>
        {!ready && <p className="muted" role="status" aria-busy="true" style={{ padding: 24 }}>Opening the document...</p>}
        {ready && Array.from({ length: count }, (_, i) => (
          <div key={i} className="lib-pdf-slot" data-page={i + 1} ref={(el) => { slots.current[i] = el; }} />
        ))}
      </div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>Read inside iPrime only. This document cannot be downloaded.</p>
    </div>
  );
}
