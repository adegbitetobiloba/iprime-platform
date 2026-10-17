// The ways a person can relate to the institution when they sign up. These choose an account TYPE only:
// none of them grants access to anyone's records, and "administrator" can never be chosen here.
export const ACCOUNT_TYPES = [
  { id: "student", title: "Student", icon: "user", blurb: "I am studying and want to use the learning and examination features." },
  { id: "parent", title: "Parent or guardian", icon: "shield", blurb: "I want to follow a child's progress once the institution links our accounts." },
  { id: "alumni", title: "Alumni or former student", icon: "book", blurb: "I studied with Prime Excelerate Tutelage before and want to stay connected." },
];
export const TYPE_LABEL = { student: "Student", parent: "Parent or guardian", alumni: "Alumni", teacher: "Teacher", admin: "Administrator" };
export const ALUMNI_STATUS = {
  unverified: "Not yet verified",
  pending: "Waiting for review",
  verified: "Verified alumnus",
  rejected: "Could not be confirmed",
};
