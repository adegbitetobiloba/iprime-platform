const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeHtml: s, htmlToText: t, looksLikeHtml: l } = require("../utils/html");

const ATTACKS = [
  "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<p onclick=\"evil()\">a</p>", "<a href=\"javascript:alert(1)\">x</a>",
  "<svg onload=alert(1)></svg>", "<iframe src=//evil></iframe>", "<style>*{display:none}</style>", "<<script>script>alert(1)<</script>/script>",
  "<scr<script>ipt>alert(1)</script>", "<img/src=x onerror=alert(1)>", "<math><mi>x</mi></math>", "<object data=x></object>", "<div style=\"x\" onmouseover=\"y\">d</div>",
];

test("sanitiser: no attack payload leaves a tag, attribute or script behind", () => {
  for (const a of ATTACKS) {
    const out = s(a);
    assert.ok(!/<(script|img|svg|iframe|style|a|object|math|div)\b/i.test(out), `${a} -> ${out}`);
    assert.ok(!/\son\w+\s*=/i.test(out) && !/javascript:/i.test(out), `${a} -> ${out}`);
  }
});

test("sanitiser keeps the formatting questions depend on: paragraphs, line breaks, underline, bold, italic, sub/superscript", () => {
  const html = "<p>Same sound as the <u>ed</u> in <strong>watched</strong>, H<sub>2</sub>O and x<sup>2</sup><br><em>Choose</em></p><hr>";
  assert.equal(s(html), html);
});

test("sanitiser never keeps attributes, and closes or ignores badly nested tags", () => {
  assert.equal(s('<p class="x" style="color:red">a</p>'), "<p>a</p>");
  assert.equal(s("<u>ok</u><b>bold"), "<u>ok</u><b>bold</b>");
  assert.equal(s("<p>a</p></p></u>"), "<p>a</p>");
});

test("maths-style text with < and > is kept as text, and a stray < cannot swallow a real closing tag", () => {
  assert.equal(s("a < b and c > d"), "a &lt; b and c &gt; d");
  assert.equal(s("<p>1 < 2</p>"), "<p>1 &lt; 2</p>");
  assert.equal(s("5 & 6"), "5 &amp; 6");
  assert.equal(s("&lt;script&gt;"), "&lt;script&gt;");
});

test("htmlToText: plain text for search and empty-checks; an 'empty' <p> </p> is empty", () => {
  assert.equal(t("<p>Hello&nbsp;<u>wor</u>ld</p><p>Line 2<br>3</p>"), "Hello world\nLine 2\n3");
  assert.equal(t("<p> </p>"), "");
  assert.equal(t("<p>Fe&sup2;</p>"), "Fe&sup2;"); // unknown named entities are left as they are, never guessed
});

test("looksLikeHtml distinguishes real formatting tags from maths", () => {
  assert.equal(l("x<y and y>z"), false);
  assert.equal(l("<p>x</p>"), true);
  assert.equal(l("the <u>ed</u> sound"), true);
});
