// Run with: node --test frontend/tests/continueTarget.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { pickContinue } from "../src/lib/continueTarget.js";
import { summariseLibrary } from "../src/lib/libraryReport.js";

const exam = (id, secondsLeft, extra = {}) => ({ attemptId: id, examId: "e" + id, examTitle: `Exam ${id}`, subject: "Maths", secondsLeft, answered: 5, questionCount: 20, ...extra });
const lesson = (id, extra = {}) => ({ id, title: `Lesson ${id}`, contentType: "pdf", completed: false, lastPage: 12, pageCount: 40, positionSec: null, ...extra });

test("nothing available: no button", () => {
  assert.equal(pickContinue(null), null);
  assert.equal(pickContinue({ continueExams: [], library: { available: true, recent: [] }, recommended: [] }), null);
});

test("a running exam beats everything and links to the attempt", () => {
  const t = pickContinue({ continueExams: [exam("a1", 1800)], library: { available: true, recent: [lesson("l1")] }, recommended: [{ id: "r", title: "R" }] });
  assert.equal(t.kind, "exam"); assert.equal(t.to, "/attempts/a1"); assert.match(t.detail, /5 of 20 answered/); assert.match(t.detail, /30 min left/);
});

test("the exam closest to its deadline wins and is flagged urgent under 10 minutes", () => {
  const t = pickContinue({ continueExams: [exam("a1", 3000), exam("a2", 300)] });
  assert.equal(t.to, "/attempts/a2"); assert.equal(t.urgent, true);
});

test("otherwise the latest unfinished lesson, with where they stopped", () => {
  const t = pickContinue({ continueExams: [], library: { available: true, recent: [lesson("l1", { completed: true }), lesson("l2")] } });
  assert.equal(t.kind, "lesson"); assert.equal(t.to, "/library/lessons/l2"); assert.match(t.detail, /PDF · Page 12 of 40/);
  const v = pickContinue({ library: { available: true, recent: [lesson("l3", { contentType: "video", lastPage: null, pageCount: null, positionSec: 275 })] } });
  assert.match(v.detail, /Video · Resume at 4:35/);
});

test("an unavailable Library is ignored, completed-only history is skipped", () => {
  assert.equal(pickContinue({ library: { available: false, recent: [lesson("l1")] } }), null);
  assert.equal(pickContinue({ library: { available: true, recent: [lesson("l1", { completed: true })] } }), null);
});

test("falls back to the top recommendation with its reason", () => {
  const t = pickContinue({ recommended: [{ id: "x9", title: "Mock 4", subject: "Maths", reason: "A new subject for you." }] });
  assert.equal(t.kind, "recommended"); assert.equal(t.to, "/exams/x9"); assert.match(t.detail, /A new subject/);
});

test("library report section: absent without activity, capped and real with it", () => {
  assert.equal(summariseLibrary(null), null);
  assert.equal(summariseLibrary({ lessonsCompleted: 0, studyMinutes: 0, courses: [] }), null);
  const r = summariseLibrary({ lessonsCompleted: 3, studyMinutes: 42, coursesStarted: 5, courses: Array.from({ length: 6 }, (_, i) => ({ id: i, title: `C${i}`, completed: i, total: 10, percent: i * 10 })) });
  assert.equal(r.courses.length, 4); assert.equal(r.studyMinutes, 42);
  assert.equal(summariseLibrary({ lessonsCompleted: 0, studyMinutes: 0, courses: [{ id: 1, title: "X", completed: 0, total: 0, percent: 0 }] }), null); // empty courses don't count
});
