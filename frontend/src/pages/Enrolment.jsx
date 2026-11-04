import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useFetch, fmtDate } from "../useFetch.js";
import EnrolmentForm from "../components/EnrolmentForm.jsx";
import "../enrolment.css";

const STATUS = { submitted: "Submitted", under_review: "Under review", more_info_required: "More information needed", approved: "Approved", rejected: "Not approved" };

function Steps({ now, done }) {
  const items = [
    ["Create your account", "Done. You are signed in."],
    ["Payment confirmed by the office", "The office confirms your payment before the form opens."],
    ["Complete the student registration form", "Your details, subjects and consent."],
    ["Office review", "The office checks your form and confirms your subjects and fee."],
    ["Start learning", "The office tells you when your classes are ready."],
  ];
  return (
    <ol className="enr-steps" aria-label="Your enrolment steps">
      {items.map(([title, text], i) => {
        const state = i < now ? "done" : i === now ? "now" : "";
        return (
          <li key={title} className={`enr-step ${state}`} aria-current={i === now ? "step" : undefined}>
            <span className="enr-step-n" aria-hidden="true">{i < now || (done && i === now) ? "✓" : i + 1}</span>
            <div><h3>{title}</h3><p>{text}</p></div>
          </li>
        );
      })}
    </ol>
  );
}

export default function Enrolment() {
  const { user } = useAuth();
  const info = useFetch("/enrolments/info");
  const mine = useFetch("/enrolments/mine");

  if (user && user.role !== "student") {
    return <section className="section"><div className="container narrow"><h1>Enrolment</h1><p className="note">Enrolment is for students. Administrators use Administration, then Applications.</p></div></section>;
  }

  const i = info.data;
  const e = (mine.data?.enrolments || [])[0] || null; // newest first
  const unlocked = !!i?.form.unlocked;
  const submitted = e && ["submitted", "under_review", "approved", "rejected"].includes(e.status);
  const needsInfo = e && e.status === "more_info_required";
  const note = needsInfo ? [...(e.reviews || [])].reverse().find((r) => r.action === "more_info_required")?.note : null;
  const reload = () => { info.reload(); mine.reload(); };

  let now = 1;
  if (i) {
    if (!unlocked && !submitted) now = 1;
    else if (needsInfo || (!e || e.status === "draft")) now = 2;
    else if (e.status === "approved") now = 4;
    else now = 3;
  }

  return (
    <section className="section">
      <div className="container enr-wrap">
        <p className="eyebrow">Enrolment</p>
        <h1>Join Prime Excelerate Tutelage</h1>
        {(info.loading || mine.loading) && !i && <div className="exam-card skeleton" aria-hidden="true" />}
        {(info.error || mine.error) && <p className="alert alert-error" role="alert">{info.error || mine.error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}

        {i && (
          <>
            <p style={{ margin: "6px 0" }}>
              <span className={`enr-badge${i.payment.status === "confirmed" ? " ok" : ""}`}>Payment: {i.payment.status === "confirmed" ? "confirmed by the office" : "waiting for confirmation"}</span>{" "}
              <span className={`enr-badge${i.verification.status === "verified" ? " ok" : ""}`}>Identity: {i.verification.status === "verified" ? "verified by the office" : i.verification.status === "revoked" ? "verification removed" : "not yet verified"}</span>
            </p>
            <Steps now={now} done={e?.status === "approved"} />

            {!unlocked && !submitted && (
              <div className="enr-card enr-locked" role="status">
                <h2>The student registration form is locked for now</h2>
                <p className="enr-notice">{i.notice}</p>
                {i.paymentInstructions
                  ? <><h3 style={{ marginBottom: 4 }}>How to pay</h3><p className="enr-notice">{i.paymentInstructions}</p></>
                  : <p className="muted">The office will tell you how to pay. If you are not sure, send the team a message.</p>}
                <p className="muted">The office unlocks the form after it has confirmed your payment. You will get an email, and this page will show the form. Please do not pay anyone who is not in the office.</p>
                <Link to="/messages" className="btn btn-secondary">Message the office</Link>
              </div>
            )}

            {unlocked && !submitted && (
              <>
                {needsInfo && <div className="enr-card enr-locked" role="status"><h2>The office needs a correction</h2><p className="enr-notice">{note || "Please check your answers and submit again."}</p></div>}
                <EnrolmentForm key={e?.id || "new"} record={e && ["draft", "more_info_required"].includes(e.status) ? e : null} onSubmitted={reload} />
              </>
            )}

            {submitted && (
              <div className="enr-card" role="status">
                <h2>Your application is {STATUS[e.status].toLowerCase()}</h2>
                <p>Reference: <strong>{e.reference}</strong>{e.submittedAt ? ` · submitted ${fmtDate(e.submittedAt)}` : ""}</p>
                {e.status === "approved" && <p>The office has approved your application. It will tell you when your classes are ready. Approval alone does not open classes.</p>}
                {e.status === "rejected" && <p>The office could not approve this application. {[...(e.reviews || [])].reverse().find((r) => r.action === "rejected")?.note || ""} Please message the office if you have questions.</p>}
                {["submitted", "under_review"].includes(e.status) && <p>The office is checking your form. You do not need to do anything else for now. You cannot edit it unless the office asks for a correction.</p>}
                <Link to="/messages" className="btn btn-secondary">Message the office</Link>
              </div>
            )}

            {i.verification.status !== "verified" && (
              <p className="muted">To be officially verified, bring a valid identity document to the office. If you are under 18, the office may also contact your parent or guardian.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
