import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";
import { CourseCard, ProgressBar, TYPE_LABEL } from "../library/parts.jsx";
import "../library/library.css";

function Skeleton() {
  return <div className="lib-grid" aria-hidden="true">{[1, 2, 3].map((n) => <div key={n} className="exam-card skeleton" />)}</div>;
}

function Grid({ courses }) {
  return <ul className="lib-grid">{courses.map((c) => <CourseCard key={c.id} course={c} />)}</ul>;
}

function Section({ title, children, action }) {
  return (
    <section className="lib-section">
      <div className="lib-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export default function Library() {
  const { token, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject"), tag = params.get("tag"), difficulty = params.get("difficulty");
  const browsing = !!(subject || tag || difficulty);
  const qs = new URLSearchParams();
  if (subject) qs.set("subject", subject);
  if (tag) qs.set("tag", tag);
  if (difficulty) qs.set("difficulty", difficulty);
  const { data, error, loading, reload } = useFetch(browsing ? `/library/courses?${qs}` : "/library/home");

  const [q, setQ] = useState((params.get("q") || "").slice(0, 60)); // lets other pages (e.g. Performance) open the Library with a search
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); setSearchError(""); return undefined; }
    let off = false;
    setSearching(true);
    const t = setTimeout(() => {
      api(`/library/search?q=${encodeURIComponent(term)}`, { token })
        .then((d) => { if (!off) { setResults(d); setSearchError(""); } })
        .catch((e) => { if (!off) setSearchError(e.message); })
        .finally(() => { if (!off) setSearching(false); });
    }, 300);
    return () => { off = true; clearTimeout(t); };
  }, [q, token]);

  const clear = () => setParams({});
  const home = !browsing && data;
  const nothingYet = home && !data.featured.length && !data.recent.length && !data.continueLearning.length;

  return (
    <section className="section">
      <div className="container">
        <div className="lib-hero">
          <p className="eyebrow">Library</p>
          <h1>{user && user.firstName ? `Welcome, ${user.firstName}` : "Learn with iPrime"}</h1>
          <p className="muted">Courses, video lessons and practice, all in one place.</p>
          <form className="lib-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="lib-q" className="sr-only">Search courses and lessons</label>
            <input id="lib-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a subject, topic or lesson" autoComplete="off" maxLength={60} />
          </form>
        </div>

        <div className="lib-sr-live" aria-live="polite">{searching ? "Searching" : results ? `${results.courses.length} courses and ${results.lessons.length} lessons found` : ""}</div>

        {searchError && <p className="alert alert-error" role="alert">{searchError}</p>}
        {results && (
          <Section title={`Results for "${q.trim()}"`}>
            {results.courses.length === 0 && results.lessons.length === 0 && <p className="note">Nothing matched. Try a different word, or browse the subjects below.</p>}
            {results.courses.length > 0 && <Grid courses={results.courses} />}
            {results.lessons.length > 0 && (
              <>
                <h3 style={{ marginTop: 20 }}>Lessons</h3>
                <ul className="lib-outline">
                  {results.lessons.map((l) => (
                    <li key={l.id}><Link className="lib-lesson-link" to={`/library/lessons/${l.id}`}><span>{l.title}</span><span className="lib-type">{l.course.title} · {TYPE_LABEL[l.contentType]}</span></Link></li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        )}

        {!results && (
          <>
            {loading && <Skeleton />}
            {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}

            {browsing && data && (
              <Section title={subject ? "Subject" : tag ? tag : "Courses"} action={<button type="button" className="link-btn" onClick={clear}>Clear filter</button>}>
                {data.courses.length === 0 ? <EmptyState icon="test" title="No courses here yet">When a course is published for this filter, it will appear here.</EmptyState> : <Grid courses={data.courses} />}
              </Section>
            )}

            {nothingYet && <EmptyState icon="test" title="No courses are available yet">When Prime Excelerate Tutelage publishes a course, it will appear here.</EmptyState>}

            {home && (
              <>
                {data.continueLearning.length > 0 && (
                  <Section title="Continue learning">
                    <div className="lib-continue">
                      {data.continueLearning.map((c) => (
                        <div key={c.course.id} className="lib-card"><div className="lib-card-body">
                          <h3>{c.course.title}</h3>
                          <ProgressBar percent={c.progress.percent} label={`${c.course.title} progress`} />
                          <div className="lib-bar-label"><span>{c.progress.completed} of {c.progress.total} lessons</span><span>{c.progress.percent}%</span></div>
                          <Link className="btn btn-primary" to={`/library/lessons/${c.next.id}`}>Continue: {c.next.title}</Link>
                        </div></div>
                      ))}
                    </div>
                  </Section>
                )}

                {(data.subjects.length > 0 || data.examTags.length > 0) && (
                  <Section title="Browse">
                    {data.subjects.length > 0 && <ul className="lib-chips" aria-label="Subjects">{data.subjects.map((s) => <li key={s.id}><Link className="lib-chip" to={`/library?subject=${s.slug}`}>{s.name} <small>{s.courseCount}</small></Link></li>)}</ul>}
                    {data.examTags.length > 0 && <ul className="lib-chips" aria-label="Examination preparation" style={{ marginTop: 10 }}>{data.examTags.map((t) => <li key={t.tag}><Link className="lib-chip" to={`/library?tag=${encodeURIComponent(t.tag)}`}>{t.tag} preparation <small>{t.courseCount}</small></Link></li>)}</ul>}
                  </Section>
                )}

                {data.featured.length > 0 && <Section title="Featured courses"><Grid courses={data.featured} /></Section>}
                {data.recent.length > 0 && <Section title="Recently added"><Grid courses={data.recent} /></Section>}
                {data.popular.length > 0 && <Section title="Popular with students"><Grid courses={data.popular} /></Section>}

                {data.recentlyViewed.length > 0 && (
                  <Section title="Recently viewed" action={data.bookmarkCount > 0 ? <Link to="/library/saved" className="link-btn">Saved lessons ({data.bookmarkCount})</Link> : null}>
                    <ul className="lib-outline">
                      {data.recentlyViewed.map((l) => (
                        <li key={l.lessonId}><Link className="lib-lesson-link" to={`/library/lessons/${l.lessonId}`}><span className={`lib-dot${l.completed ? " done" : " started"}`} aria-hidden="true">{l.completed ? "✓" : ""}</span><span>{l.title}</span><span className="lib-type">{TYPE_LABEL[l.contentType]}</span></Link></li>
                      ))}
                    </ul>
                  </Section>
                )}
                {data.recentlyViewed.length === 0 && data.bookmarkCount > 0 && <p><Link to="/library/saved" className="link-btn">Saved lessons ({data.bookmarkCount})</Link></p>}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
