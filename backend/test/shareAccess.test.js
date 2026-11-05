const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../utils/shareAccess");
const L = require("../utils/lockdown");

test("tokens are long, URL-safe, and never repeat", () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) { const t = S.newToken(); assert.ok(S.looksLikeToken(t), t); seen.add(t); }
  assert.equal(seen.size, 5000);
  for (const bad of ["", "short", "x".repeat(31), "x".repeat(33), "has space and is exactly 32 chars!!", "../../etc/passwd", null, undefined, "a".repeat(31) + "$"]) assert.equal(S.looksLikeToken(bad), false);
});

test("access codes: right code passes, wrong or missing fails, no code set means open, hash is not the code", () => {
  const share = { ...S.hashCode("Prime-2027") };
  assert.ok(!JSON.stringify(share).includes("Prime-2027"));
  assert.equal(S.verifyCode("Prime-2027", share), true);
  for (const bad of ["prime-2027", "Prime-2027 ", "", undefined, null, 12345, "x"]) assert.equal(S.verifyCode(bad, share), false);
  assert.equal(S.verifyCode(undefined, {}), true);
  assert.notEqual(S.hashCode("same").codeHash, S.hashCode("same").codeHash, "each code gets its own salt");
});

test("a guest name is REQUIRED and must look like a name", () => {
  for (const good of ["Ada Obi", "Chukwuemeka O'Brien-Smith", "Ọlá Adéyẹmí", "Aïcha N’Diaye", "Mary-Jane K. Eze", "李小龙", "  Ada   Obi  "]) {
    const r = S.cleanName(good); assert.equal(r.ok, true, good);
  }
  assert.equal(S.cleanName("  Ada   Obi  ").value, "Ada Obi", "spaces tidied");
  for (const bad of ["", "   ", null, undefined, "A", "1234567", "12", "...", "<script>alert(1)</script>", "Ada<b>", "ada@x.com", "Ada; DROP TABLE", "x".repeat(61), "Ada\u0000Obi".replace("\u0000", "") === "AdaObi" ? "$$$" : "$$$", "Ada 2nd", "!!!"]) {
    const r = S.cleanName(bad); assert.equal(r.ok, false, `should reject ${JSON.stringify(bad)}`); assert.ok(r.error);
  }
  assert.equal(S.cleanName("Ada\u0007 Obi\u200b").value, "Ada Obi", "control and zero-width characters removed");
});

test("contact: blank is allowed, email and phone are normalised, junk is refused", () => {
  assert.deepEqual(S.cleanContact(""), { ok: true, value: "", key: "" });
  assert.equal(S.cleanContact("Ada@Example.com").key, "ada@example.com");
  assert.equal(S.cleanContact("+234 803-123 4567").key, "2348031234567");
  assert.equal(S.cleanContact("0803 123 4567").key, "08031234567");
  for (const bad of ["abc", "12", "a@b", "<x@y.com>", "x".repeat(130), "123456789012345678"]) assert.equal(S.cleanContact(bad).ok, false, bad);
});

test("link state: every reason a link cannot be used is reported, in a sensible order", () => {
  const now = new Date("2026-11-03T10:00:00Z"); const pub = { status: "published" };
  assert.equal(S.shareState({}, pub, now), "open");
  assert.equal(S.shareState(null, pub, now), "invalid");
  assert.equal(S.shareState({ revokedAt: new Date() }, pub, now), "revoked");
  assert.equal(S.shareState({ expiresAt: new Date("2026-11-03T09:59:00Z") }, pub, now), "expired");
  assert.equal(S.shareState({ expiresAt: new Date("2026-11-03T10:01:00Z") }, pub, now), "open");
  assert.equal(S.shareState({}, { status: "draft" }, now), "unavailable");
  assert.equal(S.shareState({}, null, now), "unavailable");
  assert.equal(S.shareState({}, { ...pub, availableFrom: new Date("2026-11-04") }, now), "not_yet");
  assert.equal(S.shareState({}, { ...pub, availableUntil: new Date("2026-11-02") }, now), "closed");
  assert.equal(S.shareState({ maxUses: 5, uses: 5 }, pub, now), "full");
  assert.equal(S.shareState({ maxUses: 5, uses: 4 }, pub, now), "open");
  assert.equal(S.shareState({ revokedAt: new Date(), expiresAt: new Date("2020-01-01") }, pub, now), "revoked");
});

