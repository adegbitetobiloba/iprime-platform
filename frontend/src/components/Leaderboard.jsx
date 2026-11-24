import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import "../pages/exam-tools.css";

const mm = (s) => (s == null ? "" : `${Math.floor(s / 60)} min`);

// The top-10 scoreboard for one examination. Renders nothing at all unless the examiner switched it on.
// Pass `examId` (signed in, or a guest) or `linkToken` (anyone holding a share link).
export default function Leaderboard({ examId, linkToken }) {
  const { token } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    let off = false;
    api(linkToken ? `/share/${linkToken}/leaderboard` : `/share/exams/${examId}/leaderboard`, linkToken ? {} : { token }).then((x) => { if (!off) setD(x); }).catch(() => {});
    return () => { off = true; };
  }, [examId, linkToken, token]);
  if (!d || !d.enabled) return null;
  return (
    <section className="et lbd" aria-labelledby="lb-h">
      <div className="lbd-head"><h2 id="lb-h">Top 10 scoreboard</h2><p>{d.participants} {d.participants === 1 ? "person has" : "people have"} taken this examination · each person's first attempt counts</p></div>
      {d.entries.length === 0 ? <p className="lbd-empty">Nobody has finished this examination yet. Be the first on the board.</p> : (
        <ol className="lbd-list">{d.entries.map((e, i) => (
          <li key={i} className={`lbd-row r${e.rank}${e.you ? " is-you" : ""}`}>
            <span className="lbd-rank" aria-label={`Rank ${e.rank}`}>{e.rank}</span>
            <span className="lbd-name">{e.name}{e.you ? " (you)" : ""}{e.timeUsedSeconds != null && <small>{mm(e.timeUsedSeconds)}</small>}</span>
            <span className="lbd-score">{e.percentage}%</span>
          </li>
        ))}</ol>
      )}
      {d.you && !d.entries.some((e) => e.you) && <p className="lbd-you">Your position: <strong>{d.you.rank}</strong> of {d.you.outOf} ({d.you.percentage}%)</p>}
    </section>
  );
}
