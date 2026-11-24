import "../pages/exam-tools.css";

// "How many questions does each student get FROM EACH SUBJECT?" (a JAMB-style paper: English 60, the others 40...).
export default function SectionQuotas({ rows, values, onChange }) {
  const num = (s) => { const n = Math.floor(Number(s)); return Number.isFinite(n) && n > 0 ? n : 0; };
  const effective = rows.map((r) => ({ ...r, give: Math.min(num(values[r.subject]), r.available) }));
  const total = effective.reduce((t, r) => t + r.give, 0);
  return (
    <div className="et">
      <div className="sq" role="group" aria-label="Questions each student gets, by subject">
        {rows.map((r) => (
          <div className="sq-row" key={r.subject}>
            <div className="sq-name">{r.subject}<small>{r.available} question{r.available === 1 ? "" : "s"} in the pool</small></div>
            <input type="number" min="0" inputMode="numeric" aria-label={`Questions from ${r.subject} for each student`} value={values[r.subject] ?? ""} onChange={(e) => onChange({ ...values, [r.subject]: e.target.value })} />
            {num(values[r.subject]) > r.available && <p className="sq-warn" role="status">Only {r.available} {r.subject} question{r.available === 1 ? " is" : "s are"} in the pool, so each student will get all {r.available}.</p>}
          </div>
        ))}
      </div>
      <p className="sq-total"><span>Each student gets</span><span>{total} question{total === 1 ? "" : "s"}{effective.filter((r) => r.give).length > 1 ? ` (${effective.filter((r) => r.give).map((r) => `${r.subject} ${r.give}`).join(", ")})` : ""}</span></p>
    </div>
  );
}
