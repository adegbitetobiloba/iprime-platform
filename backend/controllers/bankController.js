// Question bank: idempotent batch import, search, edit, archive, copy into exams. Admin-only (see routes/adminRoutes.js).
const mongoose = require("mongoose");
const BankQuestion = require("../models/BankQuestion");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const bank = require("../utils/bank");
const { selectQuestions } = require("../utils/selection");
const { dependsOnNeighbours, optionsShufflable } = require("../utils/randomise");

const isId = (v) => mongoose.isValidObjectId(v);
const MAX_EXAM_QUESTIONS = 500;
const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };

const plain = (d) => (d && typeof d.toObject === "function" ? d.toObject() : d);

const summary = (q) => ({
  id: String(q._id), externalId: q.externalId || null, subject: q.subject || "", topic: q.topic || "",
  text: (q.text || "").slice(0, 240), optionCount: (q.options || []).length, correctKey: q.correctKey || null,
  usable: !!q.usable, problems: q.problems || [], awaitingSolution: !!q.awaitingSolution,
  reviewStatus: q.review && q.review.status, status: q.status, hasSolution: !!(q.solution && q.solution.text),
  edited: !!q.edited, version: q.version || 1, updatedAt: q.updatedAt,
  difficulty: q.difficulty || null, marks: q.marks ?? 1,
  questionType: q.questionType || null, sourceStatus: q.sourceStatus || null, verified: !!(q.verification && q.verification.status === "verified"),
  sourceRef: (q.source && q.source.refs && q.source.refs[0]) || null, hasFormatting: !!q.textHtml, hasExplanation: !!(q.explanation || (q.solution && q.solution.text)),
});

