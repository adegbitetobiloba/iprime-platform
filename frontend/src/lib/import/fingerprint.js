// Science-safe duplicate fingerprint.
// NFKC folds sub/superscripts (H₂SO₄ -> H2SO4, Fe³⁺ -> Fe3+) without losing the characters.
// Only whitespace and ordinary punctuation are dropped; letters (incl. IPA), digits, + - = / < > ^ are kept.
// Case is KEPT: Co/CO and Na/NA are different things in chemistry, and in stress/emphasis banks the options
// differ only by capitals (PRE-si-den-cy vs pre-SI-den-cy). Trade-off: wording that differs only in
// capitalisation is not caught as a duplicate, which is the safer error (duplicates are only flagged, never removed).
export function normaliseForFingerprint(text) {
  const t = String(text ?? "").normalize("NFKC");
  const cleaned = t
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}+\-=/<>^\s]/gu, " ");
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

// Duplicate = same normalised stem AND same option set (order-insensitive). Same stem, different options is NOT a duplicate.
export function questionFingerprint(stem, optionTexts) {
  const s = normaliseForFingerprint(stem);
  const o = optionTexts.map(normaliseForFingerprint).sort().join("\u241F");
  return s + "\u241E" + o;
}
