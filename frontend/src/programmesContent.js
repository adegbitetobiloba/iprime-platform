// Programme areas, taken from the institution's questionnaire. Availability is NOT asserted: every programme except the 2027 UTME
// campaign (which has its own flyer-based section) says availability is to be confirmed. Update `status` when management confirms.
//   status: "current" = shown as the current campaign programme;  "tbc" = availability, intake and fees to be confirmed.
export const PROGRAMME_AREAS = [
  { id: "utme", title: "UTME / JAMB preparation", status: "current",
    who: "Candidates preparing for the Unified Tertiary Matriculation Examination.",
    text: "Subject combinations follow the candidate's intended course and current JAMB rules, with timed practice to build speed and confidence.",
    subjects: ["Use of English", "Mathematics", "Physics", "Chemistry", "Biology"], more: "Other subject combinations by demand and tutor availability.",
    hours: "UTME learning hours 8:30am to 6:00pm. Physical classes 4:00pm to 6:00pm." },
  { id: "waec", title: "WAEC preparation", status: "tbc",
    who: "Secondary-school candidates and private candidates.",
    text: "Subject selection depends on the candidate's examination registration and academic needs.",
    subjects: ["Chosen to match the candidate's registration"] },
  { id: "neco", title: "NECO preparation", status: "tbc",
    who: "Secondary-school candidates and private candidates.",
    text: "Structured revision and examination practice for NECO subjects, matched to what the candidate has registered.",
    subjects: ["Chosen to match the candidate's registration"] },
  { id: "gce", title: "GCE preparation", status: "tbc",
    who: "Candidates sitting GCE, where applicable.",
    text: "Support for candidates preparing for GCE examinations, where the programme applies.",
    subjects: ["Chosen to match the candidate's registration"] },
  { id: "post-utme", title: "Post-UTME preparation", status: "tbc",
    who: "Candidates who have completed UTME.",
    text: "Preparation for institution-specific screening and aptitude assessments.",
    subjects: ["Matched to the target institution's screening"] },
  { id: "jss-sss", title: "JSS and SSS academic support", status: "tbc",
    who: "Junior and senior secondary learners.",
    text: "Reinforcement, examination preparation and continuous academic support for learners who want steady progress.",
    subjects: ["Core school subjects"],
    hours: "Physical classes 4:00pm to 6:00pm." },
  { id: "scholarship", title: "Scholarship and aptitude preparation", status: "tbc",
    who: "Learners sitting qualifying scholarship or aptitude tests.",
    text: "Practice for the reasoning and subject skills that qualifying tests look for.",
    subjects: ["Matched to the test being prepared for"] },
  { id: "general", title: "General subject tutorials", status: "tbc",
    who: "Learners who want help with particular subjects.",
    text: "Focused tutorials in individual subjects, offered according to demand and tutor availability.",
    subjects: ["By request"] },
];

// Subject areas that learners can ask for (the options on the institution's registration form).
export const SUBJECT_AREAS = [
  "English Language", "Mathematics", "Further Mathematics", "Biology", "Chemistry", "Physics", "Agricultural Science",
  "Economics", "Government", "Literature", "Commerce", "CRS", "Geography", "Accounting", "Education",
];

export const OUTCOMES = [
  "Better understanding of concepts",
  "Accurate reading of examination questions",
  "Stronger calculation and problem-solving",
  "Speed and examination strategy",
  "Wider topic coverage",
  "Better study habits",
  "Progress you can see in mock results",
];

export const SUPPORT = [
  { title: "Clear teaching", text: "Explanations from first principles, with practical illustrations, diagrams, mnemonics and worked examples." },
  { title: "Efficient Mathematics methods", text: "Shortcuts and problem-solving methods that save time under examination conditions." },
  { title: "Practice and mock examinations", text: "Timed practice, regular mocks and standard examination-style questions." },
  { title: "Correction and retesting", text: "Error analysis, targeted corrections and retests, so weak topics are fixed rather than ignored." },
  { title: "Mentorship", text: "Guidance, encouragement and progress monitoring throughout preparation." },
];
