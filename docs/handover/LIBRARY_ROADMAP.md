# iPrime Student Library: gap analysis and milestone plan

Compared against "iPrime Student Library: Complete Features and Functionality Requirements".
Status: DONE = built and wired; PARTIAL = some of it; NOT YET = not built. "Built" means written and unit-checked; none of it has been run against a live database or browser yet.

| Spec section | Status | What exists / what is missing |
|---|---|---|
| 1 Dashboard | PARTIAL | Have: welcome, search, continue learning, featured, recent, popular, recently viewed, saved, countdown. Missing: recommendations, recently completed, assignments, notifications, activity summary |
| 2 Subjects and categories | PARTIAL | Have: subject chips, courses by subject, topics inside courses. Missing: subject page with counts and progress, filter by topic and content type, sorting |
| 3 Course structure | PARTIAL | Have: hierarchy, objectives, duration, level, cover link, progress. Missing: tutor name, prerequisites, module count shown, last accessed, access status |
| 4 Lesson viewer | PARTIAL | Have: written, video, PDF, external link, prev/next, auto-completion, bookmark, note, resume, related, practice link. Missing: manual Mark as completed, images/audio/presentations/attachments, related questions by topic |
| 5 Resource library | PARTIAL | Have: link / PDF / written / image materials, 5 kinds, search. Missing: more kinds (formula sheets, study guides), topic, file size, date, sort, share link, download where permitted |
| 6 Search and filters | PARTIAL | Have: search courses, lessons, materials (inside written text too). Missing: suggestions, topic filter, most popular / recently accessed sorts, load-more |
| 7 My Learning | NOT YET | Only scattered pieces (continue learning, saved lessons, shelf) |
| 8 Bookmarks | PARTIAL | Have: lesson bookmarks, material shelf. Missing: course bookmarks, group by subject, one page for all |
| 9 Notes | PARTIAL | Have: one private note per lesson. Missing: several notes, edit/delete list, link to course/topic, by subject, search, My Notes page |
| 10 Progress tracking | PARTIAL | Have: lessons, video, PDF, course %, last activity. Missing: progress by subject, completed modules, recently studied topics, activity summary |
| 11 Practice integration | PARTIAL | Have: lesson linked to an existing exam, pass mark, UTME hub lists exams. Missing: topic-based questions from the Question Bank, end-of-module tests, review explanations |
| 12 Assignments | NOT YET | Needs a contract with the admin/tutor workstream |
| 13 Recommendations | NOT YET | Needs the analytics workstream's weak-topic data |
| 14 Notifications | NOT YET | Needs a shared notification contract |
| 15 PDF viewer | MOSTLY DONE | Continuous scroll, zoom, full screen, search, resume. Download is deliberately off (see decisions) |
| 16 Accessibility and reading | PARTIAL | Have: labels, keyboard, loading/empty/error states. Missing: reading preferences (text size, dark reading mode), offline message |
| 17 Admin content tools | PARTIAL | Have: subjects, courses, chapters, topics, lessons, materials, workflow. Missing: thumbnail upload, access permissions, content-manager role |
| 18 Admin analytics | PARTIAL | Have: top courses/lessons/materials, drop-off, video engagement. Missing: inactive courses, subject engagement, per-student and tutor views |
| 19 Access control | PARTIAL | Have: role checks, private files, upload validation. Missing: enrolment/payment entitlements, admin change log |
| 20 Integration | PARTIAL | Have: dashboard card (not wired), exam link, read-only analytics data. Missing: tutor dashboard |

## Milestones (one at a time; each ends tested and handed over)
- M1 (finishing now) Materials and reading: written / image / PDF / link materials, UTME syllabus text import, private reading shelf.
- M2 Library navigation, Subjects and Explore Courses: shared Library menu, subject pages with counts and progress, filters (subject, topic, content type), sorting, load-more, search suggestions.
- M3 My Learning hub: continue, in progress, completed, history, bookmarks (courses, lessons, materials) grouped by subject, My Notes (many notes, edit, delete, search), progress by subject.
- M4 Lesson viewer upgrades: Mark as completed, image/audio/presentation/attachment lessons, reading preferences and dark reading mode, related practice questions by topic (Question Bank), end-of-module test link.
- M5 Access and governance: enrolment/payment entitlements (admin workstream contract), prerequisites and tutor on courses, content-manager role, admin change log, optional per-material download permission.
- M6 Notifications and assignments: in-app notification centre, assignment view (needs agreed contracts).
- M7 Recommendations and reports: weak-topic recommendations from analytics data, inactive courses, subject engagement, tutor views.

## Decisions needed from you
1. Downloads: your original brief said no download button; this spec says "download where permitted". Proposal: off by default, a per-material "students may download" switch in M5.
2. Entitlements (M5): which enrolment status unlocks which courses (all, by programme, by subject)?
3. Notifications and assignments (M6): which workstream owns them?
