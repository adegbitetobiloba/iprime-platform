import { isPublishable } from "../achievements.js";

// One card per approved achievement. Renders nothing unless the record passes isPublishable(), and only ever
// shows the whitelisted fields below (never evidence references, candidate numbers or contact details).
export default function AchievementCard({ item }) {
  if (!isPublishable(item)) return null;
  const initials = item.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const p = item.portrait;
  const showPhoto = Boolean(p && p.src && p.alt && item.imageConsent === true);
  return (
    <article className="ws5-ach" aria-label={`${item.name}, ${item.examType} ${item.year}, score ${item.score}`}>
      <div className="ws5-ach-media">
        {showPhoto
          ? <img src={p.src} alt={p.alt} width={p.width} height={p.height} loading="lazy" decoding="async" />
          : <span className="ws5-ach-mono" aria-hidden="true">{initials}</span>}
      </div>
      <div className="ws5-ach-body">
        <p className="ws5-ach-exam">{item.examType} · {item.year}</p>
        <h3>{item.name}</h3>
        <p className="ws5-ach-score"><span>{item.score}</span> <small>score</small></p>
        {item.programme && <p className="ws5-ach-meta">{item.programme}</p>}
        {item.testimonial && item.testimonialApproved === true && <blockquote className="ws5-ach-quote">{item.testimonial}</blockquote>}
      </div>
    </article>
  );
}
