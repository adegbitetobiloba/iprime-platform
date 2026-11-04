// The subjects printed on the paper registration form (Section E). One list, used by every enrolment screen.
// "Others" is a separate free-text field, as on the form. An administrator-managed catalogue can replace this later.
export const FORM_SUBJECTS = ["English Language", "Mathematics", "Biology", "Chemistry", "Physics", "Agricultural Science", "Economics", "Government", "Literature", "Commerce", "CRS", "Geography", "Education", "Accounting", "Further Mathematics"];

export const ageOf = (dob) => {
  const d = new Date(dob);
  if (!dob || Number.isNaN(d.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a -= 1;
  return a >= 0 ? a : null;
};
