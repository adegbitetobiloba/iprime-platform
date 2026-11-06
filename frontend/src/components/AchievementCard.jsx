// One card per achievement. Draws only whitelisted fields (never evidence references, candidate numbers or contact details).
// A name is optional: without one the card says "Prime Excelerate scholar". The photo shows only with image consent.
export default function AchievementCard({ item }) {
  const who = item.name || "Prime Excelerate scholar";
  const p = item.portrait;
  const showPhoto = Boolean(p && p.src && item.imageConsent === true);
  const initials = (item.name || "PE").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const exam = [item.examType, item.year].filter(Boolean).join(" \u00b7 ");
  return (
    <article className="ws5-ach" aria-label={`${who}, ${exam}, score ${item.score}`}>
      <div className="ws5-ach-media">
        {showPhoto
          ? <img src={p.src} alt={p.alt || `${who}, score ${item.score}`} width={p.width || 480} height={p.height || 600} loading="lazy" decoding="async" />
          : <span className="ws5-ach-mono" aria-hidden="true">{initials}</span>}
      </div>
      <div className="ws5-ach-body">
        {exam && <p className="ws5-ach-exam">{exam}</p>}
        <h3>{who}</h3>
        <p className="ws5-ach-score"><span>{item.score}</span> <small>{item.label || "score"}</small></p>
        {item.programme && <p className="ws5-ach-meta">{item.programme}</p>}
        {item.testimonial && item.testimonialApproved === true && <blockquote className="ws5-ach-quote">{item.testimonial}</blockquote>}
      </div>
    </article>
  );
}
