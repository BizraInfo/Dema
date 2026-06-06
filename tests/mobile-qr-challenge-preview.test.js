import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildMobileQrChallengePreview,
  verifyMobileQrChallengePreview,
  resetConsumedChallengesForTestsOnly,
  MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA,
} from "../packages/consent/src/mobile-qr-challenge-preview.js";
import { buildBoundaryInvariantCheckReport } from "../scripts/review/boundary-invariant-check.mjs";

const modulePath = fileURLToPath(
  new URL(
    "../packages/consent/src/mobile-qr-challenge-preview.js",
    import.meta.url,
  ),
);

const FIXED_NOW = new Date("2026-05-16T11:30:00.000Z");
const VALID_ARGS = {
  mission_id: "M-001",
  action: "read",
  purpose: "preview consent flow for a mission",
  now: FIXED_NOW,
};

test("T-01 builder emits canonical schema and PREVIEW_ONLY", () => {
  resetConsumedChallengesForTestsOnly();
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  assert.equal(ch.schema, MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA);
  assert.equal(ch.schema, "bizra.dema.mobile_qr_challenge_preview.v0.1");
  assert.equal(ch.mode, "PREVIEW_ONLY");
  assert.equal(ch.truth_label, "DECLARED");
  assert.equal(ch.valid, true);
});

test("T-02 valid challenge has all required fields", () => {
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  assert.equal(typeof ch.challenge_id, "string");
  assert.match(ch.challenge_id, /^chal-[0-9a-f]{32}$/);
  assert.equal(typeof ch.phrase, "string");
  assert.match(ch.phrase, /^\d{6}$/);
  assert.match(ch.phrase_fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Date.parse(ch.expires_at) > FIXED_NOW.getTime());
});

test("T-03 default expiry is 90 seconds in the future", () => {
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  const diff = Date.parse(ch.expires_at) - FIXED_NOW.getTime();
  assert.equal(diff, 90_000);
});

test("T-04 deterministic: same args produce same challenge_id + same phrase", () => {
  const a = buildMobileQrChallengePreview(VALID_ARGS);
  const b = buildMobileQrChallengePreview(VALID_ARGS);
  assert.equal(a.challenge_id, b.challenge_id);
  assert.equal(a.phrase, b.phrase);
});

test("T-05 different intent produces different phrase", () => {
  const a = buildMobileQrChallengePreview(VALID_ARGS);
  const b = buildMobileQrChallengePreview({ ...VALID_ARGS, action: "write" });
  assert.notEqual(a.phrase, b.phrase);
  assert.notEqual(a.challenge_id, b.challenge_id);
});

test("T-06 invalid arguments produce a fail-closed challenge with valid=false", () => {
  for (const bad of [{ mission_id: "" }, { action: "" }, { purpose: "" }]) {
    const ch = buildMobileQrChallengePreview({ ...VALID_ARGS, ...bad });
    assert.equal(ch.valid, false);
    assert.ok(ch.denial);
  }
});

test("T-07 boundary keeps all 8 authority flags false", () => {
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "network_used",
    "secret_persisted_on_phone",
    "phone_authority_granted",
    "socket_opened",
    "hook_executed",
  ]) {
    assert.equal(ch.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("T-08 verify ok=true when typed phrase matches", () => {
  resetConsumedChallengesForTestsOnly();
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  const result = verifyMobileQrChallengePreview(ch, ch.phrase, {
    now: FIXED_NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "verified");
  assert.equal(result.not_an_authorization, false);
});

test("T-09 verify ok=false reason=phrase_mismatch on wrong phrase", () => {
  resetConsumedChallengesForTestsOnly();
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  const result = verifyMobileQrChallengePreview(ch, "000000", {
    now: FIXED_NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "phrase_mismatch");
  assert.equal(result.not_an_authorization, true);
});

test("T-10 verify ok=false reason=expired after expiry window", () => {
  resetConsumedChallengesForTestsOnly();
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  const later = new Date(FIXED_NOW.getTime() + 91_000);
  const result = verifyMobileQrChallengePreview(ch, ch.phrase, { now: later });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired");
});

test("T-11 verify ok=false reason=replay on second consumption", () => {
  resetConsumedChallengesForTestsOnly();
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  const first = verifyMobileQrChallengePreview(ch, ch.phrase, {
    now: FIXED_NOW,
  });
  assert.equal(first.ok, true);
  const second = verifyMobileQrChallengePreview(ch, ch.phrase, {
    now: FIXED_NOW,
  });
  assert.equal(second.ok, false);
  assert.equal(second.reason, "replay");
});

test("T-12 verify ok=false reason=invalid_challenge on null/malformed challenge", () => {
  const result1 = verifyMobileQrChallengePreview(null, "123456", {
    now: FIXED_NOW,
  });
  assert.equal(result1.ok, false);
  assert.equal(result1.reason, "invalid_challenge");

  const result2 = verifyMobileQrChallengePreview({ valid: false }, "123456", {
    now: FIXED_NOW,
  });
  assert.equal(result2.ok, false);
  assert.equal(result2.reason, "invalid_challenge");
});

test("T-13 verify ok=false reason=missing_phrase on empty typed phrase", () => {
  resetConsumedChallengesForTestsOnly();
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  const result = verifyMobileQrChallengePreview(ch, "", { now: FIXED_NOW });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_phrase");
});

test("T-14 challenge object is deeply frozen", () => {
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  assert.ok(Object.isFrozen(ch));
  assert.ok(Object.isFrozen(ch.boundary));
});

test("T-15 module is pure (no fs/http/net/child_process imports)", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body));
  assert.ok(!/from ['"]node:http/.test(body));
  assert.ok(!/from ['"]node:net/.test(body));
  assert.ok(!/from ['"]node:child_process/.test(body));
  assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body));
});

test("T-16 receipt records phrase_fingerprint, not phrase, on the challenge envelope", () => {
  const ch = buildMobileQrChallengePreview(VALID_ARGS);
  assert.match(ch.phrase_fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(ch.phrase_fingerprint, ch.phrase);
});

test("T-17 boundary-invariant lint passes with new module included", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.equal(report.ok, true);
  assert.ok(report.modules_scanned > 0);
  assert.equal(report.modules_clean, report.modules_scanned);
});
