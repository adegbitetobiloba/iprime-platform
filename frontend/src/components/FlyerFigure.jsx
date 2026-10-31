import { useEffect, useRef, useState } from "react";
import { CAMPAIGN } from "../campaign.js";

// The approved flyer, shown whole and undistorted. Tap/click to enlarge, with a download link.
export default function FlyerFigure({ priority = false, className = "" }) {
  const f = CAMPAIGN.flyer;
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!f) return null;
  return (
    <>
      <figure className={`ws5-flyer-fig ${className}`.trim()}>
        <button type="button" className="ws5-flyer-open" onClick={() => setOpen(true)} aria-label="View the 2027 UTME flyer full size">
          <img src={f.src} alt={f.alt} width={f.width} height={f.height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
          <span className="ws5-flyer-zoom" aria-hidden="true">Tap to enlarge</span>
        </button>
        <figcaption><a href={f.src} download="Prime-Excelerate-2027-UTME-flyer.webp" className="ws5-flyer-dl">Download the flyer</a></figcaption>
      </figure>
      {open && (
        <div className="ws5-lightbox" role="dialog" aria-modal="true" aria-label="2027 UTME flyer, full size" onClick={() => setOpen(false)}>
          <button type="button" ref={closeRef} className="ws5-lightbox-close" onClick={() => setOpen(false)}>Close</button>
          <img src={f.src} alt={f.alt} />
        </div>
      )}
    </>
  );
}
