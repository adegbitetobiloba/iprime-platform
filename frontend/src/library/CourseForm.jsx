import Field from "../components/Field.jsx";

export const blankCourse = { title: "", subject: "", description: "", difficulty: "beginner", estimatedMinutes: "0", examTags: "", objectives: "", coverImageUrl: "", featured: false };

export const courseToForm = (c) => ({
  title: c.title || "", subject: (c.subject && (c.subject._id || c.subject)) || "", description: c.description || "", difficulty: c.difficulty || "beginner",
  estimatedMinutes: String(c.estimatedMinutes ?? 0), examTags: (c.examTags || []).join(", "), objectives: (c.objectives || []).join("\n"),
  coverImageUrl: c.coverImageUrl || "", featured: !!c.featured,
});

export const courseBody = (f) => ({
  title: f.title, subject: f.subject, description: f.description, difficulty: f.difficulty,
  estimatedMinutes: Number(f.estimatedMinutes) || 0,
  examTags: f.examTags.split(",").map((t) => t.trim()).filter(Boolean),
  objectives: f.objectives.split("\n").map((t) => t.trim()).filter(Boolean),
  coverImageUrl: f.coverImageUrl.trim(), featured: f.featured,
});

export default function CourseForm({ form, setForm, subjects }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <>
      <Field label="Course title" id="c-title" value={form.title} onChange={set("title")} required maxLength={150} />
      <div className="grid-2">
        <Field label="Subject" id="c-subject">
          <select id="c-subject" value={form.subject} onChange={set("subject")} required>
            <option value="">Choose a subject</option>
            {subjects.filter((s) => s.status === "active").map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Level" id="c-level">
          <select id="c-level" value={form.difficulty} onChange={set("difficulty")}>
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </select>
        </Field>
      </div>
      <Field label="Description" id="c-desc" hint="Shown to students on the course page. Required before publishing.">
        <textarea id="c-desc" rows="3" value={form.description} onChange={set("description")} maxLength={3000} />
      </Field>
      <Field label="Learning objectives (one per line)" id="c-obj">
        <textarea id="c-obj" rows="3" value={form.objectives} onChange={set("objectives")} placeholder={"Name the first ten alkanes\nDraw their structures"} />
      </Field>
      <div className="grid-2">
        <Field label="Estimated duration (minutes)" id="c-min" type="number" min="0" max="100000" value={form.estimatedMinutes} onChange={set("estimatedMinutes")} />
        <Field label="Exam tags (separate with commas)" id="c-tags" value={form.examTags} onChange={set("examTags")} hint="For example: JAMB, WAEC, NECO" />
      </div>
      <Field label="Cover image link (optional, https)" id="c-cover" value={form.coverImageUrl} onChange={set("coverImageUrl")} maxLength={500} />
      <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Feature this course on the Library home page</label>
    </>
  );
}
