// The database query behind the student's list of examinations. It returns only what the list shows: the question COUNT
// (poolSize) and total MARKS (marks, the whole pool's) are worked out in the database, so the questions themselves (every
// option, explanation and image of every examination) are never loaded just to draw a list.
function listPipeline(now = new Date()) {
  return [
    { $match: { status: "published", $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] } },
    { $sort: { createdAt: -1 } },
    { $project: {
      title: 1, description: 1, subject: 1, level: 1, examType: 1, durationMinutes: 1, maxAttempts: 1,
      availableFrom: 1, availableUntil: 1, status: 1, questionsPerStudent: 1,
      poolSize: { $size: { $ifNull: ["$questions", []] } },
      marks: { $sum: { $map: { input: { $ifNull: ["$questions", []] }, as: "q", in: { $ifNull: ["$$q.marks", 1] } } } },
    } },
  ];
}

// The rows for the list. On a real database that is the query above. A stand-in without aggregate() (the tests' fake
// database) gets the same rows the earlier way, so those tests keep working unchanged.
async function listRows(Exam, now = new Date()) {
  if (typeof Exam.aggregate === "function") return Exam.aggregate(listPipeline(now));
  const exams = await Exam.find({ status: "published", $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] }).sort({ createdAt: -1 }).lean();
  return exams.map((e) => ({ ...e, poolSize: (e.questions || []).length, marks: (e.questions || []).reduce((t, q) => t + (q.marks ?? 1), 0) }));
}

module.exports = { listPipeline, listRows };
