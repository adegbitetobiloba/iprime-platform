// Library study activity for the progress report, from GET /api/library/me/summary. Pure and dependency-free.
// Returns null when there is no real activity, so the report simply leaves the section out.
export function summariseLibrary(summary) {
  if (!summary) return null;
  const courses = (summary.courses || []).filter((c) => c.total > 0);
  const active = (summary.lessonsCompleted || 0) > 0 || (summary.studyMinutes || 0) > 0 || courses.length > 0;
  if (!active) return null;
  return {
    lessonsCompleted: summary.lessonsCompleted || 0,
    coursesStarted: summary.coursesStarted || 0,
    coursesCompleted: summary.coursesCompleted || 0,
    studyMinutes: summary.studyMinutes || 0,
    courses: courses.slice(0, 4).map((c) => ({ id: c.id, slug: c.slug, title: c.title, completed: c.completed, total: c.total, percent: c.percent })),
  };
}