// POST /api/admin/bank/import   (safe to repeat: the same batch sent twice stores nothing twice)
exports.importBatch = async (req, res) => {
  try {
    const { sessionId, document, allowIncomplete, onConflict, questions } = req.body;
    const results = { created: 0, unchanged: 0, updated: 0, conflicts: [], rejected: [], possibleDuplicates: [], skippedDuplicates: [] };
    const prepared = [];
    const seen = new Set();
    questions.forEach((item, index) => {
      const p = bank.prepareImportItem(item, { allowIncomplete });
      if (!p.ok) { results.rejected.push({ index, externalId: item.externalId || null, reason: p.reason, problems: p.problems }); return; }
      if (document) p.doc.source.document = document;
      if (seen.has(p.doc.externalKey)) { results.rejected.push({ index, externalId: item.externalId || null, reason: "repeated_in_batch", problems: [{ code: "DUP_ID", message: "The same question appears twice in this batch; only the first was used." }] }); return; }
      seen.add(p.doc.externalKey);
      prepared.push({ index, doc: p.doc, skipIfDuplicate: item.skipIfDuplicate === true });
    });

    const existing = prepared.length ? await BankQuestion.find({ externalKey: { $in: prepared.map((p) => p.doc.externalKey) } }).lean() : [];
    const byKey = new Map(existing.map((e) => [e.externalKey, e]));
    // Same wording AND same options under a different ID: reported to the administrator, never deleted. An explicit "skip" decision is honoured.
    const fresh = prepared.filter((p) => !byKey.has(p.doc.externalKey));
    const sameStem = fresh.length ? await BankQuestion.find({ stemHash: { $in: fresh.map((p) => p.doc.stemHash) } }).lean() : [];
    const stemOwner = new Map(sameStem.map((e) => [e.stemHash, e]));
    const toInsert = [];
    for (const { index, doc, skipIfDuplicate } of prepared) {
      const cur = byKey.get(doc.externalKey);
      if (!cur) {
        const twin = stemOwner.get(doc.stemHash);
        if (twin) {
          results.possibleDuplicates.push({ index, externalId: doc.externalId || null, existingId: String(twin._id), existingExternalId: twin.externalId || null });
          if (skipIfDuplicate) { results.skippedDuplicates.push({ index, externalId: doc.externalId || null, existingId: String(twin._id) }); continue; }
        }
        toInsert.push({ ...doc, importSession: sessionId, createdBy: req.user.id, updatedBy: req.user.id });
        continue;
      }
      if (cur.contentHash === doc.contentHash) { results.unchanged++; continue; }
      // Same ID but different content. Administrator edits and archived questions are never overwritten.
      if (onConflict === "update" && !cur.edited && cur.status !== "archived") {
        await BankQuestion.updateOne({ _id: cur._id }, { $set: { ...doc, importSession: sessionId, updatedBy: req.user.id }, $inc: { version: 1 } });
        results.updated++;
      } else {
        results.conflicts.push({ index, externalId: doc.externalId || null, id: String(cur._id), reason: cur.edited ? "edited_by_admin" : cur.status === "archived" ? "archived" : "content_differs" });
      }
    }
    if (toInsert.length) {
      try {
        const out = await BankQuestion.insertMany(toInsert, { ordered: false });
        results.created += out.length;
      } catch (err) {
        // A parallel request may have stored the same question first: count what really went in, and treat the rest as already there.
        const inserted = err.insertedDocs ? err.insertedDocs.length : (err.result && err.result.insertedCount) || 0;
        const dupOnly = err.writeErrors ? err.writeErrors.every((w) => (w.code || (w.err && w.err.code)) === 11000) : err.code === 11000;
        if (!dupOnly) throw err;
        results.created += inserted;
        results.unchanged += toInsert.length - inserted;
      }
    }
    res.status(results.created || results.updated ? 201 : 200).json({ sessionId, received: questions.length, ...results });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/bank?subject=&topic=&q=&review=&flag=incomplete|awaiting_solution|usable&status=&page=&limit=
exports.list = async (req, res) => {
  try {
    const { subject, topic, q, review, flag, status = "active" } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};
    if (status === "active" || status === "archived") filter.status = status;
    if (subject) filter.subject = String(subject);
    if (topic) filter.topic = String(topic);
    if (review) filter["review.status"] = String(review);
    if (flag === "incomplete") filter.usable = false;
    if (flag === "usable") filter.usable = true;
    if (flag === "awaiting_solution") { filter.awaitingSolution = true; }
    if (flag === "missing_answer") filter.problems = "NO_ANSWER";
    if (flag === "invalid_options") filter.problems = { $in: ["FEW_OPTIONS", "EMPTY_OPTION", "BAD_ANSWER", "DUP_KEY"] };
    if (flag === "missing_visual") filter.problems = "VISUAL";
    if (flag === "no_text") filter.problems = "NO_TEXT";
    if (flag === "missing_explanation") { filter.explanation = ""; filter["solution.text"] = { $in: [null, ""] }; }
    if (flag === "verified") filter["verification.status"] = "verified";
    if (flag === "unverified") filter["verification.status"] = { $ne: "verified" };
    if (["easy", "medium", "hard"].includes(req.query.difficulty)) filter.difficulty = req.query.difficulty;
    if (req.query.difficulty === "unrated") filter.difficulty = null; // matches questions with no difficulty set
    if (req.query.type) filter.questionType = String(req.query.type);
    if (req.query.sourceStatus) filter.sourceStatus = String(req.query.sourceStatus);
    if (req.query.sourceRef) filter["source.refs"] = new RegExp(bank.escapeRegex(String(req.query.sourceRef).trim().slice(0, 100)), "i");
    if (flag === "duplicate") {
      const groups = await BankQuestion.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$stemHash", ids: { $push: "$_id" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
      filter._id = { $in: groups.flatMap((g) => g.ids) };
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(bank.escapeRegex(String(q).trim().slice(0, 100)), "i");
      filter.$or = [{ text: rx }, { externalId: rx }, { topic: rx }];
    }
    const [rows, total] = await Promise.all([
      BankQuestion.find(filter).sort({ externalId: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      BankQuestion.countDocuments(filter),
    ]);
    res.json({ questions: rows.map(summary), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/bank/facets : numbers for the filter bar
exports.facets = async (req, res) => {
  try {
    const [subjects, topics, totals] = await Promise.all([
      BankQuestion.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$subject", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      BankQuestion.aggregate([{ $match: { status: "active" } }, { $group: { _id: { subject: "$subject", topic: "$topic" }, n: { $sum: 1 } } }, { $sort: { "_id.topic": 1 } }]),
      BankQuestion.aggregate([{ $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } }, archived: { $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] } }, usable: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "active"] }, "$usable"] }, 1, 0] } }, awaitingSolution: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "active"] }, "$awaitingSolution"] }, 1, 0] } } } }]),
    ]);
    const t = totals[0] || { total: 0, active: 0, archived: 0, usable: 0, awaitingSolution: 0 };
    res.json({
      subjects: subjects.filter((s) => s._id).map((s) => ({ name: s._id, count: s.n })),
      topics: topics.filter((t2) => t2._id && t2._id.topic).map((t2) => ({ subject: t2._id.subject || "", name: t2._id.topic, count: t2.n })),
      totals: { total: t.total, active: t.active, archived: t.archived, usable: t.usable, incomplete: t.active - t.usable, awaitingSolution: t.awaitingSolution },
    });
  } catch (err) { serverError(res, err); }
};

const findOne = async (req, res) => {
  if (!isId(req.params.id)) { res.status(404).json({ error: "Question not found" }); return null; }
  const q = await BankQuestion.findById(req.params.id);
  if (!q) { res.status(404).json({ error: "Question not found" }); return null; }
  return q;
};

