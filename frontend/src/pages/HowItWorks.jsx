import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import Icon from "../components/Icon.jsx";
import SwipeCards from "../components/SwipeCards.jsx";

// status: "now" = works on iPrime today; "soon" = being introduced (do not present as live).
const JOURNEY = [
  { title: "Explore", status: "now", text: "Browse programmes, subjects and updates on the public pages. You do not need an account to look around." },
  { title: "Create an account", status: "now", text: "Sign up as a student, a parent or guardian, or alumni. An account is a login; it is not the same as being enrolled in a programme." },
  { title: "Verify your email", status: "now", text: "Confirm your address with a 6-digit code, or continue with Google." },
  { title: "Apply to enrol", status: "soon", text: "Complete the student enrolment application for your programme, study mode and subjects. You will be able to save it and finish later." },
  { title: "Fee and payment", status: "soon", text: "The office confirms your fee. Payments are confirmed by the system or by authorised staff, never by a screenshot alone." },
  { title: "Review and approval", status: "soon", text: "Staff review your application and confirm your programme and subjects. They may ask for more information." },
  { title: "Access is activated", status: "soon", text: "Class and paid access opens only after your enrolment is approved and your payment is confirmed." },
  { title: "Practise and take examinations", status: "now", text: "Take practice examinations set by the institution, on screen and against the clock." },
  { title: "See your results", status: "now", text: "Your score is calculated by the system and kept, so you can see how you are improving over time." },
  { title: "Ask for help", status: "now", text: "If you are stuck at any step, use the contact page to reach the institution." },
];

const CYCLE = [
  { title: "Explain", text: "Ideas are taught clearly, from first principles, with examples and diagrams." },
  { title: "Practise", text: "Students work through questions regularly, in class and on iPrime." },
  { title: "Assess", text: "Timed practice shows what has been understood." },
  { title: "Correct", text: "Mistakes are reviewed calmly and turned into targeted corrections." },
  { title: "Improve", text: "Retesting shows progress and builds confidence." },
];

function Badge({ status }) {
  return status === "now"
    ? <span className="ws5-badge ws5-badge-now">Available now</span>
    : <span className="ws5-badge ws5-badge-soon">Coming soon</span>;
}

export default function HowItWorks() {
  return (
    <>
      <PageHero eyebrow="How it works" title="From first visit to first result">
        The steps for joining Prime Excelerate Tutelage on iPrime, and which of them you can use today.
      </PageHero>

      <section className="section">
        <div className="container">
          <SwipeCards label="Steps to join, swipe through them" single>
            {JOURNEY.map((s, i) => (
              <div key={s.title} className="ws5-journey-item ws5-journey-card">
                <span className="ws5-journey-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h2 className="ws5-journey-title">{s.title} <Badge status={s.status} /></h2>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </SwipeCards>
          <Reveal>
            <p className="ws5-note">
              Dates, fees and programme availability are published only after the institution confirms them. Please check the <Link to="/programmes" className="rd-link">programmes page</Link> or <Link to="/contact" className="rd-link">contact the institution</Link> for current details.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Our approach</p>
            <h2>The Prime learning cycle</h2>
            <p className="section-lead">The same five steps guide learning in the classroom and on iPrime.</p>
          </Reveal>
          <SwipeCards label="The Prime learning cycle" gridFrom="md">
            {CYCLE.map((c, i) => (
              <div key={c.title} className="ws5-cycle-card">
                <span className="ws5-cycle-n" aria-hidden="true">{i + 1}</span>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </SwipeCards>
          <Reveal>
            <p style={{ marginTop: "var(--s5)" }}>
              <Link to="/register" className="btn btn-primary">Create an account <Icon name="arrow" size={18} /></Link>
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
