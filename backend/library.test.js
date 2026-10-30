const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../utils/library");
const P = require("../utils/libraryProgress");

test("slugify", () => {
  assert.equal(L.slugify("Organic Chemistry: Alkanes & Alkenes!"), "organic-chemistry-alkanes-alkenes");
  assert.equal(L.slugify("   "), "item");
});

test("status transitions", () => {
  assert.ok(L.canTransition("draft", "published"));
  assert.ok(L.canTransition("published", "draft"));
  assert.ok(!L.canTransition("archived", "published"));
  assert.ok(!L.canTransition("published", "review"));
});

test("video URLs: only YouTube and Vimeo over https", () => {
  assert.equal(L.parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(L.parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=5").provider, "youtube");
  assert.equal(L.parseVideoUrl("https://youtube.com/embed/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(L.parseVideoUrl("https://vimeo.com/123456789").provider, "vimeo");
  assert.equal(L.parseVideoUrl("http://youtu.be/dQw4w9WgXcQ"), null);
  assert.equal(L.parseVideoUrl("https://evil.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(L.parseVideoUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(L.parseVideoUrl("javascript:alert(1)"), null);
  assert.equal(L.parseVideoUrl("not a url"), null);
});

test("lessonHasContent follows the lesson type", () => {
  assert.ok(L.lessonHasContent({ contentType: "text", body: "Alkanes are..." }));
  assert.ok(!L.lessonHasContent({ contentType: "text", body: "  " }));
  assert.ok(!L.lessonHasContent({ contentType: "pdf", pdf: {} }));
  assert.ok(L.lessonHasContent({ contentType: "video", video: { videoId: "dQw4w9WgXcQ" } }));
});

test("publish problems", () => {
  assert.equal(L.publishProblems({ description: "x" }, [{ contentType: "text", body: "hi", status: "draft" }]).length, 0);
  assert.ok(L.publishProblems({ description: "" }, []).length >= 2);
  assert.equal(L.publishProblems({ description: "x" }, [{ contentType: "text", body: "", status: "draft" }]).length, 1);
});

test("opening a lesson never completes it", () => {
  for (const contentType of ["video", "pdf", "text", "link"]) assert.equal(P.isLessonComplete({ contentType }, {}), false);
});

test("video completes at 90% watched", () => {
  const l = { contentType: "video" };
  assert.equal(P.isLessonComplete(l, { videoDurationSec: 600, maxWatchedSec: 539 }), false);
  assert.equal(P.isLessonComplete(l, { videoDurationSec: 600, maxWatchedSec: 540 }), true);
});

test("pdf last page; text end plus time; quiz gate", () => {
  assert.equal(P.isLessonComplete({ contentType: "pdf" }, { pageCount: 10, maxPageReached: 9 }), false);
  assert.equal(P.isLessonComplete({ contentType: "pdf" }, { pageCount: 10, maxPageReached: 10 }), true);
  const t = { contentType: "text", estimatedMinutes: 10 };
  assert.equal(P.isLessonComplete(t, { reachedEnd: true, activeSeconds: 5 }), false);
  assert.equal(P.isLessonComplete(t, { reachedEnd: true, activeSeconds: 300 }), true);
  assert.equal(P.isLessonComplete({ ...t, requiresQuizPass: true }, { reachedEnd: true, activeSeconds: 300 }), false);
  assert.equal(P.isLessonComplete({ ...t, requiresQuizPass: true }, { reachedEnd: true, activeSeconds: 300, quizPassed: true }), true);
});

test("course percent", () => {
  assert.equal(P.coursePercent(0, 0), 0);
  assert.equal(P.coursePercent(1, 3), 33);
  assert.equal(P.coursePercent(5, 3), 100);
});
