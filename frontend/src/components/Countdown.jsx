import { CAMPAIGN, daysUntil, countdownText } from "../campaign.js";

// Real countdown to the start date printed on the flyer (CAMPAIGN.startsOn). No invented figures.
export default function Countdown({ className = "" }) {
  const days = daysUntil(CAMPAIGN.startsOn);
  return (
    <p className={`ws5-count ${className}`.trim()}>
      <span className="ws5-count-dot" aria-hidden="true" />
      <strong>{countdownText(days)}</strong>
      <span> · {CAMPAIGN.startsLabel}</span>
    </p>
  );
}
