import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";
import Countdown from "../library/Countdown.jsx";
import { CourseCard, MaterialCard } from "../library/parts.jsx";
import "../library/library.css";

function Shelf({ title, hint, items, empty, more }) {
  return (
    <section className="lib-section">
      <div className="lib-head"><h2>{title}</h2>{more}</div>
      {hint && <p className="muted" style={{ marginTop: -8 }}>{hint}</p>}
      {items.length === 0 ? <p className="note">{empty}</p> : <ul className="lib-grid">{items}</ul>}
    </section>
  );
}

export default function LibraryUtme() {
  const hub = useFetch("/library/hub");
  const exams = useFetch("/exams"); // the existing examination centre: published practice and past-question exams
  const d = hub.data;
  const examList = exams.data ? exams.data.exams : [];
  const bySubject = examList.reduce((acc, e) => { (acc[e.subject] = acc[e.subject] || []).push(e); return acc; }, {});

  return (
    <section className="section">
      <div className="container">
        <p className="lib-crumbs"><Link to="/library">Library</Link> › UTME</p>
        <h1>UTME preparation</h1>
        <p className="muted">Everything for JAMB in one place: how long you have, what to study, and what to practise.</p>

        {hub.loading && <div className="exam-card skeleton" aria-hidden="true" />}
        {hub.error && <div className="alert alert-error" role="alert">{hub.error} <button type="button" className="link-btn" onClick={hub.reload}>Try again</button></div>}

        {d && (
          <>
            {d.countdown ? <Countdown countdown={d.countdown} plan={d.plan} /> : <p className="note">The exam countdown will appear here once the date is set.</p>}

            <Shelf title="Syllabus" hint="What JAMB expects you to know in each subject." empty="The UTME syllabus will be added soon."
              items={d.syllabus.map((m) => <MaterialCard key={m.id} m={m} />)} />

            <section className="lib-section">
              <div className="lib-head"><h2>UTME courses</h2></div>
              {d.courses.length === 0 ? <p className="note">UTME courses will appear here when they are published.</p>
                : <ul className="lib-grid">{d.courses.map((r) => <CourseCard key={r.course.id} course={r.course} progress={r.progress.completed > 0 ? r.progress : undefined} />)}</ul>}
            </section>

            <Shelf title="Textbooks" hint="Recommended reading. Some open on other websites." empty="Recommended textbooks will be added soon."
              items={d.textbooks.map((m) => <MaterialCard key={m.id} m={m} />)} />

            <Shelf title="Past questions" empty="Past-question papers will be added soon." items={d.pastQuestions.map((m) => <MaterialCard key={m.id} m={m} />)} />

            <section className="lib-section">
              <div className="lib-head"><h2>Practise with timed exams</h2><Link to="/exams" className="link-btn">All examinations</Link></div>
              {exams.loading && <div className="exam-card skeleton" aria-hidden="true" />}
              {exams.data && examList.length === 0 && <EmptyState icon="test" title="No practice exams yet">When an examination is published for you, it appears here.</EmptyState>}
              {Object.keys(bySubject).sort().map((subject) => (
                <div key={subject} style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: "1rem", margin: "0 0 6px" }}>{subject}</h3>
                  <ul className="lib-outline lib-panel">
                    {bySubject[subject].map((e) => (
                      <li key={e.id}><Link className="lib-lesson-link" to={`/exams/${e.id}`}><span>{e.title}</span><span className="lib-type">{e.questionCount} questions · {e.durationMinutes} min</span></Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {d.notes.length > 0 && <Shelf title="Study notes" items={d.notes.map((m) => <MaterialCard key={m.id} m={m} />)} empty="" />}
          </>
        )}
      </div>
    </section>
  );
}
