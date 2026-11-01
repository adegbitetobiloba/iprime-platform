// Per-student Library study overview for staff. Pure: merges the student list with their aggregated Library progress.
// Rules: students with no Library records are listed as "not started yet" (never as a failure); "quiet" means no
// Library activity for QUIET_DAYS or more. Names are limited to first name, last name and student ID.
const QUIET_DAYS = 14;
const DAY = 24 * 3600 * 1000;
const toMs = (v) => (v ? new Date(v).getTime() : NaN);
const idOf = (v) => (v == null ? "" : String(v));

function statusFor(lastActiveAt, now) {
  const t = toMs(lastActiveAt);
  if (Number.isNaN(t)) return "not_started";
  return now.getTime() - t >= QUIET_DAYS * DAY ? "quiet" : "active";
}

// students: [{ _id, firstName, lastName, studentId }]  rows: aggregated per user (see controller)
function buildLibraryStudy({ students = [], rows = [], now = new Date() }) {
  const byUser = new Map(rows.map((r) => [idOf(r._id), r]));
  const list = students.map((s) => {
    const r = byUser.get(idOf(s._id));
    return {
      userId: idOf(s._id),
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "Student",
      studentId: s.studentId || null,
      lessonsOpened: r?.opened || 0,
      lessonsCompleted: r?.completed || 0,
      studyMinutes: Math.round(((r?.seconds || 0) + (r?.watched || 0)) / 60),
      coursesStarted: r?.courses || 0,
      lastActiveAt: r?.lastActiveAt || null,
      status: statusFor(r?.lastActiveAt, now),
    };
  });
  const order = { active: 0, quiet: 1, not_started: 2 };
  list.sort((a, b) => order[a.status] - order[b.status] || toMs(b.lastActiveAt) - toMs(a.lastActiveAt) || a.name.localeCompare(b.name));
  const count = (st) => list.filter((x) => x.status === st).length;
  return {
    definitions: { quietDays: QUIET_DAYS },
    totals: { students: list.length, active: count("active"), quiet: count("quiet"), notStarted: count("not_started"), lessonsCompleted: list.reduce((s, x) => s + x.lessonsCompleted, 0), studyMinutes: list.reduce((s, x) => s + x.studyMinutes, 0) },
    students: list,
  };
}

module.exports = { buildLibraryStudy, statusFor, QUIET_DAYS };
