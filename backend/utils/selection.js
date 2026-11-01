// Chooses questions for an examination from the question bank. Pure (no database) so it is tested on its own.
// The caller passes ONLY eligible questions (active, usable, optionally verified); this module never widens that set.
const { rngFrom, newSeed, shuffled } = require("./randomise");

const LEVELS = ["easy", "medium", "hard"];
const DEFAULT_MIX = { easy: 30, medium: 50, hard: 20 };

// Splits `total` across weights using largest remainders, so the parts always add up exactly.
function apportion(total, weights) {
  const sum = LEVELS.reduce((n, k) => n + (weights[k] || 0), 0) || 1;
  const raw = LEVELS.map((k) => ((weights[k] || 0) / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return Object.fromEntries(LEVELS.map((k, i) => [k, out[i]]));
}

// Takes up to k items. With balance on, each pick comes from the topic with the FEWEST chosen so far (shared `counts`
// across every call, manual picks included), so topic totals never drift apart by more than one while questions last.
function take(list, k, balance, rng, counts) {
  if (k <= 0 || !list.length) return [];
  const mixed = shuffled(list, rng);
  if (!balance) return mixed.slice(0, k);
  const byTopic = new Map();
  for (const q of mixed) { const t = q.topic || ""; if (!byTopic.has(t)) byTopic.set(t, []); byTopic.get(t).push(q); }
  const out = [];
  while (out.length < k) {
    const open = [...byTopic.entries()].filter(([, qs]) => qs.length);
    if (!open.length) break;
    const least = Math.min(...open.map(([t]) => counts.get(t) || 0));
    const tied = shuffled(open.filter(([t]) => (counts.get(t) || 0) === least), rng);
    const [t, qs] = tied[0];
    out.push(qs.shift());
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return out;
}

/**
 * pool:  [{ id, topic, difficulty|null }]  (already filtered to eligible questions)
 * opts:  { count, topics: [], manualIds: [], excludeIds: [], balanceTopics: true, difficulty: { mode: "any"|"mix", mix: {easy,medium,hard} }, seed }
 */
function selectQuestions(pool, opts = {}) {
  const count = Math.max(0, Math.floor(opts.count || 0));
  const rng = rngFrom(opts.seed || newSeed());
  const balance = opts.balanceTopics !== false;
  const topics = (opts.topics || []).filter(Boolean);
  const exclude = new Set((opts.excludeIds || []).map(String));
  const notes = [];

  const byId = new Map(pool.map((q) => [String(q.id), q]));
  // Manual picks: kept exactly, in the order given, if they are eligible. Anything else is reported, not silently dropped.
  const manual = [], seenManual = new Set();
  for (const id of (opts.manualIds || []).map(String)) {
    if (seenManual.has(id)) continue;
    seenManual.add(id);
    if (byId.has(id)) manual.push(byId.get(id));
    else notes.push({ code: "MANUAL_NOT_ELIGIBLE", id });
  }
  const chosenIds = new Set(manual.map((q) => String(q.id)));
  const counts = new Map(); // picks per topic so far; manual picks count towards the balance
  for (const q of manual) counts.set(q.topic || "", (counts.get(q.topic || "") || 0) + 1);

  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  const candidates = pool.filter((q) => !chosenIds.has(String(q.id)) && !exclude.has(String(q.id)) && (!topicSet.size || topicSet.has(String(q.topic || "").toLowerCase())));
  for (const t of topics) if (!candidates.some((q) => String(q.topic || "").toLowerCase() === t.toLowerCase()) && !manual.some((q) => String(q.topic || "").toLowerCase() === t.toLowerCase())) notes.push({ code: "TOPIC_EMPTY", topic: t });

  const need = Math.max(0, count - manual.length);
  if (manual.length > count && count > 0) notes.push({ code: "MANUAL_EXCEEDS_COUNT", manual: manual.length, count });

  let picked = [];
  const mix = opts.difficulty && opts.difficulty.mode === "mix";
  if (mix && need > 0) {
    const targets = apportion(need, { ...DEFAULT_MIX, ...(opts.difficulty.mix || {}) });
    const rated = (lvl) => candidates.filter((q) => q.difficulty === lvl);
    const unrated = candidates.filter((q) => !LEVELS.includes(q.difficulty));
    if (!LEVELS.some((l) => rated(l).length)) notes.push({ code: "NO_DIFFICULTY_DATA", unrated: unrated.length });
    for (const lvl of LEVELS) picked.push(...take(rated(lvl), targets[lvl], balance, rng, counts));
    const got = new Set(picked.map((q) => String(q.id)));
    const lacking = LEVELS.filter((l) => picked.filter((q) => q.difficulty === l).length < targets[l]);
    for (const l of lacking) notes.push({ code: "LEVEL_SHORT", level: l, wanted: targets[l], got: picked.filter((q) => q.difficulty === l).length });
    // Fill any gap from the rest: rated questions first, then unrated.
    let gap = need - picked.length;
    if (gap > 0) { const rest = candidates.filter((q) => !got.has(String(q.id))); const fill = take(rest.filter((q) => LEVELS.includes(q.difficulty)), gap, balance, rng, counts); picked.push(...fill); fill.forEach((q) => got.add(String(q.id))); gap = need - picked.length; }
    if (gap > 0) { const fill = take(unrated.filter((q) => !got.has(String(q.id))), gap, balance, rng, counts); picked.push(...fill); }
  } else {
    picked = take(candidates, need, balance, rng, counts);
  }

  // Final order is random (not grouped by difficulty or topic). With question shuffling off, this is the order every student sees.
  const all = shuffled([...manual, ...picked], rng);
  const shortfall = Math.max(0, count - all.length);
  if (shortfall > 0) notes.push({ code: "SHORTFALL", wanted: count, got: all.length });
  const tally = (key, fallback) => all.reduce((m, q) => { const k = (key(q) || fallback); m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    picked: all, shortfall, notes,
    breakdown: { byTopic: tally((q) => q.topic, "(no topic)"), byDifficulty: tally((q) => (LEVELS.includes(q.difficulty) ? q.difficulty : null), "unrated") },
    manualCount: manual.length,
  };
}

module.exports = { selectQuestions, apportion, LEVELS, DEFAULT_MIX };
