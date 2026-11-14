# After deploy: 10-minute check (do these in order)

Use a test teacher email you own, and a test student account. Everything below is real data in your real database, so use clearly named test items ("TEST - delete me").

1. Open /teacher on your phone. Apply with the test email. Enter the 6-digit code. You should see "Application received".
2. Try /teacher/login now: you should be told it is waiting for approval. Try the normal /login with the same email: you should get "Invalid email or password".
3. Sign in as admin > Admin > Teachers. The menu shows a number. Open the application, press Approve. The teacher gets an email.
4. Teacher: /teacher/login > you land on the Overview.
5. Admin > Teachers > Approved > "Students and subjects". Type a subject your students are registered for (for example Chemistry). It should say how many approved enrolments it covers. Press "Give this subject group".
6. Teacher: My students. Those students should be listed (name and ID only). Open one: you should see only that subject's results.
7. Teacher: Library materials > New material > written text > Create draft > Send for review. Courses: create a course, add a chapter and a text lesson, Send for review. Tests: create a test, paste 2 questions, Send for review.
8. Admin > Teachers > Waiting for review: Inspect each, then Publish one and Return one with a note. The teacher should see "Published" and "Needs changes" with your note.
9. Admin > Teachers: Suspend the teacher with a reason. On the teacher's phone press any link: they should be locked out immediately. Reinstate.
10. Delete the test items.

If any step fails, send me the step number and a screenshot.
