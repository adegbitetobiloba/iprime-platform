# Library v4 (milestone M1): materials and reading, syllabus text, private shelf

Cumulative on top of v3 (replace same-named files; new files are added). Upload by dragging the `backend` and `frontend` FOLDERS.
Full plan and gap analysis against your feature specification: LIBRARY_ROADMAP.md.

## One shared file to edit: frontend/src/App.jsx (1 import, 1 route; plus the three v3 routes if not yet added)
    import LibraryShelf from "./pages/LibraryShelf.jsx";
    <Route path="/library/shelf" element={<Protected><LibraryShelf /></Protected>} />
(v3 routes, if missing: /library/utme, /library/materials, /library/materials/:id.) No backend shared files change, no new packages.

## What is new
1. Study materials now come in four forms: written text, images, PDF, web link. Admin chooses how to add each one.
   - Written text: fastest on weak phones. Students get a contents list, search by topic inside the text (type "Doppler"), and "continue where I stopped".
   - Images (photos or scans): stored privately, loaded as you scroll, zoom and full screen. Big phone photos are shrunk in the browser before upload.
   - Library search also looks inside written materials, so a topic finds the syllabus that mentions it.
2. UTME syllabus text: Admin > Library > Study materials > "Import the UTME syllabus texts" adds Physics, English Language, Mathematics and
   Chemistry as DRAFTS (cleaned from the PDFs you supplied; tagged JAMB; linked to the subject if it exists). Check each against JAMB's official
   syllabus (see backend/data/UTME_SYLLABI_REVIEW.md for every repair and the few items left for you to check) and press Publish.
3. Private reading shelf (modelled on Open Library's reading log): Want to read / Reading / Finished, with a progress bar. Opening a material puts it on
   Reading; reaching the end moves it to Finished once; the student can change it any time. Page: /library/shelf. "Continue reading" row on the Library home.
4. Related materials under each material; PDF progress now feeds the shelf.

## Study of existing library sites (what was borrowed)
Internet Archive BookReader: lazy page loading, search inside with snippets, contents markers, touch zoom, full screen on phones.
Open Library: reading-log shelves (private by default) and curated lists. Reader-curated lists are not built yet (candidate for M3).

## First test
1. Admin > Library > Study materials > Import the UTME syllabus texts. Open Physics: check the text, Publish.
2. Student: /library/utme lists the syllabus; open it, search "Doppler", use Contents, scroll, leave, come back: "Continue where I stopped".
3. Admin: Add material > Upload images > choose 2 photos > Save > Publish. Student opens it: images load as you scroll.

## Limits (honest)
- NOT run: no MongoDB, server or browser here. 17/17 unit tests pass (range, countdown, upload checks incl. images, reading percent, completion rules);
  all backend files pass a syntax check. React files, GridFS streaming and the new API routes are unverified until you build and try them.
- Syllabus texts came from a third-party compilation of JAMB's syllabus; verify before publishing.
- Browser protection only deters casual saving; screenshots cannot be blocked.
