// Plain-language facts about a question pool, for the exam builder. Mirrors backend/utils/pool.js (same maths).
export const MAX_PER_STUDENT = 500;

// On average, how many questions two students' papers share if questions were drawn independently: N*N/pool.
export const expectedOverlap = (n, pool) => (pool > 0 ? (Math.min(n, pool) ** 2) / pool : 0);

// How many students can each have a completely different paper before questions must be reused.
export const fullyDifferentStudents = (n, pool) => (n > 0 ? Math.floor(pool / n) : 0);

// Returns { ok, text } describing what the administrator is setting up. `n` may be "" (everyone gets everything).
export function describe(n, pool) {
  const per = Math.floor(Number(n));
  if (!Number.isFinite(per) || per < 1) return { ok: true, text: `Every student gets all ${pool} question${pool === 1 ? "" : "s"}.` };
  if (per > MAX_PER_STUDENT) return { ok: false, text: `At most ${MAX_PER_STUDENT} questions per student.` };
  if (per >= pool) return { ok: true, text: `The pool has only ${pool} question${pool === 1 ? "" : "s"}, so every student gets all of them. Add more questions to the pool to give each student a different draw.` };
  const same = fullyDifferentStudents(per, pool);
  return {
    ok: true,
    text: `Each student gets ${per} questions drawn from a pool of ${pool}. The first ${same} student${same === 1 ? "" : "s"} get completely different questions; after that, questions are reused as evenly as possible. For completely different papers for ${Math.max(same, 100)} students you would need a pool of about ${per * Math.max(same, 100)} questions.`,
  };
}
