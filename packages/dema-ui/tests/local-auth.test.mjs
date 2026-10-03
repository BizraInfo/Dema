import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCookieHeader,
  configuredLocalSecret,
  cookieHeader,
  isLoopbackHost,
  issueLocalSession,
  LOCAL_SESSION_TTL_SECONDS,
  parseCookieHeader,
  safeNextPath,
  secretsEqual,
  secretStatus,
  verifyLocalSession,
} from "../src/lib/auth/session-boundary-core.mjs";

const SECRET = "local-auth-secret-0123456789abcdef0123456789";
const NOW = Date.UTC(2026, 8, 14, 0, 0, 0);

test("local auth requires an explicit usable secret", () => {
  assert.deepEqual(secretStatus({}), { configured: false, usable: false, reason: "missing_secret" });
  assert.deepEqual(secretStatus({ DEMA_LOCAL_AUTH_SECRET: "short" }), { configured: true, usable: false, reason: "secret_too_short" });
  assert.equal(configuredLocalSecret({ AUTH_PROVIDER: "oauth", AUTH_SECRET: SECRET }), null);
  assert.equal(configuredLocalSecret({ AUTH_PROVIDER: "local", AUTH_SECRET: SECRET }), SECRET);
  assert.deepEqual(secretStatus({ DEMA_LOCAL_AUTH_SECRET: SECRET }), { configured: true, usable: true, reason: null });
});

test("only loopback hosts are eligible for the local boundary", () => {
  for (const host of ["localhost", "localhost:3000", "127.0.0.1:3000", "[::1]:3000", "::1"]) {
    assert.equal(isLoopbackHost(host), true, host);
  }
  for (const host of ["", "example.test", "192.168.1.10:3000", "0.0.0.0:3000", "localhost:bad", "[::1]evil", "::1:3000", null]) {
    assert.equal(isLoopbackHost(host), false, String(host));
  }
});

test("session is signed, short-lived, and tamper evident", () => {
  const session = issueLocalSession(SECRET, NOW);
  assert.equal(typeof session, "string");
  assert.equal(session.includes(SECRET), false);
  assert.deepEqual(verifyLocalSession(session, SECRET, NOW + 1_000), {
    ok: true,
    issuedAt: Math.floor(NOW / 1000),
    expiresAt: Math.floor(NOW / 1000) + LOCAL_SESSION_TTL_SECONDS,
  });
  assert.equal(verifyLocalSession(`${session}x`, SECRET, NOW).ok, false);
  assert.equal(verifyLocalSession(session, `${SECRET}x`, NOW).ok, false);
  assert.equal(verifyLocalSession(session, SECRET, NOW + (LOCAL_SESSION_TTL_SECONDS + 1) * 1_000).reason, "expired_session");
  assert.equal(verifyLocalSession(session, SECRET, NOW - 60_000).reason, "future_session");
});

test("cookie contract is HttpOnly, Strict, bounded, and parseable", () => {
  const session = issueLocalSession(SECRET, NOW);
  const header = cookieHeader(session);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, new RegExp(`Max-Age=${LOCAL_SESSION_TTL_SECONDS}`));
  assert.equal(parseCookieHeader(header), session);
  assert.match(clearCookieHeader(), /Max-Age=0/);
});

test("comparison and redirect target fail closed", () => {
  assert.equal(secretsEqual(SECRET, SECRET), true);
  assert.equal(secretsEqual(SECRET, `${SECRET}x`), false);
  assert.equal(safeNextPath("/mission"), "/mission");
  assert.equal(safeNextPath("https://evil.example"), "/realm");
  assert.equal(safeNextPath("//evil.example"), "/realm");
  assert.equal(safeNextPath("/\\evil.example"), "/realm");
  assert.equal(safeNextPath("/realm\nLocation: https://evil.example"), "/realm");
});
