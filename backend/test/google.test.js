const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { verifyGoogleIdToken, createNonceStore, GoogleAuthError } = require("../utils/googleAuth");

// A throwaway RSA key pair stands in for Google's. The verifier is given the matching public key as a JWK.
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key1", alg: "RS256", use: "sig" };
const fetchKeys = async () => [jwk];

const b64u = (b) => Buffer.from(b).toString("base64url");
const CLIENT = "client-123.apps.googleusercontent.com";
const NOW = 1_800_000_000_000; // fixed clock (ms)
const nowSec = NOW / 1000;

function sign(payload, { key = privateKey, header = { alg: "RS256", kid: "key1", typ: "JWT" } } = {}) {
  const h = b64u(JSON.stringify(header)), p = b64u(JSON.stringify(payload));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), key);
  return `${h}.${p}.${b64u(sig)}`;
}
const good = { iss: "https://accounts.google.com", aud: CLIENT, sub: "1234567890", email: "ada@gmail.com", email_verified: true, iat: nowSec - 10, exp: nowSec + 3000, given_name: "Ada" };
const verify = (t, opts = {}) => verifyGoogleIdToken(t, { clientId: CLIENT, fetchKeys, nowMs: () => NOW, ...opts });
const rejects = async (promise, code) => { await assert.rejects(promise, (e) => e instanceof GoogleAuthError && e.code === code, `expected ${code}`); };

test("a correctly signed token for our client id is accepted", async () => {
  const p = await verify(sign(good));
  assert.equal(p.email, "ada@gmail.com");
  assert.equal(p.sub, "1234567890");
});
test("accounts.google.com without https is also a valid issuer", async () => {
  await verify(sign({ ...good, iss: "accounts.google.com" }));
});
test("a token meant for a different app (wrong audience) is rejected", async () => {
  await rejects(verify(sign({ ...good, aud: "someone-elses-client" })), "INVALID_TOKEN");
});
test("a token from another issuer is rejected", async () => {
  await rejects(verify(sign({ ...good, iss: "https://evil.example" })), "INVALID_TOKEN");
});
test("an expired token is rejected", async () => {
  await rejects(verify(sign({ ...good, exp: nowSec - 3600 })), "EXPIRED");
});
test("an email Google has not verified is rejected", async () => {
  await rejects(verify(sign({ ...good, email_verified: false })), "EMAIL_NOT_VERIFIED");
});
test("a token whose contents were changed after signing is rejected", async () => {
  const [h, , s] = sign(good).split(".");
  const forged = b64u(JSON.stringify({ ...good, email: "admin@victim.com" }));
  await rejects(verify(`${h}.${forged}.${s}`), "INVALID_TOKEN");
});
test("a token signed with a different private key is rejected even if it claims our key id", async () => {
  await rejects(verify(sign(good, { key: other.privateKey })), "INVALID_TOKEN");
});
test("alg none and HS256 tokens are rejected", async () => {
  const none = `${b64u(JSON.stringify({ alg: "none", kid: "key1" }))}.${b64u(JSON.stringify(good))}.`;
  await rejects(verify(none), "INVALID_TOKEN");
  const hs = sign(good, { header: { alg: "HS256", kid: "key1" } });
  await rejects(verify(hs), "INVALID_TOKEN");
});
test("an unknown key id is rejected", async () => {
  await rejects(verify(sign(good, { header: { alg: "RS256", kid: "nope" } })), "INVALID_TOKEN");
});
test("garbage input is rejected without crashing", async () => {
  for (const bad of ["", "abc", "a.b.c", "a.b", null, undefined, 42, "x".repeat(5000)]) await rejects(verify(bad), "INVALID_TOKEN");
});
test("without a configured client id the verifier says so instead of accepting anything", async () => {
  await rejects(verifyGoogleIdToken(sign(good), { clientId: "", fetchKeys, nowMs: () => NOW }), "NOT_CONFIGURED");
});
test("if Google's keys cannot be fetched, sign-in fails safely", async () => {
  await assert.rejects(verify(sign(good), { fetchKeys: async () => { throw new GoogleAuthError("KEYS_UNAVAILABLE"); } }), (e) => e.code === "KEYS_UNAVAILABLE");
});

test("a nonce works once, only once", () => {
  const s = createNonceStore();
  const n = s.issue();
  assert.equal(s.consume(n), true);
  assert.equal(s.consume(n), false); // replay
  assert.equal(s.consume("never-issued"), false);
  assert.equal(s.consume(undefined), false);
});
test("a nonce expires", () => {
  let t = 1000;
  const s = createNonceStore({ ttlMs: 60_000, nowMs: () => t });
  const n = s.issue();
  t += 61_000;
  assert.equal(s.consume(n), false);
});
