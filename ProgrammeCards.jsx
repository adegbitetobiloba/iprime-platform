import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import { useAuth } from "../auth.jsx";
import EmptyState from "./EmptyState.jsx";
import Reveal from "./Reveal.jsx";

const MODE = { physical: "In person", online: "Online", hybrid: "In person and online" };

// Programmes published by the institution through the admin area. Nothing here is hard-coded.
export default function ProgrammeCards({ limit, detailed = false }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch("/public/programmes");

  if (loading) {
    return <div className="programme-grid" aria-hidden="true">{[1, 2, 3].slice(0, limit || 3).map((n) => <div key={n} className="exam-card skeleton" />)}</div>;
  }
  if (error) {
    return <p className="alert alert-info" role="status">Programmes could not be loaded right now. <button type="button" className="link-btn" onClick={reload}>Try again</button></p>;
  }
  const items = (data?.programmes || []).slice(0, limit || undefined);
  if (items.length === 0) {
    return (
      <EmptyState icon="book" title="Programme details are being finalised"
        action={user?.role === "admin" ? <Link to="/admin/programmes" className="btn btn-primary">Add programmes</Link> : <Link to="/contact" className="btn btn-secondary">Contact the institution</Link>}>
        The classes, subjects and examination programmes offered by Prime Excelerate Tutelage will be listed here once they are confirmed.
      </EmptyState>
    );
  }
  return (
    <ul className="programme-grid">
      {items.map((p, i) => (
        <Reveal as="li" key={p.id} delay={i * 90}>
          <article className="programme-card card-hover">
            <div className="exam-tags">
              {p.audience && <span className="badge">{p.audience}</span>}
              {p.mode && <span className="badge badge-quiet">{MODE[p.mode]}</span>}
            </div>
            <h3>{p.title}</h3>
            {p.summary && <p className="muted">{p.summary}</p>}
            {detailed && p.description && <p>{p.description}</p>}
            {p.subjects?.length > 0 && (
              <ul className="chips" aria-label="Subjects">{p.subjects.map((s) => <li key={s}>{s}</li>)}</ul>
            )}
            {detailed && p.schedule && <p className="programme-schedule"><strong>Schedule:</strong> {p.schedule}</p>}
          </article>
        </Reveal>
      ))}
    </ul>
  );
}
