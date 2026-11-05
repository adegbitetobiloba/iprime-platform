# Performance analytics (workstream 2)

Status: **Milestones 1–8.** Student analytics, cohort analytics, CSV export with an audit trail. Class, tutor and parent reports are not built yet (they wait for an Admin class/parent contract).

## Source of truth
All metrics come from persisted `Attempt` records (`status: "submitted"`) joined to the `Exam` that was taken.
Nothing is sampled, seeded or estimated. Registration-form mock scores are **not** used anywhere (self-reported, unverified).

## Rules
| Topic | Rule |
|---|---|
| Which attempts count | Submitted only. In-progress attempts are ignored. |
| Absentees | No attempt = no row. Never treated as 0% in a student's own averages. (Cohort participation will be reported separately.) |
| Late / timed-out | The server fixes the deadline; an attempt submitted by expiry has `autoSubmitted: true`. It counts and is labelled. |
| Score, percentage, trend | Copied from the stored attempt result. Never recomputed, so there is one grading formula (`scoreAttempt`, `utils/cbt.js`). |
| Time used | `submittedAt − startedAt` in seconds. |
| Topic mastery | marks earned ÷ marks available over all questions of that topic in verified attempts. Untagged questions are reported as a count, not scored as a topic. |
| Evidence | A topic is labelled only with ≥ 5 questions of evidence. Bands: ≥ 70% `strong`, 50–69.9% `developing`, < 50% `needs_practice`, otherwise `not_enough_evidence`. Wording is deliberately neutral. |
| Recurring misses | A question wrong or skipped in ≥ 2 separate attempts; each lists the attempt IDs. Correct keys and explanations are never returned. |
| Retests | First vs latest attempt of the same exam (`change` = latest − first, percentage points). |
| Revision focus | Up to 3 `needs_practice` topics, each with its basis. Marked `kind: "recommendation"`. Not yet linked to Library resources (needs the shared topic taxonomy). |
| Verification | Question-level analysis uses an attempt only if re-grading it against the current exam reproduces the stored score/correct/incorrect/unanswered. Otherwise it appears under `unverifiable` and the stored score is still shown. |

## API
`GET /api/student/analytics` — Bearer token, roles `student` and `admin`; returns the caller's own data only.
Response: `{ generatedAt, truncated, definitions, totals, history[], topics[], untaggedQuestions, recurringMisses[], retests[], focus[], unverifiable[] }`.
`truncated` is true when the 500-attempt read cap was reached.

## Known limitations / dependencies
- **Exam workstream:** `Exam.questions` is embedded and editable, and `topic` is free text. A canonical topic ID and immutable question snapshots per attempt would remove the "unverifiable" cases and make topic names exact.
- **Admin workstream:** no class / tutor / parent relationships or student↔subject enrolment exist, so cohort, tutor and parent views, and baseline-vs-matched cohort trends, are blocked on those contracts.
- **Library workstream:** recommendations cannot link to resources until topic IDs are shared.
- The student dashboard (branch `feature/student-dashboard`) is separate work; both read the same attempts and neither modifies them.

## Results export and audit trail (M8)
- `GET /api/admin/analytics/exams/:id/export.csv` (admin only) downloads cohort results as CSV (UTF-8 BOM, CRLF, formula-injection guard). It holds names and student ID only: no contact, guardian, medical or payment data, and no correct answers.
- Every export writes an `AuditLog` entry (`entityType: analytics_export`, `event: analytics.results_exported`) holding who, which exam and how many rows. It contains no student data.
- The entry is written **before** the file is sent. If it cannot be written the download is refused (generic 500). The entry and the file are not one database transaction.
- `GET /api/admin/analytics/exports` (admin only) returns the latest 20 exports. The Analytics page shows them under "Recent downloads".
