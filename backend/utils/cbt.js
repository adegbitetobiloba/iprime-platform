// Pure exam logic (no database, no network) so it can be tested on its own.
const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"]; // 2 to 6 options per question

const toPlain = (answers) => (answers instanceof Map ? Object.fromEntries(answers) : answers || {});

// Scores an attempt from the questions and the saved answers. Runs ONLY on the server.
function scoreAttempt(questions, answers) {
  const given = toPlain(answers);
  let score = 0, totalMarks = 0, correct = 0, incorrect = 0, unanswered = 0;
  for (const q of questions) {
    const marks = q.marks ?? 1;
    totalMarks += marks;
    const choice = given[String(q._id)];
    if (!choice) { unanswered++; continue; }
    if (choice === q.correctKey) { score += marks; correct++; } else incorrect++;
  }
  const percentage = totalMarks ? Math.round((score / totalMarks) * 1000) / 10 : 0;
  return { score, totalMarks, correct, incorrect, unanswered, percentage };
}

// What a student may see of a question while the exam is running: never the correct answer or explanation.
const publicQuestion = (q) => ({
  id: String(q._id),
  text: q.text,
  ...(q.textHtml ? { textHtml: q.textHtml } : {}),
  options: q.options.map((o) => ({ key: o.key, text: o.text, ...(o.html ? { html: o.html } : {}) })),
  marks: q.marks ?? 1,
  ...(q.topic ? { topic: q.topic } : {}),
});

// The deadline is fixed on the server when the attempt starts; the browser clock plays no part.
const deadlineFor = (startedAt, durationMinutes) => new Date(new Date(startedAt).getTime() + durationMinutes * 60000);

// Reads questions pasted as plain text. Example:
//   Q: What is 2 + 2?
//   A) 3
//   B) 4
//   C) 5
//   D) 6
//   Answer: B
//   Explanation: optional
//   Marks: optional
//   Topic: optional
// Nothing is guessed: a question without an explicit answer is reported as an error, not imported.
function parseQuestionText(text) {
  const questions = [];
  const errors = [];
  const startRe = /^\s*(?:Q(?:uestion)?\s*\d*\s*[:.)]|\d+\s*[.)])\s*(.*)$/i;
  const optionRe = /^\s*\(?([A-Fa-f])[.)]\s*(.+)$/;
  const answerRe = /^\s*(?:Answer|Ans|Correct(?:\s+answer)?)\s*[:=-]\s*\(?([A-Fa-f])\)?\s*\.?\s*$/i;
  const explRe = /^\s*Explanation\s*[:-]\s*(.*)$/i;
  const marksRe = /^\s*Marks?\s*[:=]\s*(\d+(?:\.\d+)?)\s*$/i;
  const topicRe = /^\s*Topic\s*:\s*(.+)$/i;

  let cur = null;
  let last = null; // which field a continuation line belongs to

  const flush = () => {
    if (!cur) return;
    const n = questions.length + errors.filter((e) => e.fatal).length + 1;
    const keys = cur.options.map((o) => o.key);
    const problems = [];
    if (!cur.text.trim()) problems.push("the question text is empty");
    if (cur.options.length < 2) problems.push("it needs at least 2 options");
    if (new Set(keys).size !== keys.length) problems.push("option letters are repeated");
    if (!cur.correctKey) problems.push("no answer was given (add a line like 'Answer: B')");
    else if (!keys.includes(cur.correctKey)) problems.push(`the answer ${cur.correctKey} is not one of the options`);
    if (cur.marks !== undefined && (cur.marks <= 0 || cur.marks > 100)) problems.push("marks must be between 0.5 and 100");
    if (problems.length) {
      errors.push({ fatal: true, question: n, label: cur.text.trim().slice(0, 60), message: problems.join("; ") });
    } else {
      const q = { text: cur.text.trim(), options: cur.options, correctKey: cur.correctKey };
      if (cur.marks !== undefined) q.marks = cur.marks;
      if (cur.topic) q.topic = cur.topic;
      if (cur.explanation) q.explanation = cur.explanation.trim();
      questions.push(q);
    }
    cur = null; last = null;
  };

  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(answerRe)) && cur) { cur.correctKey = m[1].toUpperCase(); last = null; continue; }
    if ((m = line.match(explRe)) && cur) { cur.explanation = m[1]; last = "explanation"; continue; }
    if ((m = line.match(marksRe)) && cur) { cur.marks = Number(m[1]); last = null; continue; }
    if ((m = line.match(topicRe)) && cur) { cur.topic = m[1].trim(); last = null; continue; }
    if ((m = line.match(optionRe)) && cur) { cur.options.push({ key: m[1].toUpperCase(), text: m[2].trim() }); last = "option"; continue; }
    if ((m = line.match(startRe)) && !(cur && cur.options.length === 0 && /^\d+\s*[.)]\s*$/.test(line))) {
      flush();
      cur = { text: m[1], options: [] };
      last = "text";
      continue;
    }
    // continuation of the previous field
    if (!cur) { errors.push({ fatal: false, question: 0, label: line.slice(0, 60), message: "text found before the first question; it was ignored" }); continue; }
    if (last === "option") cur.options[cur.options.length - 1].text += " " + line.trim();
    else if (last === "explanation") cur.explanation += " " + line.trim();
    else cur.text += " " + line.trim();
  }
  flush();
  return { questions, errors: errors.map(({ fatal, ...e }) => e) };
}

module.exports = { OPTION_KEYS, scoreAttempt, publicQuestion, deadlineFor, parseQuestionText, toPlain };
