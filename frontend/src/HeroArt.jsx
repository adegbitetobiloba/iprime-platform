import Icon from "./Icon.jsx";

// Decorative illustrations built from inline SVG/CSS (a few KB, no image downloads).
// They mirror the real examination screen (timer, question, options, question palette) and show no
// real data, scores or people. They are hidden from screen readers.

export function HeroArt() {
  const palette = [
    "a", "a", "a", "n", "a",
    "a", "f", "n", "n", "n",
    "c", "n", "n", "n", "n",
    "n", "n", "n", "n", "n",
  ];
  return (
    <div className="rd-art" aria-hidden="true">
      <svg viewBox="0 0 520 360" role="presentation" focusable="false">
        <defs>
          <clipPath id="rd-screen"><rect x="44" y="34" width="432" height="262" rx="10" /></clipPath>
        </defs>
        <ellipse cx="260" cy="330" rx="210" ry="16" fill="rgba(0,0,0,0.22)" />
        <rect x="30" y="20" width="460" height="290" rx="18" fill="#0a2d66" stroke="#2a5aa8" strokeWidth="2" />
        <rect x="44" y="34" width="432" height="262" rx="10" fill="#f3f6fb" />
        <g clipPath="url(#rd-screen)">
          <rect x="44" y="34" width="432" height="36" fill="#04204f" />
          <rect x="60" y="48" width="96" height="8" rx="4" fill="#8fa6cf" />
          <rect x="396" y="43" width="64" height="18" rx="9" fill="#cc9a20" />
          <rect x="408" y="50" width="40" height="4" rx="2" fill="#04204f" />
        </g>
        <rect x="60" y="84" width="270" height="198" rx="10" fill="#fff" stroke="#dde3ee" />
        <rect x="76" y="100" width="210" height="9" rx="4.5" fill="#04204f" />
        <rect x="76" y="116" width="150" height="9" rx="4.5" fill="#04204f" opacity="0.55" />
        {[0, 1, 2, 3].map((i) => {
          const y = 140 + i * 34;
          const selected = i === 1;
          return (
            <g key={i}>
              <rect x="76" y={y} width="238" height="28" rx="8" fill={selected ? "#e9f0fb" : "#fff"} stroke={selected ? "#0553b3" : "#8a96ad"} strokeWidth={selected ? 2 : 1.2} />
              <circle cx="94" cy={y + 14} r="9" fill={selected ? "#04204f" : "#fff"} stroke="#04204f" strokeWidth="1.2" />
              <text x="94" y={y + 18} textAnchor="middle" fontSize="11" fontWeight="800" fill={selected ? "#fff" : "#04204f"} fontFamily="inherit">{"ABCD"[i]}</text>
              <rect x="112" y={y + 10} width={120 - i * 14} height="7" rx="3.5" fill="#55617a" opacity="0.45" />
            </g>
          );
        })}
        <rect x="344" y="84" width="118" height="198" rx="10" fill="#fff" stroke="#dde3ee" />
        <rect x="358" y="98" width="62" height="8" rx="4" fill="#04204f" />
        {palette.map((s, i) => {
          const x = 358 + (i % 5) * 20;
          const y = 120 + Math.floor(i / 5) * 24;
          const answered = s === "a";
          return (
            <g key={i}>
              <rect x={x} y={y} width="16" height="18" rx="4" fill={answered ? "#04204f" : "#fff"} stroke={s === "c" ? "#0553b3" : answered ? "#04204f" : "#8a96ad"} strokeWidth={s === "c" ? 2.2 : 1.2} />
              {s === "f" && <circle cx={x + 14} cy={y + 2} r="4" fill="#cc9a20" stroke="#04204f" strokeWidth="1" />}
            </g>
          );
        })}
        <rect x="358" y="244" width="90" height="26" rx="8" fill="#0553b3" />
        <rect x="374" y="255" width="58" height="5" rx="2.5" fill="#fff" opacity="0.9" />
        <path d="M222 310h76l8 26H214l8-26Z" fill="#0a2d66" />
        <rect x="170" y="334" width="180" height="10" rx="5" fill="#2a5aa8" />
      </svg>
      <span className="rd-chip rd-chip-1"><Icon name="check" size={16} /> Answers saved as you go</span>
      <span className="rd-chip rd-chip-2"><Icon name="clock" size={16} /> Timer keeps running</span>
    </div>
  );
}

// Mirrors the real question palette: answered, flagged for review, not answered.
export function PaletteArt() {
  const cells = [
    "a", "a", "a", "a", "f",
    "a", "a", "c", "n", "n",
    "n", "f", "n", "n", "n",
    "n", "n", "n", "n", "n",
  ];
  return (
    <div className="rd-palette-art" aria-hidden="true">
      <div className="rd-pa-head"><span className="rd-pa-bar" /><span className="rd-pa-timer"><Icon name="clock" size={14} /></span></div>
      <div className="rd-pa-body">
        <div className="rd-pa-q">
          <span className="rd-pa-line rd-pa-line-1" />
          <span className="rd-pa-line rd-pa-line-2" />
          <span className="rd-pa-opt" /><span className="rd-pa-opt rd-pa-opt-on" /><span className="rd-pa-opt" />
        </div>
        <div className="rd-pa-grid">
          {cells.map((c, i) => <span key={i} className={`rd-pa-cell rd-pa-${c}`}>{i + 1}</span>)}
        </div>
      </div>
      <ul className="rd-pa-key">
        <li><span className="rd-pa-cell rd-pa-a" /> Answered</li>
        <li><span className="rd-pa-cell rd-pa-f" /> Flagged for review</li>
        <li><span className="rd-pa-cell rd-pa-n" /> Not answered</li>
      </ul>
    </div>
  );
}
