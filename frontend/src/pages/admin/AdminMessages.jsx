import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { Thread, Composer, mergeMessages, usePolling } from "../../components/MessageThread.jsx";

const short = (at) => { const d = new Date(at); if (!at || Number.isNaN(d.getTime())) return ""; return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }); };

export default function AdminMessages() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const sid = params.get("student") || "";
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [list, setList] = useState({ loading: true, error: "", items: [] });
  const [t, setT] = useState({ sid: "", loading: false, error: "", student: null, messages: [], hasMore: false });
  const [attempts, setAttempts] = useState([]);
  const [attach, setAttach] = useState("");
  const [sendError, setSendError] = useState("");
  const [older, setOlder] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);

  const loadList = useCallback(async () => {
    try {
      const d = await api(`/admin/messages/conversations${unreadOnly ? "?unread=1" : ""}`, { token });
      setList({ loading: false, error: "", items: d.conversations });
    } catch (e) { setList((p) => ({ ...p, loading: false, error: e.message })); }
  }, [token, unreadOnly]);
  usePolling(loadList, 20000);

  const loadThread = useCallback(async () => {
    if (!sid) return;
    try {
      const d = await api(`/admin/messages/students/${sid}`, { token });
      setT((p) => ({ sid, loading: false, error: "", student: d.student, messages: p.sid === sid ? mergeMessages(p.messages, d.messages) : d.messages, hasMore: p.sid === sid && p.messages.length > 50 ? p.hasMore : d.hasMore }));
      if (d.unread > 0) api(`/admin/messages/students/${sid}/read`, { method: "POST", token }).then(loadList).catch(() => {});
    } catch (e) { setT((p) => ({ ...p, sid, loading: false, error: e.message })); }
  }, [sid, token, loadList]);
  usePolling(loadThread, 15000);

  useEffect(() => {
    setAttach(""); setSendError(""); setAttempts([]);
    if (!sid) return;
    setT((p) => (p.sid === sid ? p : { sid, loading: true, error: "", student: null, messages: [], hasMore: false }));
    api(`/admin/messages/students/${sid}/attempts`, { token }).then((d) => setAttempts(d.attempts || [])).catch(() => {});
  }, [sid, token]);

  // Find a student to start a conversation with (waits a moment after typing)
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return undefined; }
    const h = setTimeout(() => api(`/admin/messages/students?search=${encodeURIComponent(q.trim())}`, { token }).then((d) => setFound(d.students || [])).catch(() => setFound([])), 300);
    return () => clearTimeout(h);
  }, [q, token]);

  const open = (id) => { setParams({ student: id }); setQ(""); setFound([]); };
  const loadOlder = async () => {
    const first = t.messages[0];
    if (!first) return;
    setOlder(true);
    try {
      const d = await api(`/admin/messages/students/${sid}?before=${first.id}`, { token });
      setT((p) => ({ ...p, messages: mergeMessages(p.messages, d.messages), hasMore: d.hasMore }));
    } catch (e) { setT((p) => ({ ...p, error: e.message })); }
    setOlder(false);
  };
  const send = async (text) => {
    setSendError("");
    try {
      const d = await api(`/admin/messages/students/${sid}`, { method: "POST", token, body: { body: text, ...(attach ? { attemptId: attach } : {}) } });
      setT((p) => ({ ...p, messages: mergeMessages(p.messages, [d.message]) }));
      setAttach(""); loadList();
      return true;
    } catch (e) { setSendError(e.message); return false; }
  };

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Communication</p><h1>Messages</h1><p>Message a student directly, or comment on one of their results. Students can only write to the administration team, never to each other.</p></div></header>
      <div className={`msg-split${sid ? " has-thread" : ""}`}>
        <div className="msg-side">
          <div className="msg-search">
            <label htmlFor="msg-find"><strong>Start a conversation</strong></label>
            <input id="msg-find" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a student by name or ID" autoComplete="off" />
            {found.length > 0 && <ul className="msg-results" aria-label="Matching students">{found.map((s) => <li key={s.id}><button type="button" onClick={() => open(s.id)}>{s.name}{s.studentId ? ` · ${s.studentId}` : ""}</button></li>)}</ul>}
            {q.trim().length >= 2 && found.length === 0 && <p className="muted" style={{ margin: 0 }}>No students match.</p>}
          </div>
          <div className="adm-tabs" role="group" aria-label="Filter conversations" style={{ margin: 0 }}>
            <button type="button" className="adm-tab" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button>
            <button type="button" className="adm-tab" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread</button>
          </div>
          {list.error && <p className="alert alert-error" role="alert">{list.error}</p>}
          {list.loading && <div className="exam-card skeleton" aria-hidden="true" />}
          {!list.loading && list.items.length === 0 && !list.error && <EmptyState icon="user" title={unreadOnly ? "Nothing unread" : "No conversations yet"}>{unreadOnly ? "Every message has been opened." : "Search for a student above to send the first message."}</EmptyState>}
          <ul className="msg-list" aria-label="Conversations">
            {list.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="msg-conv" aria-current={sid === c.studentId ? "true" : undefined} onClick={() => open(c.studentId)}>
                  <span className="msg-conv-top"><span className="msg-conv-name">{c.student ? c.student.name : "Unknown student"}</span><span className="msg-time">{short(c.lastMessageAt)}</span></span>
                  <span className="msg-conv-top"><span className="msg-conv-preview">{c.lastSenderRole === "admin" ? "You: " : ""}{c.preview}</span>{c.unread > 0 && <span className="msg-unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {sid ? (
          <section className="msg-pane" aria-label="Conversation">
            <div className="msg-pane-head">
              <h2>{t.student ? t.student.name : "Conversation"}{t.student && t.student.studentId ? <span className="muted" style={{ fontWeight: 600 }}> · {t.student.studentId}</span> : null}</h2>
              <button type="button" className="btn btn-secondary btn-sm msg-back" onClick={() => setParams({})}>Back to list</button>
            </div>
            {t.error && <p className="alert alert-error" role="alert">{t.error}</p>}
            {t.loading ? <div className="exam-card skeleton" aria-hidden="true" /> : <Thread messages={t.messages} viewer="admin" hasMore={t.hasMore} onLoadOlder={loadOlder} loadingOlder={older} emptyText="No messages yet. Write the first one below." />}
            {!t.error && (
              <Composer onSend={send} error={sendError} label="Your message" placeholder="Write to the student">
                <div className="msg-attach">
                  <label htmlFor="msg-attach"><strong>Comment on a result (optional)</strong></label>
                  <select id="msg-attach" value={attach} onChange={(e) => setAttach(e.target.value)}>
                    <option value="">No result attached</option>
                    {attempts.map((a) => <option key={a.id} value={a.id}>{a.examTitle} · {a.score}/{a.totalMarks} ({Math.round(a.percentage)}%) · {short(a.submittedAt)}</option>)}
                  </select>
                  {attempts.length === 0 && <p className="muted" style={{ margin: "4px 0 0" }}>This student has no submitted results yet.</p>}
                </div>
              </Composer>
            )}
          </section>
        ) : (
          <div className="msg-pane msg-desktop-only"><EmptyState icon="user" title="Choose a conversation">Pick a student on the left, or search for one to start a conversation.</EmptyState></div>
        )}
      </div>
    </div>
  );
}
