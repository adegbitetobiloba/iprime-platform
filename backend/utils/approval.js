// Administrator approval for new student accounts.
//
// SAFETY RULE: an account with NO approval value (every account created before this feature existed) counts as approved,
// so nobody who already had an account is locked out and no database migration is needed.
const ROLES_NEEDING_APPROVAL = ["student"]; // parents, alumni and staff are handled by their own rules

// The owner can switch the whole feature off with REQUIRE_STUDENT_APPROVAL=false (it is on by default).
const approvalEnabled = () => String(process.env.REQUIRE_STUDENT_APPROVAL ?? "true").toLowerCase() !== "false";

// What a brand-new account starts as.
const initialApproval = (role) => (approvalEnabled() && ROLES_NEEDING_APPROVAL.includes(role) ? "pending" : "approved");

const isApproved = (user) => !user || !user.approval || user.approval === "approved";

// null if the person may sign in; otherwise the plain reason they may not.
function approvalBlock(user) {
  if (isApproved(user)) return null;
  if (user.approval === "rejected") {
    return { status: "rejected", code: "ACCOUNT_REJECTED", error: "Your registration was not approved. Please contact the institution if you think this is a mistake." };
  }
  return { status: "pending", code: "PENDING_APPROVAL", error: "Your account is waiting for approval by an administrator. We will email you as soon as it is approved." };
}

module.exports = { ROLES_NEEDING_APPROVAL, approvalEnabled, initialApproval, isApproved, approvalBlock };
