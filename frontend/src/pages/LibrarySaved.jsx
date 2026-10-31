import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";
import { TYPE_LABEL } from "../library/parts.jsx";
import "../library/library.css";

export default function LibrarySaved() {
  const { data, error, loading, reload } = useFetch("/library/bookmarks");
  return (
    <section className="section">
      <div className="container">
        <div className="page-bar"><div><p className="eyebrow">Library</p><h1>Saved lessons</h1></div><Link to="/library" className="btn btn-secondary">Back to Library</Link></div>
        {loading && <div className="exam-card skeleton" aria-hidden="true" />}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
        {data && data.bookmarks.length === 0 && <EmptyState icon="test" title="Nothing saved yet">Use the Save button on a lesson to keep it here.</EmptyState>}
        {data && data.bookmarks.length > 0 && (
          <ul className="lib-outline lib-panel">
            {data.bookmarks.map((b) => (
              <li key={b.lessonId}><Link className="lib-lesson-link" to={`/library/lessons/${b.lessonId}`}><span>{b.title}</span><span className="lib-type">{b.course.title} · {TYPE_LABEL[b.contentType]}</span></Link></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
