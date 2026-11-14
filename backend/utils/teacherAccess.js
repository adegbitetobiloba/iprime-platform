const Enrolment = require("../models/Enrolment");
const TeacherAssignment = require("../models/TeacherAssignment");
const TeacherGroup = require("../models/TeacherGroup");

// The ONE place that decides which students a teacher may see. Everything that shows a teacher a student's data goes through here.
//
//  1. Direct assignment: an administrator assigned the student to the teacher (optionally limited to some subjects).
//  2. Subject group: an administrator gave the teacher a subject (e.g. Chemistry); every student with an APPROVED enrolment
//     whose office-confirmed "subjects registered" include it is visible, for that subject only.
//
// `subjects` in the result is null when the teacher may see everything about the student, or a lower-case list of subjects they are limited to.
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ci = (subject) => new RegExp(`^${esc(subject)}$`, "i");
const groupFilter = (g) => ({ status: "approved", subjectsRegistered: ci(g.subject), ...(g.programmeId ? { programmeId: g.programmeId } : {}) });

// -> Map(studentId string -> { all: boolean, subjects: Set<lowercase subject>, via: string[] })
async function visibleStudents(teacherId) {
  const out = new Map();
  const add = (id, { all, subject, label }) => {
    const key = String(id);
    const cur = out.get(key) || { all: false, subjects: new Set(), via: [] };
    if (all) cur.all = true;
    if (subject) cur.subjects.add(String(subject).toLowerCase());
    if (label && !cur.via.includes(label)) cur.via.push(label);
    out.set(key, cur);
  };
  const links = await TeacherAssignment.find({ teacherId, status: "active" });
  for (const l of links) {
    if (l.subjects && l.subjects.length) l.subjects.forEach((s) => add(l.studentId, { subject: s, label: s }));
    else add(l.studentId, { all: true, label: "Assigned" });
  }
  const groups = await TeacherGroup.find({ teacherId, status: "active" });
  for (const g of groups) {
    const rows = await Enrolment.find(groupFilter(g)).select("userId");
    rows.forEach((e) => add(e.userId, { subject: g.subject, label: g.subject }));
  }
  return out;
}

// -> { ok: false } or { ok: true, subjects: null | Set<lowercase subject> }
async function accessFor(teacherId, studentId) {
  const map = await visibleStudents(teacherId);
  const v = map.get(String(studentId));
  if (!v) return { ok: false };
  return { ok: true, subjects: v.all ? null : v.subjects, via: v.via };
}

module.exports = { visibleStudents, accessFor, groupFilter, ci };
