// Rules for bulk actions on study materials. Pure, so every rule can be tested without a database.
const { canTransition } = require("./library");

const ACTIONS = ["publish", "unpublish", "archive", "restore", "delete", "set-subject", "add-tag", "remove-tag", "clear-reports"];

// Is there anything to show students? `hasBody` is passed in because the list never loads the long text itself.
function readiness(m) {
  if (m.source === "link") return m.url ? null : "Add the web link first.";
  if (m.source === "pdf") return m.file ? null : "Upload the PDF first.";
  if (m.source === "text") return m.hasBody ? null : "Write or paste the text first.";
  if (m.source === "image") return (m.images || []).length ? null : "Upload at least one image first.";
  return "Unknown material type.";
}

// Returns { ok: [ids], skipped: [{ id, title, reason }] }. Nothing is changed here.
function planBulk(action, materials) {
  const ok = [];
  const skipped = [];
  for (const m of materials) {
    let reason = null;
    if (action === "publish") {
      if (m.status === "published") reason = "Already published.";
      else if (!canTransition(m.status, "published")) reason = m.status === "archived" ? "Archived: restore it first." : "Cannot be published from here.";
      else reason = readiness(m);
    } else if (action === "unpublish") {
      if (m.status !== "published") reason = "Not published.";
    } else if (action === "archive") {
      if (m.status === "archived") reason = "Already archived.";
      else if (!canTransition(m.status, "archived")) reason = "Cannot be archived from here.";
    } else if (action === "restore") {
      if (m.status !== "archived") reason = "Not archived.";
    } else if (action === "delete") {
      if (m.status !== "draft") reason = "Only drafts can be deleted. Unpublish or archive it first.";
    }
    if (reason) skipped.push({ id: String(m._id), title: m.title, reason });
    else ok.push(String(m._id));
  }
  return { ok, skipped };
}

// The query for the admin list. Only known filters are used; anything else is ignored.
function listFilter(q) {
  const f = {};
  if (["draft", "review", "published", "archived"].includes(q.status)) f.status = q.status;
  if (q.kind) f.kind = String(q.kind);
  if (["link", "pdf", "text", "image"].includes(q.source)) f.source = q.source;
  if (/^[0-9a-f]{24}$/i.test(String(q.subject || ""))) f.subject = q.subject;
  if (q.imported === "1") f.importedFrom = { $exists: true, $ne: null };
  if (q.reported === "1") f.brokenReports = { $gt: 0 };
  const term = String(q.q || "").trim().slice(0, 60);
  if (term.length >= 2) f.title = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return f;
}

module.exports = { ACTIONS, readiness, planBulk, listFilter };
