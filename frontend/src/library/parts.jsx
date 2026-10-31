import { Link } from "react-router-dom";

export const TYPE_LABEL = { text: "Reading", video: "Video", pdf: "Document", link: "Resource" };
export const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export function minutesLabel(m) {
  if (!m) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function ProgressBar({ percent = 0, label }) {
  return (
    <div>
      <div className="lib-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label || "Course progress"}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function CourseCard({ course, progress }) {
  return (
    <li className="lib-card">
      <Link className="lib-card-link" to={`/library/courses/${course.slug}`}>
        <div className="lib-cover" aria-hidden="true">
          {course.coverImageUrl ? <img src={course.coverImageUrl} alt="" loading="lazy" /> : <span>{course.subject ? course.subject.name : "Course"}</span>}
        </div>
        <div className="lib-card-body">
          <div className="exam-tags">
            {course.subject && <span className="badge">{course.subject.name}</span>}
            {(course.examTags || []).slice(0, 2).map((t) => <span key={t} className="badge badge-quiet">{t}</span>)}
          </div>
          <h3>{course.title}</h3>
          <div className="lib-meta">
            <span>{LEVEL_LABEL[course.difficulty]}</span>
            <span>{course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}</span>
            {course.estimatedMinutes > 0 && <span>{minutesLabel(course.estimatedMinutes)}</span>}
          </div>
          {progress && (
            <>
              <ProgressBar percent={progress.percent} label={`${course.title} progress`} />
              <div className="lib-bar-label"><span>{progress.completed} of {progress.total} done</span><span>{progress.percent}%</span></div>
            </>
          )}
        </div>
      </Link>
    </li>
  );
}

// The chapter and lesson list used on the course page and beside a lesson.
export function CourseOutline({ modules, currentId }) {
  return (
    <ol className="lib-outline">
      {modules.map((m) => (
        <li key={m.id}>
          <h3>{m.title}</h3>
          <ul className="lib-outline" style={{ padding: 0 }}>
            {m.lessons.map((l, idx) => {
              const prevTopic = idx > 0 ? m.lessons[idx - 1].topicId : undefined;
              const topic = l.topicId && l.topicId !== prevTopic ? m.topics.find((t) => t.id === l.topicId) : null;
              return (
                <li key={l.id}>
                  {topic && <p className="lib-topic">{topic.title}</p>}
                  <Link className="lib-lesson-link" to={`/library/lessons/${l.id}`} aria-current={currentId === l.id ? "page" : undefined}>
                    <span className={`lib-dot${l.completed ? " done" : l.started ? " started" : ""}`} aria-hidden="true">{l.completed ? "✓" : ""}</span>
                    <span>{l.title}<span className="sr-only">{l.completed ? " (completed)" : l.started ? " (in progress)" : ""}</span></span>
                    <span className="lib-type">{TYPE_LABEL[l.contentType]}{l.estimatedMinutes ? ` · ${l.estimatedMinutes} min` : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
