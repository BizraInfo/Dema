import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  ROTATION_CONSENT_ENVELOPE_SCHEMA,
  ROTATION_ENVELOPE_OPERATION,
  ROTATION_ENVELOPE_DEFAULT_TTL_MS,
  generateRotationNonce,
  buildRotationConsentEnvelope,
} from "../packages/receipts/src/authorship-rotation-consent-envelope.js";

import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { sha256 } from "../packages/receipts/src/authorship-signature.js";

const ISSUED = "2026-07-22T00:00:00.000Z";
const homes = [];
function freshHome() {
  const h = mkdtempSync(join(tmpdir(), "dema-rot-envelope-"));
  homes.push(h);
  return h;
}
process.on("exit", () => {
  for (const h of homes) {
    try {
      rmSync(h, { recursive: true, force: true });
    } catch {}
  }
});

async function seedKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
  return r.public_key_fingerprint;
}

/// The producer is only useful if the SHIPPED validator accepts what it makes.
/// Every rotation below goes through the real rotateAuthorshipKey.
function rotateWith(home, envelope, retiredAt = ISSUED) {
  return rotateAuthorshipKey({
    consent: KEY_ROTATE_CONSENT_PHRASE,
    demaHome: home,
    retiredAt,
    envelope,
  });
}

describe("rotation consent envelope · nonce", () => {
  it("RCE-01: a nonce is fresh every call and carries real entropy", () => {
    const seen = new Set();
    for (let i = 0; i < 64; i += 1) {
      const n = generateRotationNonce();
      assert.equal(typeof n, "string");
      assert.ok(n.length >= 32, `nonce too short: ${n.length}`);
      assert.ok(/^[0-9a-f]+$/.test(n), "nonce must be lowercase hex");
      assert.ok(!seen.has(n), "nonce repeated within one process");
      seen.add(n);
    }
    assert.equal(seen.size, 64);
  });

  it("RCE-02 NEGATIVE CONTROL: a constant-nonce producer fails RCE-01's check", () => {
    // If RCE-01 could pass against a producer that never varies, it proves nothing.
    const constant = () => "deadbeef".repeat(8);
    const seen = new Set();
    let collided = false;
    for (let i = 0; i < 4; i += 1) {
      const n = constant();
      if (seen.has(n)) collided = true;
      seen.add(n);
    }
    assert.equal(collided, true, "the freshness assertion must be able to fail");
  });
});

describe("rotation consent envelope · shape", () => {
  it("RCE-03: binds dema_home_hash to sha256 of the EXACT demaHome passed to rotate", () => {
    const home = "/tmp/some-dema-home";
    const env = buildRotationConsentEnvelope({
      nonce: "n1",
      demaHome: home,
      issuedAtIso: ISSUED,
    });
    assert.equal(env.dema_home_hash, sha256(home));
    // a different home must not collide
    assert.notEqual(env.dema_home_hash, sha256("/tmp/other-dema-home"));
  });

  it("RCE-04: declares operation, zero authority_delta, schema and a bounded window", () => {
    const env = buildRotationConsentEnvelope({
      nonce: "n1",
      demaHome: "/tmp/h",
      issuedAtIso: ISSUED,
    });
    assert.equal(env.schema, ROTATION_CONSENT_ENVELOPE_SCHEMA);
    assert.equal(env.operation, ROTATION_ENVELOPE_OPERATION);
    assert.equal(env.authority_delta, 0);
    assert.equal(env.issued_at, ISSUED);
    assert.equal(
      Date.parse(env.expires_at) - Date.parse(env.issued_at),
      ROTATION_ENVELOPE_DEFAULT_TTL_MS,
    );
  });

  it("RCE-05: refuses to build without a nonce or without a demaHome", () => {
    assert.throws(
      () => buildRotationConsentEnvelope({ demaHome: "/tmp/h", issuedAtIso: ISSUED }),
      /nonce/i,
    );
    assert.throws(
      () => buildRotationConsentEnvelope({ nonce: "n1", issuedAtIso: ISSUED }),
      /dema_?home/i,
    );
    assert.throws(
      () =>
        buildRotationConsentEnvelope({
          nonce: "n1",
          demaHome: "/tmp/h",
          issuedAtIso: ISSUED,
          ttlMs: 0,
        }),
      /ttl/i,
    );
  });
});

