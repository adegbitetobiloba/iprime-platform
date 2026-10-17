// What should happen when a verified Google identity arrives? One small, testable decision.
//  - byGoogleId: the account already linked to this Google identity (if any)
//  - byEmail:    an account with the same email address (if any)
//  - role:       the account type the person already chose (null if they have not chosen yet)
function decideGoogleOutcome({ byGoogleId, byEmail, role }) {
  if (byGoogleId) return "sign_in";                                   // returning user
  if (byEmail) return byEmail.googleId ? "conflict" : "link_required"; // same email: prove ownership; a DIFFERENT Google id is a conflict
  return role ? "create" : "onboarding";                               // brand new: ask which kind of account, unless already chosen
}

// "ada.obi@gmail.com" -> "a******i@gmail.com": enough to recognise, not enough to reveal
function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  if (!domain) return "your email";
  const shown = local.length <= 2 ? local[0] || "" : `${local[0]}${"*".repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}

module.exports = { decideGoogleOutcome, maskEmail };
