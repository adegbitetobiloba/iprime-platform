import test from "node:test";
import assert from "node:assert/strict";
import { layoutPage, layoutDocument, findGutter } from "../../src/lib/import/pdfLayout.js";
import { parseIdLines } from "../../src/lib/import/idParser.js";
import { page, column, line, footer, q, filler, W, H } from "./helpers.mjs";

const texts = (lay, pg) => lay.lines.filter((l) => l.page === pg).map((l) => `${l.col}:${l.text}`);

test("two questions side by side are read left column first, then right (not merged by y)", () => {
  const L = [...q("ORL-0001", "film", ["salt", "psalm", "walk", "chalk"], "A", ["Salt. The l is silent."], "E2-X02-Q094"), ...filler(3, 20)];
  const R = [...q("ORL-0002", "English", ["singe", "ink", "orange", "impugn"], "B", ["The sound is n."], "E2-X02-Q095"), ...filler(40, 20)];
  const items = [...column("L", 40, L), ...column("R", 40, R)];
  const lay = layoutPage(page(1, items));
  assert.equal(lay.mode, "columns");
  const t = texts(lay, 1);
  assert.ok(t.indexOf("L:ORL-0001 film") < t.indexOf("R:ORL-0002 English"));
  assert.equal(t.findIndex((x) => x.startsWith("R:")) > t.findLastIndex((x) => x.startsWith("L:")), true, "all left lines precede all right lines");
  const { questions } = parseIdLines(layoutDocument([page(1, items)]).lines);
  const q1 = questions.find((x) => x.externalId === "ORL-0001"), q2 = questions.find((x) => x.externalId === "ORL-0002");
  assert.deepEqual(q1.options.map((o) => o.text), ["salt", "psalm", "walk", "chalk"]);
  assert.deepEqual(q2.options.map((o) => o.text), ["singe", "ink", "orange", "impugn"]);
});

test("a question continuing from the bottom of the left column to the top of the right column stays whole", () => {
  const Lfill = filler(10, 24);
  const Ltail = ["ORL-0100 Which word rhymes with doubt?", "A. route", "B. float"];
  const Rhead = ["C. out", "D. goat", "Answer: C", "Doubt and out rhyme.", "Source: E4-X04-Q001"];
  const items = [...column("L", 40, [...Lfill, ...Ltail]), ...column("R", 40, [...Rhead, ...filler(200, 20)])];
  const { questions } = parseIdLines(layoutDocument([page(1, items)]).lines);
  const x = questions.find((k) => k.externalId === "ORL-0100");
  assert.deepEqual(x.options.map((o) => o.key + o.text), ["Aroute", "Bfloat", "Cout", "Dgoat"]);
  assert.equal(x.correctKey, "C");
  assert.equal(x.explanation, "Doubt and out rhyme.");
});

test("a question continuing across pages keeps provenance for both pages", () => {
  const p1 = page(1, [...column("L", 40, filler(1, 24)), ...column("R", 40, [...filler(50, 17), "ORL-0300 stem at page end", "A. one", "B. two"]), ...footer(1)]);
  const p2 = page(2, [...column("L", 40, ["C. three", "D. four", "Answer: D", "Explanation text.", "Source: E2-X09-Q009", ...filler(70, 20)]), ...column("R", 40, filler(120, 20)), ...footer(2)]);
  const { questions } = parseIdLines(layoutDocument([p1, p2]).lines);
  const x = questions.find((k) => k.externalId === "ORL-0300");
  assert.equal(x.options.length, 4);
  assert.deepEqual([x.provenance.pageStart, x.provenance.pageEnd], [1, 2]);
});

test("spanning headings are read in y order between column regions", () => {
  const above = ["above-L1", "above-L2", ...filler(1, 8)];
  const aboveR = ["above-R1", "above-R2", ...filler(30, 8)];
  const items = [
    ...column("L", 40, above), ...column("R", 40, aboveR),
    ...line(34, 330, "SECTION HEADING ACROSS BOTH COLUMNS", 400),
    ...column("L", 350, ["below-L1", ...filler(60, 8)]), ...column("R", 350, ["below-R1", ...filler(90, 8)]),
  ];
  const lay = layoutPage(page(1, items));
  assert.equal(lay.mode, "columns");
  const t = texts(lay, 1).map((s) => s.split(":").slice(1).join(":"));
  const i = (s) => t.indexOf(s);
  assert.ok(i("above-L2") < i("above-R1") && i("above-R2") < i("SECTION HEADING ACROSS BOTH COLUMNS") && i("SECTION HEADING ACROSS BOTH COLUMNS") < i("below-L1") && i("below-L1") < i("below-R1"));
});

test("pages with no gutter (table with a wide gap) fall back to single-column reading", () => {
  const rows = ["Consonant sounds", "Emphatic stress", "Rhymes", "Vowel sounds", "Word stress", "Extra one", "Extra two", "Extra three"];
  const items = rows.flatMap((r, i) => [...line(130, 300 + i * 14, r, 80), ...line(440, 300 + i * 14, String(80 + i), 20)]);
  const lay = layoutPage(page(1, items));
  assert.equal(lay.mode, "single");
  assert.equal(lay.lines[0].text, "Consonant sounds 80");
});

test("whitespace-only items that stretch across the gutter do not hide it", () => {
  const items = [...column("L", 40, filler(1, 24)), ...column("R", 40, filler(30, 24))];
  for (let i = 0; i < 30; i++) items.push({ str: " ", x: 224, y: H - (40 + i * 11.6), w: 312, h: 8 });
  assert.equal(layoutPage(page(1, items)).mode, "columns");
});

test("headers/footers are removed even when digits differ and one page merges them into a single line", () => {
  const pages = [];
  const words = ["apple", "river", "stone", "cloud", "ember", "frost", "grain", "haze", "ivory", "jolt"]; // distinct per page: real body text does not repeat
  for (let n = 1; n <= 10; n++) pages.push(page(n, [...column("L", 40, [`body ${words[n - 1]}`, ...filler(n * 10, 6)]), ...footer(n, n === 7)]));
  const lay = layoutDocument(pages);
  assert.ok(lay.lines.every((l) => !/Prime Excelerate|^Page \d+$/.test(l.text)), "no furniture left");
  assert.ok(lay.lines.some((l) => l.text === "body ivory"), "body kept");
  assert.ok(lay.removed.length >= 10);
});

test("findGutter rejects too few items and returns null safely", () => {
  assert.equal(findGutter([], W), null);
});
