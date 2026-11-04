import { useCallback, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Thread, Composer, mergeMessages, usePolling } from "../components/MessageThread.jsx";
import { downloadFile, uploadFile, useLiveStream } from "../lib/liveMessages.js";

// The student's own conversation with the administration team. There is no recipient to choose and no way to see anyone else's messages.
export default function Messages() {
  const { token, user } = useAuth();
  const [s, setS] = useState({ loading: true, error: "", messages: [], hasMore: false, blocked: false });
  const [sendError, setSendError] = useState("");
  const [older, setOlder] = useState(false);

  const markRead = useCallback(() => api("/messages/read", { method: "POST", token }).catch(() => {}), [token]);
  const load = useCallback(async () => {
    try {
      const d = await api("/messages/thread", { token });
      setS((p) => ({ loading: false, error: "", messages: mergeMessages(p.messages, d.messages), hasMore: p.messages.length > 50 ? p.hasMore : d.hasMore, blocked: d.blocked }));
      if (d.unread > 0) markRead();
    } catch (e) { setS((p) => ({ ...p, loading: false, error: e.message })); }
  }, [token, markRead]);
  usePolling(load, 60000); // a safety net: new messages normally arrive instantly through the live connection below

  // Instant delivery: the team's reply appears the moment it is sent
  useLiveStream(user && user.role === "student" ? "/messages/stream" : null, token, (ev) => {
    if (ev.type === "message") {
      setS((p) => ({ ...p, messages: mergeMessages(p.messages, [ev.message]) }));
      if (ev.message.from === "admin") markRead(); // the page is open, so it counts as read
    } else if (ev.type === "state") setS((p) => ({ ...p, blocked: !!ev.blocked }));
  });

  const loadOlder = async () => {
    const first = s.messages[0];
    if (!first) return;
    setOlder(true);
    try {
      const d = await api(`/messages/thread?before=${first.id}`, { token });
      setS((p) => ({ ...p, messages: mergeMessages(p.messages, d.messages), hasMore: d.hasMore }));
    } catch (e) { setS((p) => ({ ...p, error: e.message })); }
    setOlder(false);
  };

  const send = async (text, fileIds) => {
    setSendError("");
    try {
      const d = await api("/messages", { method: "POST", token, body: { body: text, ...(fileIds.length ? { fileIds } : {}) } });
      setS((p) => ({ ...p, messages: mergeMessages(p.messages, [d.message]) }));
      return true;
    } catch (e) { setSendError(e.message); if (e.code === "MESSAGING_BLOCKED") setS((p) => ({ ...p, blocked: true })); return false; }
  };
  const open = (a) => downloadFile(`/messages/files/${a.id}`, token, a.name).catch((e) => setSendError(e.message));

  if (user && user.role !== "student") {
    return <section className="section"><div className="container narrow"><h1>Messages</h1><p className="note">Messages are for students. Administrators use Administration, then Messages.</p></div></section>;
  }

  return (
    <section className="section">
      <div className="container msg-wrap">
        <p className="eyebrow">Messages</p>
        <h1>Message the Prime team</h1>
        <p className="msg-note">Your messages go to the Prime Excelerate Tutelage administration team only. Other students cannot see or send you messages here. Replies appear here as soon as they are sent, and we may also email you to say there is a new message.</p>
        {s.error && <p className="alert alert-error" role="alert">{s.error}</p>}
        {s.loading ? <div className="exam-card skeleton" aria-hidden="true" /> : (
          <Thread messages={s.messages} viewer="student" hasMore={s.hasMore} onLoadOlder={loadOlder} loadingOlder={older} onOpenFile={open} emptyText="No messages yet. Ask a question about your classes, results or account, and the team will reply here." />
        )}
        <Composer onSend={send} upload={(f) => uploadFile("/messages/files", f, token)} error={sendError} placeholder="Type your message to the team" disabled={s.blocked} disabledNote="Messaging is turned off for your account, so you cannot send new messages. You can still read the ones above. Please visit or call the office." />
      </div>
    </section>
  );
}
