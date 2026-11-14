import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { Async, Empty, PageHead, StatusPill, Pill } from "./ui.jsx";

const KINDS = [["", "All kinds"], ["syllabus", "Syllabus"], ["textbook", "Textbook"], ["past-questions", "Past questions"], ["notes", "Notes"], ["other", "Other"]];
const reviewOf = (m) => (m.underReview ? { status: "pending" } : m.review && m.review.returnedAt ? { status: "returned", note: m.review.note } : undefined);

// Your own materials (drafts, submitted, published) and the whole published library for reference.
export default function TeacherLibrary() {
  const [tab, setTab] = useState("mine");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [subject, setSubject] = useState("");
  const mine = useFetch("/teacher/library/mine");
  const subjects = useFetch("/teacher/library/subjects");
  const params = new URLSearchParams();
  if (q.trim().length >= 2) params.set("q", q.trim());
  if (kind) params.set("kind", kind);
  if (subject) params.set("subject", subject);
  const browse = useFetch(`/teacher/library/materials${params.toString() ? `?${params}` : ""}`);

  return (
    <div className="admin-page">
      <PageHead eyebrow="Teacher area" title="Library materials">
        <Link className="btn btn-primary" to="/teacher/library/new">New material</Link>
      </PageHead>
      <div className="tch-tabs" role="group" aria-label="Library view">
        <button type="button" className="tch-tab" aria-pressed={tab === "mine"} onClick={() => setTab("mine")}>My materials</button>
        <button type="button" className="tch-tab" aria-pressed={tab === "browse"} onClick={() => setTab("browse")}>Browse the library</button>
      </div>

      {tab === "mine" && (
        <Async state={mine}>
          {mine.data && mine.data.materials.length === 0 ? (
            <Empty>You have not created any material yet. Notes, syllabus pages, past questions and links all start here.</Empty>
          ) : (
            <ul className="tch-list">
              {(mine.data?.materials || []).map((m) => (
                <li key={m.id} className="tch-row">
                  <div>
                    <strong>{m.title}</strong>
                    <small>{m.kind} · {m.source}{m.subject ? ` · ${m.subject.name}` : ""}</small>
                    {m.review && m.review.returnedAt && !m.underReview && m.review.note && <div className="tch-note">Returned: {m.review.note}</div>}
                  </div>
                  <div className="tch-actions">
                    <StatusPill status={m.status} review={reviewOf(m)} />
                    <Link className="btn btn-secondary" to={`/teacher/library/${m.id}`}>{m.status === "draft" && !m.underReview ? "Edit" : "Open"}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Async>
      )}

      {tab === "browse" && (
        <>
          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <input type="search" aria-label="Search the library" placeholder="Search by title or author" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="grid-2">
              <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">All subjects</option>
                {(subjects.data?.subjects || []).map((s) => <option key={s._id} value={s.slug}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <Async state={browse}>
            {browse.data && browse.data.materials.length === 0 ? <Empty>Nothing matches.</Empty> : (
              <ul className="tch-list">
                {(browse.data?.materials || []).map((m) => (
                  <li key={m.id} className="tch-row">
                    <div><strong>{m.title}</strong><small>{m.kind}{m.subject ? ` · ${m.subject.name}` : ""}{m.author ? ` · ${m.author}` : ""}</small></div>
                    <div className="tch-actions">{m.featured && <Pill tone="info">Featured</Pill>}<Link className="btn btn-secondary" to={`/teacher/library/${m.id}`}>Open</Link></div>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </>
      )}
    </div>
  );
}