describe("rotation consent envelope · the shipped validator accepts it", () => {
  it("RCE-10: no envelope is REFUSED, and no key changes", async () => {
    const home = freshHome();
    const fp = await seedKey(home);
    const r = await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: home,
      retiredAt: ISSUED,
    });
    assert.equal(r.rotated, false);
    assert.equal(r.error, "consent_envelope_required");
    assert.equal(r.authority_delta, 0);
    const after = await seedKeyFingerprint(home);
    assert.equal(after, fp, "refusal must leave the active key untouched");
  });

  it("RCE-11: a produced envelope is ACCEPTED and the rotation succeeds", async () => {
    const home = freshHome();
    const before = await seedKey(home);
    const env = buildRotationConsentEnvelope({
      nonce: generateRotationNonce(),
      demaHome: home,
      issuedAtIso: ISSUED,
    });
    const r = await rotateWith(home, env);
    assert.equal(r.rotated, true, `rotation refused: ${r.error}`);
    assert.notEqual(r.new_fingerprint, before);
    assert.equal(r.old_fingerprint, before);
  });

  it("RCE-12: an EXPIRED envelope is refused", async () => {
    const home = freshHome();
    await seedKey(home);
    const env = buildRotationConsentEnvelope({
      nonce: generateRotationNonce(),
      demaHome: home,
      issuedAtIso: "2026-07-22T00:00:00.000Z",
      ttlMs: 60_000,
    });
    // rotate "now" is well past expires_at
    const r = await rotateWith(home, env, "2026-07-22T01:00:00.000Z");
    assert.equal(r.rotated, false);
    assert.equal(r.error, "consent_envelope_expired");
  });

  it("RCE-13: a WRONG dema_home_hash is refused", async () => {
    const home = freshHome();
    await seedKey(home);
    const env = buildRotationConsentEnvelope({
      nonce: generateRotationNonce(),
      demaHome: "/tmp/a-different-home",
      issuedAtIso: ISSUED,
    });
    const r = await rotateWith(home, env);
    assert.equal(r.rotated, false);
    assert.equal(r.error, "consent_envelope_dema_home_mismatch");
  });

  it("RCE-14: a REPLAYED nonce is refused on the second rotation", async () => {
    const home = freshHome();
    await seedKey(home);
    const nonce = generateRotationNonce();
    const first = await rotateWith(
      home,
      buildRotationConsentEnvelope({ nonce, demaHome: home, issuedAtIso: ISSUED }),
    );
    assert.equal(first.rotated, true, `first rotation refused: ${first.error}`);
    const second = await rotateWith(
      home,
      buildRotationConsentEnvelope({ nonce, demaHome: home, issuedAtIso: ISSUED }),
      "2026-07-22T00:00:01.000Z",
    );
    assert.equal(second.rotated, false);
    assert.equal(second.error, "consent_nonce_replayed");
  });

  it("RCE-15: a tampered operation or authority_delta is refused", async () => {
    const home = freshHome();
    await seedKey(home);
    const base = buildRotationConsentEnvelope({
      nonce: generateRotationNonce(),
      demaHome: home,
      issuedAtIso: ISSUED,
    });
    const wrongOp = await rotateWith(home, { ...base, operation: "something_else" });
    assert.equal(wrongOp.rotated, false);
    assert.equal(wrongOp.error, "consent_envelope_wrong_operation");

    const wrongDelta = await rotateWith(home, { ...base, authority_delta: 1 });
    assert.equal(wrongDelta.rotated, false);
    assert.equal(wrongDelta.error, "consent_envelope_authority_nonzero");
  });
});

/// Read the CURRENT active fingerprint without mutating anything.
async function seedKeyFingerprint(home) {
  const { loadActiveKeyPair } = await import(
    "../packages/receipts/src/authorship-key-store.js"
  );
  const cur = await loadActiveKeyPair(home);
  assert.equal(cur.ok, true);
  const { fingerprintPublicKeyPem } = await import(
    "../packages/receipts/src/authorship-signature.js"
  );
  return fingerprintPublicKeyPem(cur.public_key_pem);
}
