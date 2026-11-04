import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Dialog from "../../components/Dialog.jsx";
import Field from "../../components/Field.jsx";
import { Thread, Composer, mergeMessages, usePolling } from "../../components/MessageThread.jsx";
import { downloadFile, uploadFile, useLiveStream } from "../../lib/liveMessages.js";

const short = (at) => { const d = new Date(at); if (!at || Number.isNaN(d.getTime())) return ""; return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }); };
const VIEWS = [["", "All"], ["unread", "Unread"], ["mine", "Mine"], ["unassigned", "Unassigned"]];

export default function AdminMessages() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const sid = params.get("student") || "";
  const [view, setView] = useState("");
  const [list, setList] = useState({ loading: true, error: "", items: [] });
  const [t, setT] = useState({ sid: "", loading: false, error: "", student: null, messages: [], hasMore: false, assignedName: "", assignedToMe: false, blocked: false, blockedReason: "" });
  const [attempts, setAttempts] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [attach, setAttach] = useState("");
  const [sendError, setSendError] = useState("");
  const [older, setOlder] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [words, setWords] = useState("");
  const [hits, setHits] = useState(null);
  const [blockAsk, setBlockAsk] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ ok: "", err: "" });

  const query = () => (view === "unread" ? "?unread=1" : view === "mine" ? "?assigned=me" : view === "unassigned" ? "?assigned=unassigned" : "");
  const loadList = useCallback(async () => {
    try {
      const d = await api(`/admin/messages/conversations${query()}`, { token });
      setList({ loading: false, error: "", items: d.conversations });
    } catch (e) { setList((p) => ({ ...p, loading: false, error: e.message })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, view]);
  usePolling(loadList, 60000);

  const markRead = useCallback(() => api(`/admin/messages/students/${sid}/read`, { method: "POST", token }).then(loadList).catch(() => {}), [sid, token, loadList]);
  const loadThread = useCallback(async () => {
    if (!sid) return;
    try {
      const d = await api(`/admin/messages/students/${sid}`, { token });
      setT((p) => ({ sid, loading: false, error: "", student: d.student, messages: p.sid === sid ? mergeMessages(p.messages, d.messages) : d.messages, hasMore: p.sid === sid && p.messages.length > 50 ? p.hasMore : d.hasMore, assignedName: d.assignedName || "", assignedToMe: d.assignedToMe, blocked: d.blocked, blockedReason: d.blockedReason || "" }));
      if (d.unread > 0) markRead();
    } catch (e) { setT((p) => ({ ...p, sid, loading: false, error: e.message })); }
  }, [sid, token, markRead]);
  usePolling(loadThread, 60000);

  // Instant delivery: every administrator's open page hears about new student messages at once
  useLiveStream("/admin/messages/stream", token, (ev) => {
    loadList();
    if (ev.type === "message" && ev.studentId === sid) { setT((p) => (p.sid === sid ? { ...p, messages: mergeMessages(p.messages, [ev.message]) } : p)); if (ev.message.from === "student") markRead(); }
    if (ev.type === "conversation" && ev.studentId === sid) loadThread();
  });

  useEffect(() => {
    setAttach(""); setSendError(""); setAttempts([]); setNote({ ok: "", err: "" });
    if (!sid) return;
    setT((p) => (p.sid === sid ? p : { sid, loading: true, error: "", student: null, messages: [], hasMore: false, assignedName: "", assignedToMe: false, blocked: false, blockedReason: "" }));
    api(`/admin/messages/students/${sid}/attempts`, { token }).then((d) => setAttempts(d.attempts || [])).catch(() => {});
  }, [sid, token]);
  useEffect(() => { api("/admin/messages/admins", { token }).then((d) => setAdmins(d.admins || [])).catch(() => {}); }, [token]);

  useEffect(() => { // find a student to start a conversation with
    if (q.trim().length < 2) { setFound([]); return undefined; }
    const h = setTimeout(() => api(`/admin/messages/students?search=${encodeURIComponent(q.trim())}`, { token }).then((d) => setFound(d.students || [])).catch(() => setFound([])), 300);
    return () => clearTimeout(h);
  }, [q, token]);
  useEffect(() => { // search inside messages
    if (words.trim().length < 3) { setHits(null); return undefined; }
    const h = setTimeout(() => api(`/admin/messages/search?q=${encodeURIComponent(words.trim())}`, { token }).then((d) => setHits(d.results || [])).catch(() => setHits([])), 350);
    return () => clearTimeout(h);
  }, [words, token]);

  const open = (id) => { setParams({ student: id }); setQ(""); setFound([]); setWords(""); setHits(null); };
  const loadOlder = async () => {
    const first = t.messages[0];
    if (!first) return;
    setOlder(true);
    try { const d = await api(`/admin/messages/students/${sid}?before=${first.id}`, { token }); setT((p) => ({ ...p, messages: mergeMessages(p.messages, d.messages), hasMore: d.hasMore })); } catch (e) { setT((p) => ({ ...p, error: e.message })); }
    setOlder(false);
  };
  const send = async (text, fileIds) => {
    setSendError("");
    try {
      const d = await api(`/admin/messages/students/${sid}`, { method: "POST", token, body: { body: text, ...(fileIds.length ? { fileIds } : {}), ...(attach ? { attemptId: attach } : {}) } });
      setT((p) => ({ ...p, messages: mergeMessages(p.messages, [d.message]) }));
      setAttach(""); loadList();
      return true;
    } catch (e) { setSendError(e.message); return false; }
  };
  const assign = async (adminId) => {
    setNote({ ok: "", err: "" });
    try { await api(`/admin/messages/students/${sid}/assign`, { method: "POST", token, body: { adminId: adminId || null } }); await loadThread(); loadList(); } catch (e) { setNote({ ok: "", err: e.message }); }
  };
  const block = async (on) => {
    setBusy(true); setNote({ ok: "", err: "" });
    try {
      await api(`/admin/messages/students/${sid}/${on ? "block" : "unblock"}`, { method: "POST", token, body: on ? { reason: reason.trim() } : {} });
      setBlockAsk(false); setReason(""); setNote({ ok: on ? "Messaging is now off for this student." : "Messaging is back on.", err: "" }); await loadThread(); loadList();
    } catch (e) { setNote({ ok: "", err: e.message }); }
    setBusy(false);
  };
  const openFile = (a) => downloadFile(`/admin/messages/files/${a.id}`, token, a.name).catch((e) => setNote({ ok: "", err: e.message }));

  const assignedValue = t.assignedToMe ? "me" : admins.find((a) => a.name.startsWith(t.assignedName) && t.assignedName)?.id || "";

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Communication</p><h1>Messages</h1><p>Message a student directly, or comment on one of their results. Students can only write to the administration team, never to each other. <span className="msg-live">New messages appear instantly.</span></p></div></header>
      <div className={`msg-split${sid ? " has-thread" : ""}`}>
        <div className="msg-side">
          <div className="msg-search">
            <label htmlFor="msg-find"><strong>Start a conversation</strong></label>
            <input id="msg-find" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a student by name or ID" autoComplete="off" />
            {found.length > 0 && <ul className="msg-results" aria-label="Matching students">{found.map((s) => <li key={s.id}><button type="button" onClick={() => open(s.id)}>{s.name}{s.studentId ? ` · ${s.studentId}` : ""}</button></li>)}</ul>}
            {q.trim().length >= 2 && found.length === 0 && <p className="muted" style={{ margin: 0 }}>No students match.</p>}
          </div>
          <div className="msg-search">
            <label htmlFor="msg-words"><strong>Search the messages</strong></label>
            <input id="msg-words" type="search" value={words} onChange={(e) => setWords(e.target.value)} placeholder="Words in a message (3 or more letters)" autoComplete="off" />
            {hits && hits.length === 0 && <p className="muted" style={{ margin: 0 }}>No messages contain that.</p>}
            {hits && hits.length > 0 && <ul className="msg-list" aria-label="Matching messages">{hits.map((h) => <li key={h.id}><button type="button" className="msg-hit" onClick={() => h.studentId && open(h.studentId)}><strong>{h.studentName}</strong><span>{h.snippet}</span><small>{h.from === "admin" ? "Team" : "Student"} · {short(h.at)}</small></button></li>)}</ul>}
          </div>
          <div className="adm-tabs" role="group" aria-label="Filter conversations" style={{ margin: 0 }}>
            {VIEWS.map(([k, label]) => <button key={label} type="button" className="adm-tab" aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>)}
          </div>
          {list.error && <p className="alert alert-error" role="alert">{list.error}</p>}
          {list.loading && <div className="exam-card skeleton" aria-hidden="true" />}
          {!list.loading && list.items.length === 0 && !list.error && <EmptyState icon="user" title={view ? "Nothing here" : "No conversations yet"}>{view ? "No conversations match this view." : "Search for a student above to send the first message."}</EmptyState>}
          <ul className="msg-list" aria-label="Conversations">
            {list.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="msg-conv" aria-current={sid === c.studentId ? "true" : undefined} onClick={() => open(c.studentId)}>
                  <span className="msg-conv-top"><span className="msg-conv-name">{c.student ? c.student.name : "Unknown student"}</span><span className="msg-time">{short(c.lastMessageAt)}</span></span>
                  <span className="msg-conv-top"><span className="msg-conv-preview">{c.lastSenderRole === "admin" ? "You: " : ""}{c.preview}</span>{c.unread > 0 && <span className="msg-unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}</span>
                  {(c.assignedName || c.blocked) && <span className="msg-conv-top"><span>{c.assignedName ? <span className="msg-flag">{c.assignedToMe ? "Yours" : c.assignedName}</span> : null}{c.blocked ? <span className="msg-flag" style={{ marginLeft: 6 }}>Messaging off</span> : null}</span></span>}
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
            <div className="msg-tools" style={{ marginBottom: 10 }}>
              <label htmlFor="msg-assign" className="sr-only">Assigned to</label>
              <select id="msg-assign" value={assignedValue} onChange={(e) => assign(e.target.value)}>
                <option value="">Not assigned</option>
                {admins.map((a) => <option key={a.id} value={a.isMe ? "me" : a.id}>{a.isMe ? `Me (${a.name})` : a.name}</option>)}
              </select>
              {t.blocked
                ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => block(false)} disabled={busy}>Turn messaging back on</button>
                : <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => { setReason(""); setBlockAsk(true); }} disabled={busy}>Turn messaging off</button>}
              {t.blocked && <span className="msg-flag">Messaging is off{t.blockedReason ? `: ${t.blockedReason}` : ""}</span>}
            </div>
            {note.ok && <p className="alert alert-success" role="status">{note.ok}</p>}
            {note.err && <p className="alert alert-error" role="alert">{note.err}</p>}
            {t.error && <p className="alert alert-error" role="alert">{t.error}</p>}
            {t.loading ? <div className="exam-card skeleton" aria-hidden="true" /> : <Thread messages={t.messages} viewer="admin" hasMore={t.hasMore} onLoadOlder={loadOlder} loadingOlder={older} onOpenFile={openFile} emptyText="No messages yet. Write the first one below." />}
            {!t.error && (
              <Composer onSend={send} upload={(f) => uploadFile(`/admin/messages/students/${sid}/files`, f, token)} error={sendError} label="Your message" placeholder="Write to the student">
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

      {blockAsk && (
        <Dialog role="alertdialog" title="Turn messaging off for this student?" description="They will still be able to read their messages but cannot send new ones or attach files. You can still write to them, and you can turn it back on at any time." onClose={() => setBlockAsk(false)} busy={busy}>
          <Field label="Reason (required, kept in the audit record)" id="block-reason"><textarea id="block-reason" rows="3" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="form-actions" style={{ marginTop: "var(--s4)" }}>
            <button type="button" className="btn btn-danger-outline" disabled={busy || reason.trim().length < 5} aria-busy={busy} onClick={() => block(true)}>{busy ? "Saving..." : "Turn messaging off"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setBlockAsk(false)} disabled={busy}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
