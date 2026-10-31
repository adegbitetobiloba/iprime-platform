// A small line chart of the student's last results (0 to 100%). Drawn from real data only; the caller decides
// what to show when there are fewer than two points. A text summary is provided for screen readers.
export default function Sparkline({ points, width = 320, height = 96 }) {
  const pad = 8;
  const n = points.length;
  const x = (i) => (n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1));
  const y = (p) => pad + (1 - Math.min(100, Math.max(0, p)) / 100) * (height - pad * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.percentage).toFixed(1)}`).join(" ");
  const summary = `Your last ${n} results, oldest to newest: ${points.map((p) => `${p.percentage}%`).join(", ")}.`;
  return (
    <figure className="sd-spark">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} preserveAspectRatio="none">
        <line x1={pad} x2={width - pad} y1={y(50)} y2={y(50)} className="sd-spark-guide" />
        {n > 1 && <path d={path} className="sd-spark-line" />}
        {points.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.percentage)} r={i === n - 1 ? 4.5 : 3} className={i === n - 1 ? "sd-spark-dot sd-spark-dot-last" : "sd-spark-dot"} />)}
      </svg>
      <figcaption className="sd-spark-cap"><span>Older</span><span>50% guide</span><span>Latest</span></figcaption>
    </figure>
  );
}
