import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Days until the exam. Everything shown comes from the admin-set countdown; nothing is assumed.
// A date that JAMB has not confirmed is labelled "Proposed" so students are never told a guess is official.
export default function Countdown({ countdown, plan, linkTo }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  if (!countdown) return null;
  const target = new Date(countdown.targetDate).getTime();
  const ms = target - now;
  const days = Math.max(0, Math.ceil(ms / 86400000));
  const weeks = Math.floor(days / 7);
  const dateText = new Date(countdown.targetDate).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

  return (
    <section className="lib-countdown" aria-label={`Countdown to ${countdown.label}`}>
      <div className="lib-count-num" aria-hidden="true"><strong>{days}</strong><span>{days === 1 ? "day" : "days"}</span></div>
      <div className="lib-count-text">
        <p className="lib-count-title">{ms <= 0 ? `${countdown.label} has started` : `to ${countdown.label}`}</p>
        <p className="lib-count-sub"><span className="sr-only">{days} days left. </span>{ms > 0 ? `${weeks} ${weeks === 1 ? "week" : "weeks"} · ` : ""}{dateText}</p>
        {!countdown.official && <p className="lib-count-flag">Proposed date. Not yet confirmed by JAMB.</p>}
        {countdown.note && <p className="lib-count-sub">{countdown.note}</p>}
        {plan && ms > 0 && (
          <p className="lib-count-plan">
            {plan.lessonsRemaining === 0 ? "You have finished every UTME lesson available. Keep practising past questions."
              : `${plan.lessonsRemaining} UTME lessons left. About ${plan.lessonsPerWeek} a week gets you through${plan.enoughTime ? "" : ", but time is short, so start today"}.`}
          </p>
        )}
        {linkTo && <Link className="lib-count-link" to={linkTo}>Open the UTME hub</Link>}
      </div>
    </section>
  );
}
