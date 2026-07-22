import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  loadPrivateKey,
  loadPublicKey,
  keyPaths,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
  KEY_ROTATE_SCHEMA,
  KEY_ROTATE_RECEIPT_SCHEMA,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  fingerprintPublicKeyPem,
  keypairMatches,
} from "../packages/receipts/src/authorship-signature.js";

const STAMP = "2026-07-22T00:00:00.000Z";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-key-rotate-"));
}

async function seedKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
  return r.public_key_fingerprint;
}

async function rotate(home) {
  return rotateAuthorshipKey({
    consent: KEY_ROTATE_CONSENT_PHRASE,
    demaHome: home,
    retiredAt: STAMP,
  });
}

describe("rotateAuthorshipKey", () => {
  it("refuses with wrong consent phrase (old key intact)", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const result = await rotateAuthorshipKey({
      consent: "wrong",
      demaHome: home,
      retiredAt: STAMP,
    });
    assert.equal(result.schema, KEY_ROTATE_SCHEMA);
    assert.equal(result.rotated, false);
    assert.equal(result.error, "consent_required");
    assert.equal(result.boundary.key_persisted, false);
    assert.equal(await loadPrivateKey(home), oldPriv);
    assert.ok(oldFp);
  });

  it("refuses to rotate when no key exists", async () => {
    const home = freshHome();
    const result = await rotate(home);
    assert.equal(result.rotated, false);
    assert.equal(result.error, "no_key_to_rotate");
    assert.equal(result.boundary.key_persisted, false);
  });

  it("quarantines old key OUTSIDE active path, BOTH files byte-verified, with marker + registry", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const oldPub = await loadPublicKey(home);

    const result = await rotate(home);
    assert.equal(result.rotated, true);

    const paths = keyPaths(home);
    const expectedQuarantine = join(paths.dir, "retired", oldFp);
    assert.equal(result.quarantine_dir, expectedQuarantine);
    assert.notEqual(result.quarantine_dir, paths.dir);

    assert.equal(
      readFileSync(join(expectedQuarantine, "node0-ed25519.pem"), "utf8"),
      oldPriv,
    );
    assert.equal(
      readFileSync(join(expectedQuarantine, "node0-ed25519.pub.pem"), "utf8"),
      oldPub,
    );
    assert.ok(existsSync(join(expectedQuarantine, "retired.json")));
    const registry = JSON.parse(
      readFileSync(result.retired_registry_path, "utf8"),
    );
    assert.ok(registry.retired.some((e) => e.fingerprint === oldFp));
  });

  it("activates a self-consistent NEW pair; active key matches new fingerprint; no tmp leftovers", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const result = await rotate(home);

    assert.notEqual(result.new_fingerprint, oldFp);
    const activePriv = await loadPrivateKey(home);
    const activePub = await loadPublicKey(home);
    assert.equal(fingerprintPublicKeyPem(activePub), result.new_fingerprint);
    assert.ok(keypairMatches(activePriv, activePub), "active pair must verify");

    const paths = keyPaths(home);
    const leftovers = readdirSync(paths.dir).filter(
      (n) => n.endsWith(".tmp") || n === ".rotation-in-progress",
    );
    assert.deepEqual(leftovers, []);
  });

  it("emits a bound rotation receipt (contract fields, no private material)", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const result = await rotate(home);

    for (const field of [
      "old_fingerprint",
      "new_fingerprint",
      "retired_at",
      "reason",
      "quarantine_dir",
      "consent_sha256",
      "runtime_activation",
      "revocation_state",
    ]) {
      assert.ok(result[field] !== undefined, `receipt missing ${field}`);
    }
    assert.equal(result.old_fingerprint, oldFp);
    assert.equal(result.retired_at, STAMP);
    assert.equal(result.private_key_material_included, false);

    const persisted = JSON.parse(readFileSync(result.receipt_path, "utf8"));
    assert.equal(persisted.schema, KEY_ROTATE_RECEIPT_SCHEMA);
    assert.equal(persisted.new_fingerprint, result.new_fingerprint);
    const blob = readFileSync(result.receipt_path, "utf8");
    assert.equal(blob.includes("PRIVATE KEY"), false);
  });

  it("does not use network, federation, tokens, or sign receipts", async () => {
    const home = freshHome();
    await seedKey(home);
    const result = await rotate(home);
    assert.equal(result.boundary.network_used, false);
    assert.equal(result.boundary.federation_used, false);
    assert.equal(result.boundary.token_minted, false);
    assert.equal(result.boundary.receipt_signed, false);
  });
});
