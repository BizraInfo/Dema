import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
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
} from "../packages/receipts/src/authorship-key-store.js";

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

describe("rotateAuthorshipKey", () => {
  it("refuses with wrong consent phrase (old key untouched)", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const result = await rotateAuthorshipKey({ consent: "wrong", demaHome: home });
    assert.equal(result.schema, KEY_ROTATE_SCHEMA);
    assert.equal(result.rotated, false);
    assert.equal(result.error, "consent_required");
    assert.equal(result.required_phrase, KEY_ROTATE_CONSENT_PHRASE);
    assert.equal(result.boundary.key_persisted, false);
    // old key must be intact
    assert.equal(await loadPrivateKey(home), oldPriv);
    const stillOld = await rotateAuthorshipKey({
      consent: "wrong",
      demaHome: home,
    });
    assert.equal(stillOld.rotated, false);
    assert.ok(oldFp);
  });

  it("refuses to rotate when no key exists", async () => {
    const home = freshHome();
    const result = await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(result.rotated, false);
    assert.equal(result.error, "no_key_to_rotate");
    assert.equal(result.boundary.key_persisted, false);
  });

  it("backs up old key BEFORE overwrite, records both fingerprints, new key differs", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const oldPub = await loadPublicKey(home);

    const result = await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: home,
    });

    assert.equal(result.schema, KEY_ROTATE_SCHEMA);
    assert.equal(result.rotated, true);
    assert.equal(result.old_fingerprint, oldFp);
    assert.notEqual(result.new_fingerprint, oldFp);
    assert.equal(result.boundary.key_persisted, true);

    // live key is now the NEW key
    const newPriv = await loadPrivateKey(home);
    const newPub = await loadPublicKey(home);
    assert.notEqual(newPriv, oldPriv);
    assert.notEqual(newPub, oldPub);

    // backup dir exists and contains the ORIGINAL old key bytes (not the new)
    assert.ok(result.backup_dir);
    assert.ok(existsSync(result.backup_dir), "backup dir must exist");
    const paths = keyPaths(home);
    const backedPriv = readFileSync(
      join(result.backup_dir, paths.privateKey.split("/").pop()),
      "utf8",
    );
    assert.equal(backedPriv, oldPriv, "backup must hold the ORIGINAL key");
  });

  it("does not use network, federation, tokens, or sign receipts", async () => {
    const home = freshHome();
    await seedKey(home);
    const result = await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(result.boundary.network_used, false);
    assert.equal(result.boundary.federation_used, false);
    assert.equal(result.boundary.token_minted, false);
    assert.equal(result.boundary.receipt_signed, false);
  });
});
