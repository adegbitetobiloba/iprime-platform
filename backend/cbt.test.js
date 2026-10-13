const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scoreAttempt, publicQuestion, deadlineFor, parseQuestionText } = require("../utils/cbt");

const Q = (id, correctKey, marks) => ({
  _id: id, text: `Question ${id}`, correctKey, marks,
  options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }],
  explanation: "secret explanation",
});
const questions = [Q("1", "A"), Q("2", "B", 2), Q("3", "C"), Q("4", "A")];

test("scoring counts correct, incorrect and unanswered, using marks", () => {
  const r = scoreAttempt(questions, { 1: "A", 2: "B", 3: "A" }); // 4 unanswered
  assert.deepEqual(r, { score: 3, totalMarks: 5, correct: 2, incorrect: 1, unanswered: 1, percentage: 60 });
});

test("scoring accepts a Map (as stored by Mongoose) and ignores unknown ids", () => {
  const r = scoreAttempt(questions, new Map([["1", "A"], ["999", "A"]]));
  assert.equal(r.correct, 1);
  assert.equal(r.unanswered, 3);
});

test("an empty exam does not divide by zero", () => {
  assert.equal(scoreAttempt([], {}).percentage, 0);
});

test("students never receive the correct answer or explanation", () => {
  const pq = publicQuestion(questions[0]);
  const text = JSON.stringify(pq);
  assert.ok(!("correctKey" in pq));
  assert.ok(!text.includes("secret explanation"));
  assert.ok(!text.includes("correctKey"));
});

test("deadline comes from the start time plus duration", () => {
  const start = new Date("2026-01-01T10:00:00Z");
  assert.equal(deadlineFor(start, 30).toISOString(), "2026-01-01T10:30:00.000Z");
});

const SAMPLE = `Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B
Explanation: Basic addition.
Marks: 2
Topic: Arithmetic

2. The capital of Nigeria is
A. Lagos
B. Abuja
   (the federal capital)
C. Kano
Answer: B
`;

test("pasted questions are parsed exactly as written", () => {
  const { questions: qs, errors } = parseQuestionText(SAMPLE);
  assert.equal(errors.length, 0);
  assert.equal(qs.length, 2);
  assert.equal(qs[0].correctKey, "B");
  assert.equal(qs[0].marks, 2);
  assert.equal(qs[0].topic, "Arithmetic");
  assert.equal(qs[0].explanation, "Basic addition.");
  assert.equal(qs[1].text, "The capital of Nigeria is");
  assert.equal(qs[1].options[1].text, "Abuja (the federal capital)");
});

test("a question with no stated answer is reported, never guessed", () => {
  const { questions: qs, errors } = parseQuestionText("Q: Pick one\nA) x\nB) y\n");
  assert.equal(qs.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /no answer/);
});

test("an answer that is not among the options is reported", () => {
  const { questions: qs, errors } = parseQuestionText("Q: Pick one\nA) x\nB) y\nAnswer: D\n");
  assert.equal(qs.length, 0);
  assert.match(errors[0].message, /not one of the options/);
});

test("good and bad questions in one paste: errors are listed with their number", () => {
  const { questions: qs, errors } = parseQuestionText("Q: ok\nA) 1\nB) 2\nAnswer: A\nQ: bad\nA) only one\nAnswer: A\n");
  assert.equal(qs.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].question, 2);
});
