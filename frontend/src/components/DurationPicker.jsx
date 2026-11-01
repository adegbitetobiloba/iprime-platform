import { useEffect, useState } from "react";
import { PRESETS, MAX_MINUTES, split, join, label, problem } from "../lib/exam/duration.js";

// Examination length: quick presets, or any custom hours and minutes. `value` is whole minutes (or "" when empty).
export default function DurationPicker({ id = "duration", value, onChange }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  // Keep the boxes in step when the value changes from outside (a preset, or loading a saved exam).
  useEffect(() => {
    if (value === "" || value === null || value === undefined) return;
    if (join(h, m) !== Number(value)) { const s = split(value); setH(String(s.hours)); setM(String(s.minutes)); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const typed = (nextH, nextM) => {
    setH(nextH); setM(nextM);
    onChange(nextH === "" && nextM === "" ? "" : join(nextH, nextM));
  };
  const total = value === "" || value === null || value === undefined ? "" : Number(value);
  const err = total === "" ? null : problem(total);

  return (
    <fieldset className="xb-duration">
      <legend>Duration</legend>
      <div className="xb-chips" role="group" aria-label="Common durations">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={`xb-chip${total === p ? " is-on" : ""}`} aria-pressed={total === p} onClick={() => { const s = split(p); setH(String(s.hours)); setM(String(s.minutes)); onChange(p); }}>
            {label(p)}
          </button>
        ))}
      </div>
      <div className="xb-custom">
        <label htmlFor={`${id}-h`}>Hours
          <input id={`${id}-h`} type="number" inputMode="numeric" min="0" max={Math.floor(MAX_MINUTES / 60)} value={h} onChange={(e) => typed(e.target.value, m)} />
        </label>
        <label htmlFor={`${id}-m`}>Minutes
          <input id={`${id}-m`} type="number" inputMode="numeric" min="0" max="59" value={m} onChange={(e) => typed(h, e.target.value)} />
        </label>
        <p className="xb-total" role="status" aria-live="polite">{total === "" ? "Not set" : err ? "" : <>Total: <strong>{label(total)}</strong>{total >= 60 ? ` (${total} minutes)` : ""}</>}</p>
      </div>
      {err && <p className="alert alert-error" role="alert">{err}</p>}
    </fieldset>
  );
}
