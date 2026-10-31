// Wording for the About page. Source: the institution's questionnaire response (30 Oct 2026).
// Mission, vision and values are a DRAFT for management adoption. While MISSION_APPROVED is false the page says the
// wording is awaiting confirmation. Set it to true once management has signed off. Nothing here states a history,
// founding date, facility, leader or result: those are deliberately left out until the institution confirms them.
export const MISSION_APPROVED = false;

export const ABOUT = {
  mission: "To make quality learning accessible, understandable and effective by helping every learner build knowledge, confidence, examination competence and the habits required for lifelong success.",
  vision: "To become one of Nigeria's most trusted and impactful learning brands, and a leading African platform for Science, Mathematics and examination preparation.",
  values: [
    "Learner-centred service", "Clarity and excellence in teaching", "Integrity and honesty in assessment", "Discipline and consistency",
    "Innovation", "Accessibility and inclusion", "Mentorship", "Measurable improvement", "Accountability", "Respect for every learner",
  ],
  teaching: [
    { title: "Start from first principles", text: "Ideas are explained from the ground up, so students understand why a method works, not only how to copy it." },
    { title: "Connect it to real life", text: "Abstract ideas are tied to real applications, which makes Science and Mathematics easier to remember." },
    { title: "Diagrams, mnemonics and worked examples", text: "Visual teaching, memory aids and step-by-step examples make difficult topics easier to hold on to." },
    { title: "Problem-solving and examination strategy", text: "Students learn efficient methods, time management and how to read and answer examination questions." },
    { title: "Practise regularly", text: "Structured revision and timed practice build speed, accuracy and confidence." },
    { title: "Use results to find gaps", text: "Assessments show which topics need attention, so teaching can focus where it helps most." },
    { title: "Correct mistakes constructively", text: "Errors are reviewed calmly, then followed by targeted corrections and retests." },
    { title: "Support every learner", text: "Mentorship and encouragement help students keep going. No learner is labelled or demeaned for finding something hard." },
  ],
  formats: [
    {
      id: "physical", title: "Physical learning", lead: "Face-to-face teaching at the centre.",
      points: ["Direct contact with the tutor", "Board demonstrations and guided problem-solving", "Supervised practice", "In-person support"],
    },
    {
      id: "online", title: "Online learning", lead: "Learn from wherever you are, through iPrime.",
      points: ["Remote access to lessons and resources", "Digital assignments and practice", "Tutor communication and support", "Online tests and computer-based practice, with progress tracking"],
    },
  ],
  formatsNote: "Both formats follow the same syllabus and assessment standards. Whether online classes are live, recorded or blended, and each programme's timetable, are confirmed by the institution: please ask before you register.",
  aim: "The aim is not only to help students sit examinations, but to build understanding, confidence and independent learning habits.",
};
