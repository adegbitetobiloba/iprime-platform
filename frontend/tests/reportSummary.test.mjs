// Run with: node --test frontend/tests/reportSummary.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { summarise } from "../src/lib/reportSummary.js";

const h = (id, examId, subject, percentage) => ({ attemptId: id, examId, subject, percentage });
const topic = (topic, percentage, band) => ({ topic, percentage, band, questions: 10, attempts: 2 });

test("no data: honest empty report", () => {
  const s = summarise({ history: [] });
  assert.equal(s.stats.attempts, 0); assert.equal(s.stats.average, null); assert.match(s.headline, /nothing to report/); assert.equal(s.enough, false);
});

test("handles a missing response", () => assert.equal(summarise(undefined).stats.attempts, 0));

test("early report under three attempts says so", () => {
  const s = summarise({ history: [h("a", "e1", "Maths", 50), h("b", "e2", "Maths", 60)] });
  assert.match(s.headline, /early report based on 2/); assert.equal(s.enough, false);
});

test("headline numbers and change from the earlier average", () => {
  const s = summarise({ history: [h("a", "e1", "Maths", 40), h("b", "e1", "Maths", 50), h("c", "e2", "English", 90)] });
  assert.equal(s.stats.average, 60); assert.equal(s.stats.best, 90); assert.equal(s.stats.latest, 90);
  assert.equal(s.stats.changeFromEarlier, 45); assert.equal(s.stats.examsTaken, 2);
  assert.match(s.headline, /higher than the earlier average/);
});

test("a dip is described gently, never as failure", () => {
  const s = summarise({ history: [h("a", "e1", "Maths", 80), h("b", "e1", "Maths", 80), h("c", "e1", "Maths", 60)] });
  assert.match(s.headline, /snapshot/); assert.ok(!/fail|poor|weak|bad/i.test(s.headline));
});

test("subjects aggregate by average and best", () => {
  const s = summarise({ history: [h("a", "e1", "Maths", 40), h("b", "e2", "Maths", 60), h("c", "e3", "English", 80)] });
  assert.deepEqual(s.subjects.find((x) => x.subject === "Maths"), { subject: "Maths", attempts: 2, average: 50, best: 60 });
});

test("strengths, next steps and improvements come only from the data, capped at three", () => {
  const s = summarise({
    history: [h("a", "e1", "Maths", 50), h("b", "e1", "Maths", 60), h("c", "e1", "Maths", 70)],
    topics: [topic("Algebra", 30, "needs_practice"), topic("Grammar", 90, "strong"), topic("Geometry", 55, "developing"), topic("Untagged", 10, "needs_practice"), topic("A", 80, "strong"), topic("B", 85, "strong"), topic("C", 88, "strong")],
    retests: [{ examTitle: "Mock", change: 12 }, { examTitle: "Other", change: -4 }],
  });
  assert.deepEqual(s.nextSteps.map((t) => t.topic), ["Algebra"]);       // untagged is never a topic
  assert.equal(s.strengths.length, 3); assert.equal(s.strengths[0].topic, "Grammar");
  assert.equal(s.improved.length, 1);
});

test("the sentence rules never mention rank or other students", () => {
  const s = summarise({ history: [h("a", "e1", "M", 10), h("b", "e1", "M", 20), h("c", "e1", "M", 5)] });
  assert.ok(!/rank|position|class average|other students|classmates/i.test(JSON.stringify(s)));
});
