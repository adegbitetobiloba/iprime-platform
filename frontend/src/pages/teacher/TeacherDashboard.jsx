import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { Async, Empty, PageHead, Pill, useTeacher } from "./ui.jsx";

const Stat = ({ to, value, label }) => (
  <Link className="tch-stat" to={to}><b>{value}</b><span>{label}</span></Link>
);

// Overview: real counts from the teacher's own records, and the students who may need a check-in.
export default function TeacherDashboard() {
  const me = useTeacher();
  const o = useFetch("/teacher/overview");
  const s = useFetch("/teacher/analytics/students");
  const checkIns = (s.data?.students || []).filter((x) => x.checkIn).slice(0, 6);
  const returned = o.data ? o.data.materials.returned + o.data.courses.returned + o.data.exams.returned : 0;

  return (
    <div className="admin-page">
      <PageHead eyebrow="Teacher area" title={`Welcome, ${me.firstName}`} />
      <Async state={o}>
        {o.data && (
          <>
            <div className="tch-stats">
              <Stat to="/teacher/students" value={o.data.students} label="Students you look after" />
              <Stat to="/teacher/library" value={o.data.materials.published} label="Published materials" />
              <Stat to="/teacher/courses" value={o.data.courses.total} label="Courses you created" />
              <Stat to="/teacher/exams" value={o.data.exams.total} label="Tests and mock exams" />
            </div>
            {returned > 0 && (
              <div className="alert alert-info" role="status">
                {returned} of your submissions {returned === 1 ? "was" : "were"} returned with notes. Open <Link to="/teacher/library">materials</Link>, <Link to="/teacher/courses">courses</Link> or <Link to="/teacher/exams">tests</Link> to see what to change.
              </div>
            )}
            {(o.data.materials.underReview + o.data.courses.underReview + o.data.exams.underReview) > 0 && (
              <p className="note">{o.data.materials.underReview + o.data.courses.underReview + o.data.exams.underReview} item(s) are waiting for an administrator to review.</p>
            )}
          </>
        )}
      </Async>

      <section className="panel">
        <h2 className="panel-title">Students who may need a check-in</h2>
        <Async state={s}>
          {o.data && o.data.students === 0 ? (
            <Empty>No students yet. An administrator gives you students directly, or a whole subject (for example, every Chemistry student).</Empty>
          ) : checkIns.length === 0 ? (
            <Empty>Nobody stands out right now. Open <Link to="/teacher/students">My students</Link> to see everyone.</Empty>
          ) : (
            <ul className="tch-list">
              {checkIns.map((st) => (
                <li key={st.id} className="tch-row">
                  <div><strong>{st.firstName} {st.lastName}</strong><small>{st.studentId} · average {st.averagePercentage ?? "–"}%</small></div>
                  <div className="tch-actions"><Pill tone="warn">Worth a check-in</Pill><Link className="btn btn-secondary" to={`/teacher/students/${st.id}`}>View</Link></div>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </section>

      <section className="panel">
        <h2 className="panel-title">Create something</h2>
        <div className="tch-actions">
          <Link className="btn btn-primary" to="/teacher/library/new">New library material</Link>
          <Link className="btn btn-secondary" to="/teacher/courses?new=1">New course</Link>
          <Link className="btn btn-secondary" to="/teacher/exams?new=1">New test or mock exam</Link>
        </div>
        <p className="muted">Everything you create starts as a draft. When it is ready, send it for review; an administrator publishes it.</p>
      </section>
    </div>
  );
}
