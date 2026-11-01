import { useCallback, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Thread, Composer, mergeMessages, usePolling } from "../components/MessageThread.jsx";

// The student's own conversation with the administration team. There is no recipient to choose and no way to see anyone else's messages.
export default function Messages() {
  const { token, user } = useAuth();
  const [s, setS] = useState({ loading: true, error: "", messages: [], hasMore: false });
  const [sendError, setSendError] = useState("");
  const [older, setOlder] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/messages/thread", { token });
      setS((p) => ({ loading: false, error: "", messages: mergeMessages(p.messages, d.messages), hasMore: p.messages.length > 50 ? p.hasMore : d.hasMore }));
      if (d.unread > 0) api("/messages/read", { method: "POST", token }).catch(() => {});
    } catch (e) { setS((p) => ({ ...p, loading: false, error: e.message })); }
  }, [token]);
  usePolling(load, 15000);

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

  const send = async (text) => {
    setSendError("");
    try {
      const d = await api("/messages", { method: "POST", token, body: { body: text } });
      setS((p) => ({ ...p, messages: mergeMessages(p.messages, [d.message]) }));
      return true;
    } catch (e) { setSendError(e.message); return false; }
  };

  if (user && user.role !== "student") {
    return <section className="section"><div className="container narrow"><h1>Messages</h1><p className="note">Messages are for students. Administrators use Administration, then Messages.</p></div></section>;
  }

  return (
    <section className="section">
      <div className="container msg-wrap">
        <p className="eyebrow">Messages</p>
        <h1>Message the Prime team</h1>
        <p className="msg-note">Your messages go to the Prime Excelerate Tutelage administration team only. Other students cannot see or send you messages here. Replies can take a little time; this page checks for new messages every few seconds while it is open.</p>
        {s.error && <p className="alert alert-error" role="alert">{s.error}</p>}
        {s.loading ? <div className="exam-card skeleton" aria-hidden="true" /> : (
          <Thread messages={s.messages} viewer="student" hasMore={s.hasMore} onLoadOlder={loadOlder} loadingOlder={older} emptyText="No messages yet. Ask a question about your classes, results or account, and the team will reply here." />
        )}
        <Composer onSend={send} error={sendError} placeholder="Type your message to the team" />
      </div>
    </section>
  );
}
