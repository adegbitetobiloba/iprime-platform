import { Link, useParams } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import { CourseOutline, LEVEL_LABEL, ProgressBar, minutesLabel } from "../library/parts.jsx";
import "../library/library.css";

export default function LibraryCourse() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useFetch(`/library/courses/${slug}`);

  return (
    <section className="section">
      <div className="container">
        <p className="lib-crumbs"><Link to="/library">Library</Link>{data && data.course.subject ? <> › <Link to={`/library?subject=${data.course.subject.slug}`}>{data.course.subject.name}</Link></> : null}</p>
        {loading && <div className="exam-card skeleton" aria-hidden="true" />}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
        {data && (
          <div className="lib-course">
            <div>
              {data.course.preview && <p className="alert" role="status">Preview: this course is not published, so students cannot see it yet.</p>}
              <h1>{data.course.title}</h1>
              <div className="lib-meta" style={{ margin: "8px 0 16px" }}>
                <span>{LEVEL_LABEL[data.course.difficulty]}</span>
                <span>{data.course.lessonCount} lessons</span>
                {data.course.estimatedMinutes > 0 && <span>About {minutesLabel(data.course.estimatedMinutes)}</span>}
                {(data.course.examTags || []).map((t) => <span key={t} className="badge badge-quiet">{t}</span>)}
              </div>
              {data.course.description && <p>{data.course.description}</p>}
              {data.course.objectives && data.course.objectives.length > 0 && (
                <div className="lib-panel" style={{ marginTop: 16 }}>
                  <h2 style={{ fontSize: "1.05rem", margin: 0 }}>What you will learn</h2>
                  <ul className="lib-objectives">{data.course.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </div>
              )}
              <div className="lib-panel" style={{ marginTop: 16 }}>
                <h2 style={{ fontSize: "1.05rem", margin: "0 0 12px" }}>Course content</h2>
                {data.modules.length === 0 ? <p className="note">This course has no lessons yet.</p> : <CourseOutline modules={data.modules} />}
              </div>
            </div>
            <aside className="lib-panel" aria-label="Your progress">
              <h2 style={{ fontSize: "1.05rem", margin: "0 0 10px" }}>Your progress</h2>
              <ProgressBar percent={data.progress.percent} />
              <p className="lib-bar-label" style={{ marginTop: 6 }}><span>{data.progress.completed} of {data.progress.total} lessons completed</span><span>{data.progress.percent}%</span></p>
              {data.next
                ? <Link className="btn btn-primary btn-block" style={{ marginTop: 14 }} to={`/library/lessons/${data.next.id}`}>{data.progress.completed > 0 || data.enrolled ? "Continue" : "Start course"}: {data.next.title}</Link>
                : data.progress.total > 0 && <p className="lib-status done" style={{ marginTop: 14 }}>You have completed this course.</p>}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