// ---------- locked browser ----------
const fakeReq = (url, headers = {}, host = "api.example.com") => ({ protocol: "https", originalUrl: url, headers, get: (h) => (h.toLowerCase() === "host" ? host : undefined) });
const KEY = "a".repeat(64), KEY2 = "b".repeat(64), CFG = "c".repeat(64);
const hashFor = (url, key) => require("crypto").createHash("sha256").update(url + key).digest("hex");

test("locked browser: a request whose hash matches an approved Browser Exam Key is accepted", () => {
  const url = "/api/attempts/abc/answers";
  const r = L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor("https://api.example.com" + url, KEY) }), { browserExamKeys: [KEY2, KEY] });
  assert.deepEqual(r, { sebDetected: true, ok: true, via: "browserExamKey" });
});

test("locked browser: Config Key hashes work too, and header case does not matter", () => {
  const url = "/api/exams/1/start";
  const r = L.check(fakeReq(url, { "x-safeexambrowser-configkeyhash": hashFor("https://api.example.com" + url, CFG).toUpperCase() }), { configKeys: [CFG.toUpperCase()] });
  assert.equal(r.ok, true); assert.equal(r.via, "configKey");
});

test("locked browser: everything that should be refused, is", () => {
  const url = "/api/exams/1/start", full = "https://api.example.com" + url;
  const lb = { browserExamKeys: [KEY], configKeys: [CFG] };
  assert.equal(L.check(fakeReq(url), lb).ok, false, "no headers");
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor(full, "d".repeat(64)) }), lb).ok, false, "unknown key");
  assert.equal(L.check(fakeReq("/api/exams/2/start", { "x-safeexambrowser-requesthash": hashFor(full, KEY) }), lb).ok, false, "a hash copied from a different URL");
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor("http://api.example.com" + url, KEY) }), lb).ok, false, "same URL over http");
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor(full, KEY) }, "evil.example.com"), lb).ok, false, "different host");
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor(full, KEY) }), { browserExamKeys: [] }).ok, false, "no keys configured");
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": "nonsense" }), lb).ok, false);
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-configkeyhash": hashFor(full, KEY) }), lb).ok, false, "a Browser Exam Key hash sent in the config header");
  const ua = L.check(fakeReq(url, { "user-agent": "Mozilla/5.0 SEB/3.5.0" }), lb);
  assert.deepEqual([ua.sebDetected, ua.ok], [true, false], "the user agent alone is detected but never trusted");
});

test("locked browser: the query string is part of the URL being hashed", () => {
  const url = "/api/attempts/1?x=1";
  assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor("https://api.example.com" + url, KEY) }), { browserExamKeys: [KEY] }).ok, true);
  assert.equal(L.check(fakeReq("/api/attempts/1?x=2", { "x-safeexambrowser-requesthash": hashFor("https://api.example.com" + url, KEY) }), { browserExamKeys: [KEY] }).ok, false);
});

test("locked browser: SEB_URL_BASE overrides the host when a proxy changes it", () => {
  process.env.SEB_URL_BASE = "https://api.prime.ng/";
  try {
    const url = "/api/exams/1/start";
    assert.equal(L.check(fakeReq(url, { "x-safeexambrowser-requesthash": hashFor("https://api.prime.ng" + url, KEY) }, "internal-host"), { browserExamKeys: [KEY] }).ok, true);
  } finally { delete process.env.SEB_URL_BASE; }
});

test("keys are cleaned: only 64-hex values, lower-cased, no duplicates, at most 10", () => {
  assert.deepEqual(L.normaliseKeys([KEY.toUpperCase(), KEY, " " + KEY2 + " ", "short", 123, null, "z".repeat(64)]), [KEY, KEY2]);
  assert.equal(L.normaliseKeys(Array.from({ length: 30 }, (_, i) => i.toString(16).padStart(64, "0"))).length, 10);
  assert.deepEqual(L.normaliseKeys("not a list"), []);
});
