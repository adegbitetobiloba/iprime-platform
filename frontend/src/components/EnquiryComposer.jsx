import { useState } from "react";
import { CAMPAIGN } from "../campaign.js";
import { TOPICS, MAX_MESSAGE, validateEnquiry, buildEnquiry, whatsappLink, emailLink } from "../contactContent.js";
import Field from "./Field.jsx";

// An enquiry that needs no server: it prepares a WhatsApp message to the institution's official WhatsApp line (confirmed by the
// institution) and opens WhatsApp with it ready to send. Nothing is stored by iPrime. "Copy" is the fallback if WhatsApp is not installed.
export default function EnquiryComposer() {
  const [v, setV] = useState({ name: "", topic: "", message: "" });
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState("");
  const set = (k) => (e) => { setNote(""); setV((x) => ({ ...x, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined })); };

  const check = () => {
    const e = validateEnquiry(v);
    setErrors(e);
    if (Object.keys(e).length) {
      setNote("");
      const first = document.getElementById(`enq-${Object.keys(e)[0]}`);
      if (first) first.focus();
      return false;
    }
    return true;
  };
  const text = () => buildEnquiry(v);

  const open = (ev) => {
    ev.preventDefault();
    if (!check()) return;
    window.open(whatsappLink(CAMPAIGN.contacts.whatsapp.href, text()), "_blank", "noopener");
    setNote("WhatsApp should open with your message ready to send. If it did not, use Copy message and send it yourself.");
  };
  const email = () => {
    if (!check()) return;
    window.location.href = emailLink(v.topic, text());
    setNote("Your email app should open with the message ready to send to the institution.");
  };
  const copy = async () => {
    if (!check()) return;
    try {
      await navigator.clipboard.writeText(text());
      setNote("Message copied. Paste it into WhatsApp, or any app you prefer.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text(); ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
      document.body.removeChild(ta);
      setNote(ok ? "Message copied. Paste it into WhatsApp, or any app you prefer." : "Your browser blocked copying. Please select the message and copy it yourself.");
    }
  };

  const count = v.message.trim().length;
  return (
    <form className="panel form ws5-enquiry" onSubmit={open} noValidate>
      <h2 className="panel-title">Send an enquiry</h2>
      <p className="muted">Write your question and we will prepare a WhatsApp message to the institution. Nothing is stored on this website.</p>
      {Object.keys(errors).some((k) => errors[k]) && <p className="alert alert-error" role="alert">Please fix the highlighted fields.</p>}
      <Field label="Your name" id="enq-name" value={v.name} onChange={set("name")} maxLength={80} autoComplete="name" required aria-invalid={Boolean(errors.name)} hint={errors.name} />
      <Field label="Topic" id="enq-topic" hint={errors.topic}>
        <select id="enq-topic" value={v.topic} onChange={set("topic")} aria-invalid={Boolean(errors.topic)} required>
          <option value="">Choose a topic</option>
          {TOPICS.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
      </Field>
      <Field label="Your message" id="enq-message" hint={errors.message || `${count} / ${MAX_MESSAGE}`}>
        <textarea id="enq-message" rows="5" value={v.message} onChange={set("message")} maxLength={MAX_MESSAGE + 50} aria-invalid={Boolean(errors.message)} required />
      </Field>
      {note && <p className="alert alert-success" role="status">{note}</p>}
      <div className="form-actions ws5-btn-row">
        <button type="submit" className="btn btn-primary">Open in WhatsApp</button>
        <button type="button" className="btn btn-secondary" onClick={email}>Send by email</button>
        <button type="button" className="btn btn-secondary" onClick={copy}>Copy message</button>
      </div>
    </form>
  );
}
