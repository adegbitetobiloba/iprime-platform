import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch } from "../useFetch.js";
import Markdown from "../library/Markdown.jsx";
import VideoPlayer from "../library/VideoPlayer.jsx";
import PdfViewer from "../library/PdfViewer.jsx";
import { CourseOutline, TYPE_LABEL } from "../library/parts.jsx";
import "../library/library.css";

// The course outline beside the lesson. Reloaded (outlineKey) when a lesson is completed so the tick appears.
function Outline({ slug, lessonId, version }) {
  const { data } = useFetch(`/library/courses/${slug}?v=${version}`);
  if (!data) return <p className="muted" aria-busy="true">Loading outline...</p>;
  return (
    <>
      <p className="lib-bar-label"><span>{data.progress.completed} of {data.progress.total} done</span><span>{data.progress.percent}%</span></p>
      <CourseOutline modules={data.modules} currentId={lessonId} />
    </>
  );
}

export default function LibraryLesson() {
  const { id } = useParams();
  const { token } = useAuth();
  const { data, error, loading, reload } = useFetch(`/library/lessons/${id}`);

  const [done, setDone] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [note, setNote] = useState("");
  const [noteMsg, setNoteMsg] = useState("");
  const [version, setVersion] = useState(0);
  const [practice, setPractice] = useState(null); // result of the knowledge check
  const [actionError, setActionError] = useState("");
  const doneRef = useRef(false);
  const endRef = useRef(null);
  const reachedRef = useRef(false);
  const preview = !!(data && data.preview);

  useEffect(() => {
    if (!data) return;
    doneRef.current = !!(data.progress && data.progress.completed);
    reachedRef.current = false;
    setDone(doneRef.current);
    setJustDone(false);
    setBookmarked(!!data.bookmarked);
    setNote(data.note || "");
    setNoteMsg("");
    setPractice(null);
    setActionError("");
    document.title = `${data.lesson.title} | iPrime`;
  }, [data]);

  const send = useCallback(async (body) => {
    if (!token || preview) return;
    try {
      const r = await api(`/library/lessons/${id}/progress`, { method: "PUT", token, body });
      if (r.completed && !doneRef.current) { doneRef.current = true; setDone(true); setJustDone(true); setVersion((v) => v + 1); }
    } catch { /* progress is best-effort: studying must never be interrupted by a failed save */ }
  }, [id, token, preview]);

  // Written lessons: count time only while the tab is visible, and note when the student reaches the end.
  const isText = data && data.lesson.contentType === "text";
  useEffect(() => {
    if (!isText || preview || doneRef.current) return undefined;
    let obs;
    if (endRef.current && "IntersectionObserver" in window) {
      obs = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !reachedRef.current) { reachedRef.current = true; send({ reachedEnd: true }); }
      });
      obs.observe(endRef.current);
    }
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || doneRef.current) return;
      send({ activeSecondsDelta: 10, ...(reachedRef.current ? { reachedEnd: true } : {}) });
    }, 10000);
    return () => { if (obs) obs.disconnect(); clearInterval(timer); };
  }, [isText, preview, send, id]);

  // Knowledge check: look up the student's own result on the linked practice exam (read only), once when the lesson opens.
  const check = useCallback(async () => {
    setActionError("");
    try {
      const r = await api(`/library/lessons/${id}/practice-check`, { method: "POST", token });
      setPractice(r);
      if (r.completed && !doneRef.current) { doneRef.current = true; setDone(true); setJustDone(true); setVersion((v) => v + 1); }
    } catch (e) { setActionError(e.message); }
  }, [id, token]);
  const hasPractice = !!(data && data.practice);
  useEffect(() => { if (hasPractice && !preview) check(); }, [hasPractice, preview, check]);

  const toggleBookmark = async () => {
    setActionError("");
    const next = !bookmarked;
    setBookmarked(next);
    try { await api(`/library/lessons/${id}/bookmark`, { method: next ? "POST" : "DELETE", token }); } catch (e) { setBookmarked(!next); setActionError(e.message); }
  };

  const saveNote = async () => {
    setNoteMsg("Saving...");
    try { await api(`/library/lessons/${id}/note`, { method: "PUT", token, body: { text: note } }); setNoteMsg("Saved"); } catch (e) { setNoteMsg(e.message); }
  };

  if (loading) return <section className="section"><div className="container"><div className="exam-card skeleton" aria-hidden="true" /></div></section>;
  if (error) return <section className="section"><div className="container"><div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div><p><Link to="/library">Back to Library</Link></p></div></section>;
  if (!data) return null;

  const { lesson, course } = data;
  const needsQuiz = lesson.requiresQuizPass && !done;

  return (
    <section className="section">
      <div className="container">
        <p className="lib-crumbs"><Link to="/library">Library</Link> › <Link to={`/library/courses/${course.slug}`}>{course.title}</Link>{lesson.moduleTitle ? ` › ${lesson.moduleTitle}` : ""}</p>
        {preview && <p className="alert" role="status">Preview: students cannot see this lesson yet, and nothing you do here is recorded.</p>}

        <div className="lib-lesson">
          <article>
            <p className="eyebrow">{TYPE_LABEL[lesson.contentType]}{lesson.topicTitle ? ` · ${lesson.topicTitle}` : ""}{lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ""}</p>
            <h1 style={{ marginTop: 4 }}>{lesson.title}</h1>

            {lesson.contentType === "video" && lesson.video && (
              <VideoPlayer key={lesson.id} video={lesson.video} startAt={data.progress ? data.progress.lastPositionSec : 0}
                onProgress={(pos, dur) => send({ videoDurationSec: dur, videoPositionSec: pos })} />
            )}
            {lesson.contentType === "video" && data.progress && data.progress.lastPositionSec > 5 && !done && (
              <p className="muted" style={{ marginTop: 8 }}>Resuming from where you stopped ({Math.floor(data.progress.lastPositionSec / 60)}:{String(Math.floor(data.progress.lastPositionSec % 60)).padStart(2, "0")}).</p>
            )}

            {lesson.contentType === "text" && <><Markdown text={lesson.body} /><div ref={endRef} aria-hidden="true" style={{ height: 1 }} /></>}

            {lesson.contentType === "link" && (
              <div className="lib-panel">
                <p>This lesson uses an outside resource. It opens in a new tab.</p>
                <a className="btn btn-secondary" href={lesson.externalUrl} target="_blank" rel="noopener noreferrer">Open the resource</a>
                {!done && !preview && <button type="button" className="btn btn-primary" style={{ marginLeft: 10 }} onClick={() => send({ markedDone: true })}>I have finished this</button>}
              </div>
            )}

            {lesson.contentType === "pdf" && (lesson.pdf && lesson.pdf.available
              ? <PdfViewer key={lesson.id} lessonId={lesson.id} token={token} startPage={data.progress ? data.progress.lastPage : 1} onPage={(pg, n) => send({ page: pg, pageCount: n })} />
              : <p className="note">No document has been attached to this lesson yet.</p>)}

            <div className="lib-actions">
              <span className={`lib-status${done ? " done" : ""}`} role="status">
                {done ? "✓ Lesson completed" : needsQuiz ? "Pass the practice quiz to complete this lesson" : lesson.contentType === "text" ? "Read to the end to complete" : lesson.contentType === "video" ? "Watch most of the video to complete" : lesson.contentType === "pdf" ? "Read to the last page to complete" : ""}
              </span>
              {!preview && <button type="button" className="btn btn-secondary btn-sm" aria-pressed={bookmarked} onClick={toggleBookmark}>{bookmarked ? "Saved" : "Save lesson"}</button>}
            </div>
            {justDone && <p className="alert alert-success" role="status">Well done. This lesson is marked complete.</p>}
            {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}

            {data.practice && (
              <aside className="lib-practice" aria-labelledby="practice-h">
                <h2 id="practice-h">Practise this topic</h2>
                <p>{data.practice.title} · {data.practice.questionCount} questions · {data.practice.durationMinutes} min{data.practice.topic ? ` · ${data.practice.topic}` : ""}</p>
                {practice && practice.attempted && <p role="status">Your best score: <strong>{Math.round(practice.bestPercentage)}%</strong>{practice.passed ? " (passed)" : ` (you need ${practice.passMark}% to pass)`}</p>}
                <div className="form-actions">
                  <Link className="btn btn-primary" to={`/exams/${data.practice.examId}`}>{practice && practice.attempted ? "Try again" : "Start practice"}</Link>
                  {!preview && <button type="button" className="btn btn-secondary" onClick={check}>Check my result</button>}
                </div>
              </aside>
            )}

            <nav className="lib-actions" aria-label="Lesson navigation">
              {data.prev ? <Link className="btn btn-secondary" to={`/library/lessons/${data.prev.id}`}>← {data.prev.title}</Link> : <span />}
              {data.next ? <Link className="btn btn-primary" to={`/library/lessons/${data.next.id}`}>{data.next.title} →</Link> : <Link className="btn btn-primary" to={`/library/courses/${course.slug}`}>Back to course</Link>}
            </nav>

            {!preview && (
              <div className="lib-notes lib-panel" style={{ marginTop: 24 }}>
                <label htmlFor="lib-note"><strong>My notes</strong> <span className="muted">(private, only you can see them)</span></label>
                <textarea id="lib-note" value={note} onChange={(e) => { setNote(e.target.value); setNoteMsg(""); }} onBlur={saveNote} maxLength={5000} />
                <p className="muted" role="status" style={{ margin: "6px 0 0" }}>{noteMsg}</p>
              </div>
            )}

            {data.related.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: "1.05rem" }}>More in this chapter</h2>
                <ul className="lib-outline">{data.related.map((r) => <li key={r.id}><Link className="lib-lesson-link" to={`/library/lessons/${r.id}`}><span>{r.title}</span><span className="lib-type">{TYPE_LABEL[r.contentType]}</span></Link></li>)}</ul>
              </div>
            )}
          </article>

          <aside className="lib-side lib-panel" aria-label="Course outline">
            <details open>
              <summary><strong>{course.title}</strong></summary>
              <div style={{ marginTop: 12 }}><Outline slug={course.slug} lessonId={lesson.id} version={version} /></div>
            </details>
          </aside>
        </div>
      </div>
    </section>
  );
}
