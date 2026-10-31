# Workstream 3 (Administration / Operations): M1 draft contracts

Status: DRAFT for agreement by Workstreams 1, 2, 4 and 5. Nothing here is implemented.
Baseline: `adegbitetobiloba/iprime-platform`, commit `827b640` (30 Oct 2026). Canonical code is `backend/` (the flat root copies are not used by `render.yaml`).

## 1. Principles
- Additive only. `User`, `Programme`, auth and the existing `/api/admin/*` routes keep working unchanged.
- `User.approval` stays the **account** approval. Enrolment, fee, payment and access are separate models and separate states.
- No second subject taxonomy: subjects reuse the Library's `LibrarySubject` (`backend/Subject.js`). To confirm with Workstream 4.
- Money is stored as integer minor units (kobo) with an explicit `currency`. No floats.
- Every server decision is made by the backend; the frontend only hides links.
- Every sensitive transition writes an `AuditLog` entry.

## 2. State machines (separate fields, never merged)
| Area | States |
|---|---|
| Account | existing: `isVerified`, `approval` (pending, approved, rejected) |
| Enrolment | draft -> submitted -> under_review -> more_info_required / approved / rejected |
| Fee | not_assessed -> agreed -> approved -> amount_due_set |
| Payment | initiated -> pending -> verified / failed / cancelled / expired / reversed |
| Access | not_eligible -> eligible -> active -> suspended / completed / expired |

Activation rule (owner decision, 30 Oct 2026): access becomes `active` only when the enrolment is `approved` AND the payments verified for the invoice cover the full approved fee. The rule lives in one function, `isEligibleForActivation(enrolment, invoice, payments)`, and reads a policy setting (default `full_payment`) so a deposit rule can be added later without a rewrite.

## 3. Proposed models (all new collections)
- **Enrolment**: `reference` (unique, server-generated), `userId`, `programmeId`, `mode`, `session`, `status`, `student{...}` (form sections B, D), `guardian{...}` (C), `subjectsRequested[]`, `subjectsRegistered[]` (staff only), `studyPreference`, `technology`, `specialNeeds` and emergency contact (restricted fields), `referral`, `consents[]`, `office{registeredBy, feeApproved}` (staff only), `reviews[]`, timestamps. Date of birth is authoritative; age is computed.
- **Consent record** (embedded): `kind` (student_commitment | guardian_consent), `signerName`, `relationship`, `typedAcknowledgement: true`, `policyVersion`, `textHash`, `at`. A typed name is stored as a typed acknowledgement, never called a handwritten signature.
- **Invoice**: `enrolmentId`, `currency`, `agreedFeeMinor` (student-entered), `approvedFeeMinor` (office), `amountDueMinor`, `paymentPlan` (weekly | biweekly | monthly), `status`.
- **Payment**: `invoiceId`, `provider` (paystack | flutterwave | manual), `providerReference` (unique per provider), `internalReference` (server-generated, unique), `amountMinor`, `currency`, `status`, `verifiedBy`, `verifiedAt`, `webhookEventIds[]`.
- **AuditLog** (append-only; no update or delete routes): `actorId`, `actorRole`, `entityType`, `entityId`, `event`, `at`, `meta` (no secrets, no card data).
- **Entitlement** (derived, read by Exam and Library): `userId`, `programmeId`, `subjects[]`, `mode`, `state`, `activatedAt`.

## 4. Roles
Existing roles: student, parent, alumni, teacher, admin. Finance and academic-admin powers are needed. Option A: add roles to the `User.role` enum (touches shared `User.js`). Option B (preferred): keep roles and add a separate `staffPermissions[]` field (`finance`, `academic`, `content`) checked by a `requirePermission()` middleware, with `admin` holding all. Needs owner approval.

## 5. API sketch (all under existing auth; validation with Joi)
Student: `POST /api/enrolments` (create draft), `PATCH /api/enrolments/:id` (save draft), `POST /api/enrolments/:id/submit`, `GET /api/enrolments/mine`.
Admin: `GET /api/admin/enrolments?status=`, `GET /api/admin/enrolments/:id`, `POST /api/admin/enrolments/:id/request-info`, `POST .../approve`, `POST .../reject` (reason required), `PATCH .../office` (registrar fields).
Payments (later milestone): `POST /api/payments/initialize`, `POST /api/payments/webhook/:provider`, `GET /api/admin/payments`, `POST /api/admin/payments/:id/verify`.
Cross-workstream: `GET /api/me/entitlements` and an internal `isEntitled(userId, {programmeId, subject})` helper for Exam and Library.
Privacy: guardian, medical, address, emergency-contact and payment fields are never returned by Exam, Library or Analytics endpoints.

## 6. Open questions for the owner
1. Is `main` the deployed branch, and who may merge?
2. Staff roles: Option A or B above?
3. Are fees in naira only? Confirm the payment plans and whether `Hybrid` needs its own fee.
4. Retention and deletion rules for medical, guardian and emergency-contact data.
5. Is typed acknowledgement acceptable for student and guardian consent?

## 7. Dependencies on other workstreams
- WS4: confirm `LibrarySubject` is the shared subject source, and who wires `adminLibraryRoutes` (not mounted in `backend/app.js` at `827b640`).
- WS1: use `isEntitled()` for restricted exams; do not read enrolment fields directly.
- WS2: segment by `subjectsRegistered`, not `subjectsRequested`; the registration-form mock score is self-reported.
- WS5: build the enrolment form against section 3 and 5 once agreed.
