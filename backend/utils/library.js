// Pure helpers for the Library (no database, no Express) so they can be unit-tested.

const STATUSES = ["draft", "review", "published", "archived"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const CONTENT_TYPES = ["text", "video", "pdf", "link"];

// Allowed status changes. Archived content is never deleted, only restored to draft.
const TRANSITIONS = {
  draft: ["review", "published", "archived"],
  review: ["draft", "published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};
const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

function slugify(text) {
  return String(text || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

// Only these video hosts are accepted. Anything else is rejected, never embedded.
function parseVideoUrl(input) {
  let u;
  try { u = new URL(String(input).trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const idOk = (s) => /^[A-Za-z0-9_-]{11}$/.test(s || "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    let id = u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
    if (!id && m) id = m[1];
    return idOk(id) ? { provider: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return idOk(id) ? { provider: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (host === "vimeo.com") {
    const m = u.pathname.match(/^\/(\d{6,12})(?:\/|$)/);
    return m ? { provider: "vimeo", videoId: m[1], url: `https://vimeo.com/${m[1]}` } : null;
  }
  return null;
}

function isHttpsUrl(input) {
  try { return new URL(String(input).trim()).protocol === "https:"; } catch { return false; }
}

// A lesson counts as "has content" only when its own type content exists.
function lessonHasContent(l) {
  switch (l.contentType) {
    case "text": return !!(l.body && l.body.trim().length >= 1);
    case "video": return !!(l.video && l.video.videoId);
    case "pdf": return !!(l.pdf && l.pdf.storageKey);
    case "link": return !!l.externalUrl;
    default: return false;
  }
}

function publishProblems(course, lessons) {
  const problems = [];
  const usable = lessons.filter((l) => l.status !== "archived");
  if (!course.description || !course.description.trim()) problems.push("Add a course description.");
  if (!usable.length) problems.push("Add at least one lesson.");
  else if (!usable.some(lessonHasContent)) problems.push("At least one lesson needs content.");
  return problems;
}

module.exports = { STATUSES, DIFFICULTIES, CONTENT_TYPES, TRANSITIONS, canTransition, slugify, parseVideoUrl, isHttpsUrl, lessonHasContent, publishProblems };
