import { useEffect, useRef, useState } from "react";
import { fetchImageUrl } from "./files.js";

// Reads a material made of images (a photographed syllabus, scanned notes). Images load as you scroll, with the student's sign-in token,
// so there is no public link. Zoom buttons widen the images; pinch-zoom also works. Honest limit: screenshots cannot be blocked.
const ZOOMS = [1, 1.5, 2, 3];

export default function ImageViewer({ materialId, images, token, startPercent = 0, onPercent }) {
  const box = useRef(null);
  const slots = useRef([]);
  const urls = useRef({});
  const asked = useRef(new Set());
  const [src, setSrc] = useState({});
  const [bad, setBad] = useState({});
  const [zoomIdx, setZoomIdx] = useState(0);
  const cb = useRef(onPercent);
  cb.current = onPercent;

  const load = (i) => {
    if (asked.current.has(i)) return;
    asked.current.add(i);
    fetchImageUrl(`/library/materials/${materialId}/images/${images[i].id}`, token)
      .then((u) => { urls.current[i] = u; setSrc((s) => ({ ...s, [i]: u })); })
      .catch(() => { asked.current.delete(i); setBad((b) => ({ ...b, [i]: true })); });
  };

  useEffect(() => {
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) load(Number(e.target.dataset.i)); }), { rootMargin: "800px 0px" }) : null;
    slots.current.forEach((el, i) => { if (!el) return; if (io) io.observe(el); else load(i); });
    return () => { if (io) io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, images.length, token]);

  useEffect(() => () => { Object.values(urls.current).forEach((u) => URL.revokeObjectURL(u)); urls.current = {}; asked.current = new Set(); }, [materialId]);

  // Report how far the student has read (the last image whose top has come into view).
  useEffect(() => {
    let last = 0, t = 0;
    const tick = () => {
      t = 0;
      let idx = 0;
      slots.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top < window.innerHeight * 0.7) idx = i; });
      const pct = Math.round(((idx + 1) / images.length) * 100);
      if (pct > last && cb.current) { last = pct; cb.current(pct); }
    };
    const onScroll = () => { if (!t) t = setTimeout(tick, 1500); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, [images.length]);

  // Continue where the student stopped.
  useEffect(() => {
    if (startPercent > 5 && startPercent < 95) { const i = Math.max(0, Math.round((startPercent / 100) * images.length) - 1); const el = slots.current[i]; if (el) el.scrollIntoView({ block: "start" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fullscreen = () => { const el = box.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); };

  return (
    <div className="lib-imgs" ref={box}>
      <div className="lib-pdf-bar" role="toolbar" aria-label="Image controls">
        <span className="muted">{images.length} {images.length === 1 ? "image" : "images"}</span>
        <span className="lib-pdf-gap" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} aria-label="Zoom out">−</button>
        <span className="lib-pdf-zoom" aria-live="polite">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fullscreen}>Full screen</button>
      </div>
      <div className="lib-imgs-scroll" onContextMenu={(e) => e.preventDefault()}>
        {images.map((im, i) => (
          <div key={im.id} className="lib-img-slot" data-i={i} ref={(el) => { slots.current[i] = el; }} style={{ width: `${ZOOMS[zoomIdx] * 100}%` }}>
            {src[i] ? <img src={src[i]} alt={`${im.name || "Page"} (${i + 1} of ${images.length})`} draggable={false} />
              : bad[i] ? <button type="button" className="btn btn-secondary" onClick={() => { setBad((b) => ({ ...b, [i]: false })); load(i); }}>Image {i + 1} did not load. Tap to retry.</button>
              : <div className="lib-img-wait" aria-busy="true">Loading image {i + 1}...</div>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>Read inside iPrime only.</p>
    </div>
  );
}
