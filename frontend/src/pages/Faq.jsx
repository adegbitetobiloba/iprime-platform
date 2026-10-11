import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";

// Answers describe what the platform does today. Update them as features are released.
const FAQS = [
  { q: "How do I create an account?", a: <>Go to <Link to="/register">Register</Link>, choose whether you are a student or a parent or guardian, fill in your details and set a password.</> },
  { q: "Why do I need to verify my email?", a: "We send a 6-digit code to your email address to confirm that it is yours. The code expires after 5 minutes. If it does not arrive, use Resend code on the verification page (available once every 60 seconds)." },
  { q: "Can I change my details later?", a: "Yes. Log in, open your dashboard and choose Edit profile. You can update your name, phone number, state and date of birth. Your email address cannot be changed from there." },
  { q: "What is a student ID?", a: "Verified student accounts receive a unique student ID that starts with PET-. It identifies your account within iPrime. It is not a password, so never use it to log in or share it as one." },
  { q: "Can I use iPrime for practice examinations or learning resources now?", a: "Not yet. The learning library and computer-based practice examinations are in development, and the platform says so wherever they appear. Registered users will be able to use them as they are released." },
  { q: "I am a parent. Can I see my child's progress?", a: "You can register a parent or guardian account now. Linking a parent account to a student, and viewing progress, is planned and will use a secure approval process. It is not available yet." },
  { q: "I forgot my password.", a: "Password reset is not available yet. It is planned for a later update." },
];

export default function Faq() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions">
        Straight answers about how iPrime works today.
      </PageHero>
      <section className="section">
        <div className="container narrow-wide">
          <Reveal>
            <div className="faq-list">
              {FAQS.map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
