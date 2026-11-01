// Examination length, in whole minutes (what the server stores and enforces). The server accepts 1 to 360.
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 360;
export const PRESETS = [15, 30, 45, 60, 90, 120, 150, 180, 240];

export const split = (total) => { const n = Math.max(0, Math.floor(Number(total) || 0)); return { hours: Math.floor(n / 60), minutes: n % 60 }; };
export const join = (hours, minutes) => (Math.floor(Number(hours) || 0) * 60) + Math.floor(Number(minutes) || 0);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
export function label(total) {
  const { hours, minutes } = split(total);
  if (!hours && !minutes) return "";
  if (!minutes) return plural(hours, "hour");
  if (!hours) return plural(minutes, "minute");
  return `${plural(hours, "hour")} ${plural(minutes, "minute")}`;
}

// Returns a plain-language problem, or null when the value is usable.
export function problem(total) {
  if (total === "" || total === null || total === undefined || !Number.isFinite(Number(total))) return "Choose how long the examination lasts.";
  const n = Number(total);
  if (!Number.isInteger(n)) return "The duration must be a whole number of minutes.";
  if (n < MIN_MINUTES) return "The examination must last at least 1 minute.";
  if (n > MAX_MINUTES) return "The examination can last at most 6 hours.";
  return null;
}
