import { useState } from "react";
import Icon from "./Icon.jsx";

// Shows an approved photograph if one is configured and loads; otherwise a designed fallback.
// `image` comes from siteImages.js. Images load lazily and keep their size, so the page never jumps.
export default function Photo({ image, fallbackIcon = "book", fallbackLabel, className = "", priority = false }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div className={`photo photo-fallback ${className}`} role="img" aria-label={fallbackLabel || "Decorative panel"}>
        <span className="icon-tile icon-tile-light"><Icon name={fallbackIcon} size={26} /></span>
      </div>
    );
  }
  return (
    <div className={`photo ${className}`}>
      <img src={image.src} alt={image.alt} width={image.width} height={image.height}
        loading={priority ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />
    </div>
  );
}
