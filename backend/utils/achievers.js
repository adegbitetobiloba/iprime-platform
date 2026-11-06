// Who may appear on the public website, and exactly which fields may leave the server.
// Kept free of database code so it can be tested on its own.

/** True only when the record is switched on, checked, consented (guardian too for minors) and has a real score. */
const isPubliclyListable = (a) =>
  Boolean(
    a &&
      a.published === true &&
      a.archived !== true &&
      a.verified === true &&
      a.consent === "granted" &&
      (a.isMinor !== true || a.guardianConsent === true) &&
      Number.isFinite(a.score) &&
      a.score > 0
  );

/** The public shape. Evidence references, consent flags and internal notes are never included. */
const toPublic = (a) => {
  const who = a.name || "Prime Excelerate scholar";
  const showPhoto = a.imageConsent === true && Boolean(a.portraitPath);
  return {
    id: String(a._id),
    name: a.name || "",
    label: a.label || "",
    examType: a.examType || "",
    year: a.year || null,
    score: a.score,
    programme: a.programme || "",
    testimonial: a.testimonialApproved === true && a.testimonial ? a.testimonial : "",
    portrait: showPhoto ? { src: a.portraitPath, alt: a.portraitAlt || `${who}, ${a.examType || "examination"}${a.year ? ` ${a.year}` : ""}, score ${a.score}` } : null,
  };
};

module.exports = { isPubliclyListable, toPublic };