exports.get = async (req, res) => {
  try {
    const q = await findOne(req, res);
    if (!q) return;
    const inExams = await Exam.countDocuments({ "questions.bankId": q._id });
    res.json({ question: plain(q), problems: bank.problemsOf(plain(q)), inExams });
  } catch (err) { serverError(res, err); }
};

// PATCH /api/admin/bank/:id : edit any field; derived flags are recomputed; exams are NOT touched.
exports.edit = async (req, res) => {
  try {
    const q = await findOne(req, res);
    if (!q) return;
    const { expectedVersion, ...patch } = req.body;
    if (expectedVersion && expectedVersion !== (q.version || 1)) return res.status(409).json({ error: "Someone else changed this question while you were editing. Reload it and try again.", currentVersion: q.version || 1 });
    const next = bank.applyEdit(plain(q), patch, req.user.id);
    const problems = bank.problemsOf(next);
    if (next.text && next.text.length > bank.LIMITS.text) return res.status(400).json({ error: "The question text is too long.", problems });
    const changes = bank.diffFields(plain(q), next);
    const history = [...(q.history || []), { at: new Date(), by: req.user.id, action: "edit", version: next.version, fields: changes }].slice(-50);
    q.set({
      history, textHtml: next.textHtml, explanationHtml: next.explanationHtml,
      subject: next.subject, topic: next.topic, subtopic: next.subtopic, text: next.text, options: next.options, correctKey: next.correctKey,
      explanation: next.explanation, marks: next.marks, difficulty: next.difficulty, questionType: next.questionType, imageRef: next.imageRef, solution: next.solution,
      usable: next.usable, problems: next.problems, awaitingSolution: next.awaitingSolution, contentHash: next.contentHash, stemHash: next.stemHash,
      review: next.review, edited: true, version: next.version, updatedBy: next.updatedBy,
    });
    await q.save();
    res.json({ question: plain(q), problems });
  } catch (err) { serverError(res, err); }
};

const setStatus = (status) => async (req, res) => {
  try {
    const q = await findOne(req, res);
    if (!q) return;
    q.status = status;
    q.updatedBy = req.user.id;
    await q.save();
    res.json({ question: summary(plain(q)) });
  } catch (err) { serverError(res, err); }
};
exports.archive = setStatus("archived");
exports.restore = setStatus("active");

// POST /api/admin/bank/:id/verify {verified}: the ONLY way a question becomes "verified". Saving an edit never does it.
exports.verify = async (req, res) => {
  try {
    const q = await findOne(req, res);
    if (!q) return;
    const on = req.body.verified === true;
    if (on && !q.usable) return res.status(409).json({ error: "A question that is still incomplete cannot be marked as verified." });
    q.verification = on ? { status: "verified", by: req.user.id, at: new Date() } : { status: "unverified" };
    q.history = [...(q.history || []), { at: new Date(), by: req.user.id, action: on ? "verify" : "unverify", version: q.version || 1, fields: [] }].slice(-50);
    await q.save();
    res.json({ question: summary(plain(q)) });
  } catch (err) { serverError(res, err); }
};

const lockedReason = async (exam) => {
  if (exam.status === "published") return "Unpublish the examination before changing its questions.";
  if (await Attempt.exists({ examId: exam._id })) return "This examination already has attempts, so its questions can no longer be changed.";
  return null;
};

// POST /api/admin/bank/add-to-exam {examId, ids}: copies snapshots into a draft exam with no attempts.
exports.addToExam = async (req, res) => {
  try {
    const { examId, ids, marks } = req.body; // marks (optional): give every question copied in this call the same mark
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: "Examination not found" });
    const locked = await lockedReason(exam);
    if (locked) return res.status(409).json({ error: locked });
    const found = await BankQuestion.find({ _id: { $in: ids } });
    const byId = new Map(found.map((f) => [String(f._id), f]));
    const already = new Set(exam.questions.filter((x) => x.bankId).map((x) => String(x.bankId)));
    const added = [], skipped = [];
    for (const id of ids) {
      const q = byId.get(String(id));
      if (!q) { skipped.push({ id, reason: "not_found" }); continue; }
      if (q.status !== "active") { skipped.push({ id, reason: "archived" }); continue; }
      if (!q.usable) { skipped.push({ id, reason: "incomplete", problems: q.problems }); continue; }
      if (already.has(String(q._id))) { skipped.push({ id, reason: "already_in_exam" }); continue; }
      if (exam.questions.length + added.length >= MAX_EXAM_QUESTIONS) { skipped.push({ id, reason: "exam_full" }); continue; }
      const snap = bank.examSnapshot(plain(q));
      if (marks !== undefined && marks !== null) snap.marks = marks;
      added.push(snap);
      already.add(String(q._id));
    }
    if (added.length) { exam.questions.push(...added); await exam.save(); }
    res.status(added.length ? 201 : 200).json({ added: added.length, skipped, questionCount: exam.questions.length });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/bank/select : picks questions for an examination. READ-ONLY; the questions are only copied into an exam
