const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLibrarySection, LIMIT } = require("../utils/dashboardLibrary");

const row = (id, type, extra = {}, lesson = {}) => ({ lesson: { _id: id, title: `Lesson ${id}`, contentType: type, status: "published", course: "c1", ...lesson }, lastOpenedAt: new Date(2026, 10, 1, 10, Number(id.replace(/\D/g, "")) || 0), ...extra });

test("no activity: available, empty, zero totals", () => {
  const r = buildLibrarySection({});
  assert.equal(r.available, true); assert.deepEqual(r.recent, []); assert.deepEqual(r.summary, { lessonsCompleted: 0, lessonsOpened: 0, studyMinutes: 0 });
});

test("newest first, capped", () => {
  const rows = Array.from({ length: 9 }, (_, i) => row(`l${i + 1}`, "written"));
  const r = buildLibrarySection({ progress: rows });
  assert.equal(r.recent.length, LIMIT); assert.equal(r.recent[0].id, "l9");
});

test("unpublished or missing lessons are hidden", () => {
  const r = buildLibrarySection({ progress: [row("l1", "written", {}, { status: "draft" }), { lesson: null }, row("l2", "written")] });
  assert.deepEqual(r.recent.map((x) => x.id), ["l2"]);
});

test("pdf shows the last-read page only when a page count is recorded", () => {
  const a = buildLibrarySection({ progress: [row("l1", "pdf", { pageCount: 40, lastPage: 12 })] }).recent[0];
  assert.equal(a.lastPage, 12); assert.equal(a.pageCount, 40);
  const b = buildLibrarySection({ progress: [row("l2", "pdf", { pageCount: 0, lastPage: 1 })] }).recent[0];
  assert.equal(b.lastPage, null); assert.equal(b.pageCount, null);
  const c = buildLibrarySection({ progress: [row("l3", "pdf", { pageCount: 10, lastPage: 99 })] }).recent[0];
  assert.equal(c.lastPage, 10); // never beyond the last page
});

test("video resume time only when saved; other types carry no page or position", () => {
  assert.equal(buildLibrarySection({ progress: [row("l1", "video", { lastPositionSec: 125.6 })] }).recent[0].positionSec, 126);
  assert.equal(buildLibrarySection({ progress: [row("l2", "video", { lastPositionSec: 0 })] }).recent[0].positionSec, null);
  const w = buildLibrarySection({ progress: [row("l3", "written", { pageCount: 5, lastPage: 3, lastPositionSec: 9 })] }).recent[0];
  assert.equal(w.lastPage, null); assert.equal(w.positionSec, null);
});

test("completed lessons are flagged, totals convert to minutes", () => {
  const r = buildLibrarySection({ progress: [row("l1", "written", { completed: true })], totals: { completed: 3, opened: 5, seconds: 1200, watched: 600 } });
  assert.equal(r.recent[0].completed, true);
  assert.deepEqual(r.summary, { lessonsCompleted: 3, lessonsOpened: 5, studyMinutes: 30 });
});
