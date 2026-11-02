// Frequently asked questions. Every answer is drawn from the institution's brief or from what iPrime actually does today.
// Anything not yet confirmed says so, and points to the Contact page, instead of guessing.
export const FAQ_CATEGORIES = [
  { id: "start", label: "Getting started" },
  { id: "programmes", label: "Programmes and joining" },
  { id: "payments", label: "Fees and payments" },
  { id: "cbt", label: "Practice and examinations" },
  { id: "results", label: "Results, privacy and parents" },
  { id: "account", label: "Your account" },
];

export const FAQS = [
  { id: "what-prime", cat: "start", q: "What is Prime Excelerate Tutelage?", a: "Prime Excelerate Tutelage is a tutorial and examination-preparation centre with physical and online learners. It is not a conventional day school.", link: { to: "/about", label: "About us" } },
  { id: "what-iprime", cat: "start", q: "What is iPrime?", a: "iPrime is the digital platform of Prime Excelerate Tutelage. It is where students practise with computer-based examinations, use learning resources and keep a record of their results. It is not a separate institution.", link: { to: "/iprime", label: "About iPrime" } },
  { id: "who", cat: "start", q: "Who can use iPrime?", a: "Students, parents or guardians, and alumni can create accounts." },
  { id: "create", cat: "start", q: "How do I create an account?", a: "Choose Create an account, pick whether you are a student, a parent or guardian, or alumni, fill in your details and set a password. You can also continue with Google.", link: { to: "/register", label: "Create an account" } },
  { id: "account-vs-enrol", cat: "start", q: "Is creating an account the same as enrolling?", a: "No. An account is your login. Enrolling in a programme is a separate application that the institution reviews. Class and paid access opens only after your enrolment is approved and your payment is confirmed. Online enrolment is being introduced; until then, contact the institution to enrol.", link: { to: "/how-it-works", label: "See every step" } },

  { id: "programmes", cat: "programmes", q: "Which programmes does Prime offer?", a: "Programmes discussed by the institution include UTME/JAMB, WAEC, NECO, GCE where applicable, Post-UTME, JSS and SSS academic support, scholarship and aptitude preparation, and general subject tutorials. Which of them are open for enrolment is confirmed by the institution.", link: { to: "/programmes", label: "See programmes" } },
  { id: "utme-2027", cat: "programmes", q: "Is the 2027 UTME programme running?", a: "The 2027 UTME Tutorial Programme is featured on the Programmes page: online tutorials, with lectures commencing on 1 November 2026, according to the current flyer. Contact the institution to enrol and to confirm current details.", link: { to: "/programmes", label: "Programme details" } },
  { id: "physical-online", cat: "programmes", q: "What is the difference between physical and online learning?", a: "Physical learning is face-to-face teaching at the centre, with board demonstrations, guided problem-solving and supervised practice. Online learning gives remote access to lessons and resources, digital assignments and practice, tutor support, and online tests with progress tracking through iPrime. Both follow the same syllabus and assessment standards." },
  { id: "live-recorded", cat: "programmes", q: "Are online classes live or recorded?", a: "That depends on the programme and is confirmed by the institution, together with the platform used and how to ask questions. Please ask before you register.", link: { to: "/contact", label: "Contact us" } },
  { id: "subjects", cat: "programmes", q: "Which subjects can I study?", a: "Common UTME subjects are Use of English, Mathematics, Physics, Chemistry and Biology. Other subject combinations are offered according to your course, demand and tutor availability." },
  { id: "hours", cat: "programmes", q: "What are the learning hours?", a: "UTME students' learning hours are from 8:30am to 6:00pm. Physical classes for UTME, JSS and SSS also run between 4:00pm and 6:00pm.", link: { to: "/contact", label: "Contact us" } },
  { id: "timetable", cat: "programmes", q: "What is the timetable and when does the next intake start?", a: "The learning hours above apply. Days, term dates, each programme's timetable and intake dates are published once confirmed. Please contact the institution for current information.", link: { to: "/contact", label: "Contact us" } },

  { id: "cost", cat: "payments", q: "How much does it cost?", a: "Fees, and the period each fee covers, are confirmed by the institution for each programme. The current 2027 flyer shows a registration fee of \u20a68,000. Please ask what it covers, and whether any other charges apply, before you pay.", link: { to: "/contact", label: "Ask about fees" } },
  { id: "how-pay", cat: "payments", q: "How will I pay?", a: "Online payment through a trusted payment provider is planned, and bank transfers or payments at the centre are confirmed by authorised staff. A payment is confirmed by the system or by staff, never by a screenshot alone." },
  { id: "safe-pay", cat: "payments", q: "Is it safe to pay?", a: "We will never ask you to share card PINs, one-time passwords or online-banking passwords. Only pay through channels the institution has confirmed." },
  { id: "refunds", cat: "payments", q: "Can I get a refund or transfer?", a: "Refund, cancellation and transfer rules are being finalised by management. Please ask for the current rules before you pay.", link: { to: "/contact", label: "Contact us" } },

  { id: "take-exam", cat: "cbt", q: "How do I take a practice examination?", a: "Log in as a student and open Exams. Examinations appear there when the institution publishes them for you. Your results are kept under My results.", link: { to: "/exams", label: "Go to Exams" } },
  { id: "timer", cat: "cbt", q: "Is the timer fair?", a: "Yes. The deadline is controlled by the server, so refreshing the page or changing the clock on your device does not add time." },
  { id: "answers", cat: "cbt", q: "When do I see the correct answers?", a: "Correct answers and explanations are released according to each examination's settings. They are never sent to you while an attempt is in progress." },
  { id: "cheating", cat: "cbt", q: "Does iPrime stop cheating?", a: "Some examinations can warn a student who leaves the exam screen, record it for the examiner to review, and submit automatically after repeated warnings. A web page cannot see other devices, screenshots or another person helping, so iPrime does not claim to detect every form of malpractice." },
  { id: "internet", cat: "cbt", q: "What if my internet connection drops?", a: "A failed save is reported rather than hidden, and the timer is kept by the server. Losing your connection is recorded but is never counted as a warning. Reconnect and carry on." },

  { id: "achievements", cat: "results", q: "Are the achievements on the website verified?", a: "We publish an achievement only after the result has been checked and the student has given permission, with a parent or guardian's permission for anyone under 18.", link: { to: "/achievements", label: "Achievements" } },
  { id: "privacy", cat: "results", q: "How is my personal information used?", a: "We collect only what is needed, restrict access by role, and publish names, photographs or scores only with permission. A full privacy notice will be published once the institution finalises it." },
  { id: "parents", cat: "results", q: "I am a parent. Can I see my child's progress?", a: "You can create a parent or guardian account now. Linking it to a student, and viewing progress, is planned and will use a secure approval process. It is not available yet." },

  { id: "verify", cat: "account", q: "Why do I need to verify my email?", a: "We send a 6-digit code to your email address to confirm that it is yours. The code expires after 5 minutes. If it does not arrive, use Resend code on the verification page (available once every 60 seconds)." },
  { id: "change", cat: "account", q: "Can I change my details later?", a: "Yes. Log in, open your dashboard and choose Edit profile. You can update your name, phone number, state and date of birth. Your email address cannot be changed from there." },
  { id: "student-id", cat: "account", q: "What is a student ID?", a: "Verified student accounts receive a unique student ID that starts with PET-. It identifies your account within iPrime. It is not a password, so never use it to log in or share it as one." },
  { id: "password", cat: "account", q: "I forgot my password.", a: "Password reset is not available yet. It is planned for a later update. If you signed up with Google, you can keep signing in with Google." },
  { id: "reach", cat: "account", q: "How do I contact the institution?", a: "Use the Contact page. You can call or message the institution's official WhatsApp line, or send an enquiry through WhatsApp from there.", link: { to: "/contact", label: "Contact" } },
];

/** Filters by category and by search words (every word must appear in the question or the answer). */
export function filterFaqs(list, { category = "all", query = "" } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((f) => {
    if (category !== "all" && f.cat !== category) return false;
    if (!words.length) return true;
    const hay = `${f.q} ${f.a}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
