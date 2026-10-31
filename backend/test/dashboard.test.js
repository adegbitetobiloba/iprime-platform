const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildDashboard, isOpen } = require("../utils/dashboard");

const NOW = new Date("2026-10-30T12:00:00Z");
const exam = (id, over = {}) => ({ _id: id, title: `Exam ${id}`, subject: "Mathematics", status: "published", durationMinutes: 30, maxAttempts: 1, questionCount: 10, ...over });
const sub = (id, examId, percentage, submittedAt) => ({ _id: id, examId, percentage, score: percentage, totalMarks: 100, correct: 1, incorrect: 1, unanswered: 0, submittedAt });

test("a student with no activity gets honest empty values, not zeros or made-up numbers", () => {
  const d = buildDashboard({ submitted: [], inProgress: [], exams: [], now: NOW });
  assert.equal(d.stats.attempted, 0);
  assert.equal(d.stats.averagePercentage, null);
  assert.equal(d.stats.bestPercentage, null);
  assert.equal(d.stats.changeFromEarlier, null);
  assert.equal(d.progress.coveragePercent, null);
  assert.deepEqual([d.subjects, d.recent, d.recommended, d.continueExams], [[], [], [], []]);
});

test("headline numbers come from the saved attempts", () => {
  const exams = [exam("e1"), exam("e2", { subject: "Biology" })];
  const submitted = [sub("a1", "e1", 40, "2026-10-01T10:00:00Z"), sub("a2", "e1", 60, "2026-10-10T10:00:00Z"), sub("a3", "e2", 80, "2026-10-20T10:00:00Z")];
  const d = buildDashboard({ submitted, exams, now: NOW });
  assert.equal(d.stats.attempted, 3);
  assert.equal(d.stats.examsTaken, 2);
  assert.equal(d.stats.averagePercentage, 60);
  assert.equal(d.stats.bestPercentage, 80);
  assert.equal(d.stats.latestPercentage, 80);
  assert.equal(d.stats.changeFromEarlier, 30); // 80 against the earlier average of 50
  assert.equal(d.recent[0].id, "a3"); // newest first
  assert.deepEqual(d.progress.series.map((p) => p.percentage), [40, 60, 80]); // oldest to newest for the chart
});

test("subjects are only those the student has actually written", () => {
  const exams = [exam("e1"), exam("e2", { subject: "Biology" }), exam("e3", { subject: "Physics" })];
  const d = buildDashboard({ submitted: [sub("a1", "e1", 50, "2026-10-01T10:00:00Z"), sub("a2", "e2", 70, "2026-10-02T10:00:00Z")], exams, now: NOW });
  assert.deepEqual(d.subjects.map((s) => s.subject).sort(), ["Biology", "Mathematics"]);
});

test("a result whose exam was deleted still shows, without inventing a subject", () => {
  const d = buildDashboard({ submitted: [sub("a1", "gone", 55, "2026-10-01T10:00:00Z")], exams: [], now: NOW });
  assert.equal(d.recent[0].examTitle, "Examination");
  assert.equal(d.recent[0].subject, null);
  assert.equal(d.subjects.length, 0);
  assert.equal(d.stats.attempted, 1);
});

test("only running attempts with time left are offered for resuming", () => {
  const exams = [exam("e1"), exam("e2")];
  const inProgress = [
    { _id: "r1", examId: "e1", startedAt: "2026-10-30T11:50:00Z", deadline: "2026-10-30T12:10:00Z", answeredCount: 4 },
    { _id: "r2", examId: "e2", startedAt: "2026-10-30T10:00:00Z", deadline: "2026-10-30T11:00:00Z" }, // already expired
  ];
  const d = buildDashboard({ inProgress, exams, now: NOW });
  assert.equal(d.continueExams.length, 1);
  assert.equal(d.continueExams[0].attemptId, "r1");
  assert.equal(d.continueExams[0].secondsLeft, 600);
  assert.equal(d.continueExams[0].answered, 4);
});

test("recommendations respect availability, attempts left, running attempts and question counts", () => {
  const exams = [
    exam("open"),
    exam("draft", { status: "draft" }),
    exam("expired", { availableUntil: "2026-10-01T00:00:00Z" }),
    exam("future", { availableFrom: "2026-12-01T00:00:00Z" }),
    exam("used", { maxAttempts: 1 }),
    exam("running"),
    exam("empty", { questionCount: 0 }),
  ];
  const submitted = [sub("a1", "used", 90, "2026-10-01T10:00:00Z")];
  const inProgress = [{ _id: "r1", examId: "running", deadline: "2026-10-30T12:30:00Z" }];
  const d = buildDashboard({ submitted, inProgress, exams, now: NOW });
  assert.deepEqual(d.recommended.map((r) => r.id), ["open"]);
});

test("weaker subjects are recommended first, with a reason that states the real average", () => {
  const exams = [exam("m1"), exam("b1", { subject: "Biology" }), exam("m2"), exam("b2", { subject: "Biology" })];
  const submitted = [sub("a1", "m1", 30, "2026-10-01T10:00:00Z"), sub("a2", "b1", 85, "2026-10-02T10:00:00Z")];
  const d = buildDashboard({ submitted, exams: exams.map((e) => ({ ...e, maxAttempts: 3 })), now: NOW });
  assert.equal(d.recommended[0].subject, "Mathematics");
  assert.match(d.recommended[0].reason, /Mathematics average is 30%/);
  assert.ok(d.recommended.length <= 4);
});

test("coverage counts how many open examinations the student has tried", () => {
  const exams = [exam("e1"), exam("e2"), exam("e3"), exam("e4", { status: "draft" })];
  const d = buildDashboard({ submitted: [sub("a1", "e1", 50, "2026-10-01T10:00:00Z"), sub("a2", "e1", 60, "2026-10-02T10:00:00Z")], exams, now: NOW });
  assert.equal(d.progress.openExaminations, 3);
  assert.equal(d.progress.openExaminationsTried, 1);
  assert.equal(d.progress.coveragePercent, 33);
});

test("the series keeps only the latest ten results", () => {
  const submitted = Array.from({ length: 14 }, (_, i) => sub(`a${i}`, "e1", i, new Date(Date.UTC(2026, 9, 1 + i)).toISOString()));
  const d = buildDashboard({ submitted, exams: [exam("e1")], now: NOW });
  assert.equal(d.progress.series.length, 10);
  assert.equal(d.progress.series[9].percentage, 13);
});

test("the dashboard output never contains answers or explanations", () => {
  const e = { ...exam("e1"), questions: [{ correctKey: "A", explanation: "secret" }] };
  const d = buildDashboard({ submitted: [sub("a1", "e1", 50, "2026-10-01T10:00:00Z")], exams: [e], now: NOW });
  const text = JSON.stringify(d);
  assert.ok(!text.includes("correctKey") && !text.includes("secret"));
});

test("isOpen follows the same rule as the examination centre", () => {
  assert.equal(isOpen(exam("x"), NOW), true);
  assert.equal(isOpen(exam("x", { status: "draft" }), NOW), false);
  assert.equal(isOpen(exam("x", { availableUntil: "2026-10-30T11:59:59Z" }), NOW), false);
  assert.equal(isOpen(exam("x", { availableFrom: "2026-10-30T12:00:01Z" }), NOW), false);
  assert.equal(isOpen(null, NOW), false);
});