// by the existing add-to-exam call, so what the administrator previews is exactly what gets built.
// Only questions that are active AND complete (usable) can ever be chosen; "verifiedOnly" narrows that further.
exports.select = async (req, res) => {
  try {
    const { subject, topics, count, manualIds, excludeIds, verifiedOnly, balanceTopics, difficulty } = req.body;
    const eligible = { status: "active", usable: true };
    if (verifiedOnly) eligible["verification.status"] = "verified";
    const filter = { ...eligible };
    if (subject) filter.subject = subject;
    const fields = "externalId subject topic difficulty extra text options marks verification";
    const [rows, manualRows] = await Promise.all([
      BankQuestion.find(filter).select(fields).limit(30000).lean(),
      manualIds.length ? BankQuestion.find({ ...eligible, _id: { $in: manualIds } }).select(fields).lean() : [],
    ]);
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    for (const m of manualRows) byId.set(String(m._id), m);
    const pool = [...byId.values()].map((r) => ({ id: String(r._id), topic: r.topic || "", difficulty: bank.difficultyOf(r), row: r }));

    const out = selectQuestions(pool, { count, topics, manualIds, excludeIds, balanceTopics, difficulty });
    const manualSet = new Set(manualIds.map(String));
    const view = out.picked.map(({ id, row }) => ({
      id, externalId: row.externalId || null, subject: row.subject || "", topic: row.topic || "", difficulty: bank.difficultyOf(row),
      text: (row.text || "").slice(0, 200), marks: row.marks ?? 1, optionCount: (row.options || []).length,
      verified: !!(row.verification && row.verification.status === "verified"), manual: manualSet.has(id),
      neighbour: dependsOnNeighbours(row), fixedOptions: !optionsShufflable(row),
    }));

    // What was available to choose from (within the subject and topic filter), so the screen can explain any shortfall.
    const scope = pool.filter((p) => (!topics.length || topics.map((t) => t.toLowerCase()).includes(p.topic.toLowerCase())) && (!subject || p.row.subject === subject));
    const topicCounts = {};
    for (const p of scope) topicCounts[p.topic || "(no topic)"] = (topicCounts[p.topic || "(no topic)"] || 0) + 1;
    const lvl = { easy: 0, medium: 0, hard: 0, unrated: 0 };
    for (const p of scope) lvl[p.difficulty || "unrated"]++;
    const verified = scope.filter((p) => p.row.verification && p.row.verification.status === "verified").length;

    res.json({
      questions: view, requested: count, selected: view.length, shortfall: out.shortfall, manualCount: out.manualCount,
      notes: out.notes, breakdown: out.breakdown, totalMarks: view.reduce((n, q) => n + q.marks, 0),
      available: { total: scope.length, byTopic: Object.entries(topicCounts).map(([name, n]) => ({ name, count: n })).sort((a, b) => a.name.localeCompare(b.name)), byDifficulty: lvl, verified, unverified: scope.length - verified },
      warnings: { unverified: view.filter((q) => !q.verified).length, neighbourDependent: view.filter((q) => q.neighbour).length, fixedOptions: view.filter((q) => q.fixedOptions).length },
    });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/bank/:id/propagate : copy the bank question's current content into exam snapshots.
// Only DRAFT exams with NO attempts are updated. Published or attempted exams are never touched, so no score can change.
exports.propagate = async (req, res) => {
  try {
    const q = await findOne(req, res);
    if (!q) return;
    if (!q.usable) return res.status(409).json({ error: "Finish this question (it still has problems) before copying it into exams." });
    const snap = bank.examSnapshot(plain(q));
    const exams = await Exam.find({ "questions.bankId": q._id });
    let updated = 0; const skipped = [];
    for (const exam of exams) {
      const locked = await lockedReason(exam);
      if (locked) { skipped.push({ examId: String(exam._id), title: exam.title, reason: exam.status === "published" ? "published" : "has_attempts" }); continue; }
      for (const eq of exam.questions) {
        if (String(eq.bankId) !== String(q._id)) continue;
        eq.set({ text: snap.text, options: snap.options, correctKey: snap.correctKey, marks: snap.marks, topic: snap.topic, explanation: snap.explanation, explanationSource: snap.explanationSource, bankVersion: snap.bankVersion });
      }
      await exam.save();
      updated++;
    }
    res.json({ updated, skipped });
  } catch (err) { serverError(res, err); }
};
