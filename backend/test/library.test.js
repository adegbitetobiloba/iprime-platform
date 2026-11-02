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
  assert.ok(L.lessonHasContent({ contentType: "pdf", pdf: { file: "abc" } }));
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

test("watched time cannot jump to the end in one request", () => {
  assert.equal(P.limitedGrowth(0, 600, 5), 30);
  assert.equal(P.limitedGrowth(100, 120, 20), 120);
  assert.equal(P.limitedGrowth(100, 50, 20), 100); // never goes backwards
});

test("continue target", () => {
  const ls = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(P.pickNextLesson(ls, ["a"], "b").id, "b");
  assert.equal(P.pickNextLesson(ls, ["a", "b"], "b").id, "c");
  assert.equal(P.pickNextLesson(ls, [], null).id, "a");
  assert.equal(P.pickNextLesson(ls, ["a", "b", "c"], "c"), null);
});

const PDF = require("../utils/libraryPdf");
test("pdf upload checks", () => {
  const good = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(300, 65), Buffer.from("\n%%EOF\n")]);
  assert.equal(PDF.checkPdfBuffer(good), null);
  assert.match(PDF.checkPdfBuffer(Buffer.from("<html>not a pdf</html>".repeat(20))), /not a PDF/);
  assert.match(PDF.checkPdfBuffer(Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(300, 65)])), /incomplete/);
  assert.match(PDF.checkPdfBuffer(Buffer.alloc(0)), /No file/);
  assert.match(PDF.checkPdfBuffer(Buffer.alloc(PDF.MAX_PDF_BYTES + 1, 65)), /too large/);
  assert.equal(PDF.checkPdfBuffer("text"), "No file was received. Send the PDF as the request body.");
});
test("safe file names", () => {
  assert.equal(PDF.safeFileName("..\\..\\secret/Chemistry Notes.pdf"), "Chemistry Notes.pdf");
  assert.equal(PDF.safeFileName("a<b>c.pdf"), "abc.pdf");
  assert.equal(PDF.safeFileName(""), "document.pdf");
  assert.equal(PDF.safeFileName("Organic%20Notes.pdf"), "Organic Notes.pdf");
});

const R = require("../utils/libraryRange");
const CD = require("../utils/libraryCountdown");
test("range parsing", () => {
  assert.equal(R.parseRange(undefined, 1000), null);
  assert.deepEqual(R.parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(R.parseRange("bytes=900-", 1000), { start: 900, end: 999 });
  assert.deepEqual(R.parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(R.parseRange("bytes=500-5000", 1000), { start: 500, end: 999 });
  assert.equal(R.parseRange("bytes=1000-1100", 1000), "invalid");
  assert.equal(R.parseRange("bytes=5-1", 1000), "invalid");
  assert.equal(R.parseRange("bytes=0-1,5-9", 1000), "invalid");
  assert.equal(R.parseRange("items=0-1", 1000), "invalid");
});
test("countdown and plan", () => {
  const now = Date.parse("2026-11-01T00:00:00+01:00");
  assert.equal(CD.daysLeft("2027-03-15T00:00:00+01:00", now), 134);
  assert.equal(CD.daysLeft("2026-10-01T00:00:00+01:00", now), 0);
  assert.equal(CD.daysLeft("garbage", now), null);
  assert.deepEqual(CD.studyPlan(70, 50), { daysLeft: 70, weeksLeft: 10, lessonsRemaining: 50, lessonsPerWeek: 5, enoughTime: true });
  assert.equal(CD.studyPlan(3, 10).lessonsPerWeek, 10);
  assert.equal(CD.studyPlan(3, 10).enoughTime, false);
  assert.equal(CD.studyPlan(70, 0).lessonsPerWeek, 0);
  assert.equal(CD.studyPlan(null, 5), null);
});

const IMG = require("../utils/libraryImage");
test("image upload checks", () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP"), Buffer.alloc(200, 1)]);
  assert.equal(IMG.checkImageBuffer(jpeg).type, "image/jpeg");
  assert.equal(IMG.checkImageBuffer(png).type, "image/png");
  assert.equal(IMG.checkImageBuffer(webp).type, "image/webp");
  assert.match(IMG.checkImageBuffer(Buffer.from("GIF89a" + "x".repeat(300))).error, /Only JPEG/);
  assert.match(IMG.checkImageBuffer(Buffer.from("<svg onload=alert(1)>" + "x".repeat(300))).error, /Only JPEG/);
  assert.match(IMG.checkImageBuffer(Buffer.alloc(0)).error, /No image/);
  assert.match(IMG.checkImageBuffer(Buffer.concat([jpeg.subarray(0, 4), Buffer.alloc(IMG.MAX_IMAGE_BYTES)])).error, /too large/);
});
test("reading percent", () => {
  assert.equal(P.readingPercent({ page: 5, pageCount: 20 }), 25);
  assert.equal(P.readingPercent({ page: 30, pageCount: 20 }), 100);
  assert.equal(P.readingPercent({ percent: 42.6 }), 43);
  assert.equal(P.readingPercent({ percent: 150 }), 100);
  assert.equal(P.readingPercent({}), null);
});
