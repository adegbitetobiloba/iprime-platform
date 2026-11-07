// Owner: Account 1 (placeholder for Account 2). Pure helpers, unit tested.
/** 3725000 -> "1:02:05"; 65000 -> "01:05"; never negative. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Spoken form: "1 hour 2 minutes 5 seconds". */
export function spokenRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const part = (n: number, w: string) => (n === 0 ? '' : `${n} ${w}${n === 1 ? '' : 's'}`);
  return [part(h, 'hour'), part(m, 'minute'), part(s, 'second')].filter(Boolean).join(' ') || '0 seconds';
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];
