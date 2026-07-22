import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
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
const ENVELOPE = { nonce: "nonce-001", ceremony_id: "cer-001", reason: "test" };

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-key-rotate-"));
}
async function seedKey(home) {
  const r = await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  assert.equal(r.initialized, true);
  return r.public_key_fingerprint;
}
async function rotate(home, envelope = ENVELOPE) {
  return rotateAuthorshipKey({
    consent: KEY_ROTATE_CONSENT_PHRASE,
    demaHome: home,
    retiredAt: STAMP,
    envelope,
  });
}

describe("rotateAuthorshipKey — contract", () => {
  it("refuses wrong consent phrase (old key intact)", async () => {
    const home = freshHome();
    await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const r = await rotateAuthorshipKey({ consent: "wrong", demaHome: home });
    assert.equal(r.rotated, false);
    assert.equal(r.error, "consent_required");
    assert.equal(await loadPrivateKey(home), oldPriv);
  });

  it("refuses when no key exists (no silent init)", async () => {
    const r = await rotate(freshHome());
    assert.equal(r.rotated, false);
    assert.equal(r.error, "no_key_to_rotate");
  });

  it("quarantines old key outside active path, BOTH files verified, marker + denylist", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const oldPub = await loadPublicKey(home);
    const r = await rotate(home);
    assert.equal(r.rotated, true);
    const paths = keyPaths(home);
    const q = join(paths.dir, "retired", oldFp);
    assert.equal(r.quarantine_dir, q);
    assert.equal(readFileSync(join(q, "node0-ed25519.pem"), "utf8"), oldPriv);
    assert.equal(readFileSync(join(q, "node0-ed25519.pub.pem"), "utf8"), oldPub);
    assert.ok(existsSync(join(q, "retired.json")));
    const reg = JSON.parse(readFileSync(r.retired_registry_path, "utf8"));
    assert.ok(reg.retired.some((e) => e.fingerprint === oldFp));
  });

  it("activates self-consistent NEW pair via generation archive; no tmp leftovers", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const r = await rotate(home);
    assert.equal(r.transaction_state, "COMPLETE");
    assert.equal(r.retirement_committed, true);
    assert.notEqual(r.new_fingerprint, oldFp);
    const priv = await loadPrivateKey(home);
    const pub = await loadPublicKey(home);
    assert.equal(fingerprintPublicKeyPem(pub), r.new_fingerprint);
    assert.ok(keypairMatches(priv, pub));
    // generation archive holds the complete new pair
    assert.ok(existsSync(join(r.generation_dir, "private.pem")));
    assert.ok(existsSync(join(r.generation_dir, "metadata.json")));
    // no leftover temp/marker
    const leftovers = readdirSync(keyPaths(home).dir).filter(
      (n) => n.endsWith(".tmp") || n === ".rotation-in-progress",
    );
    assert.deepEqual(leftovers, []);
  });

  it("binds a FULL consent envelope + nonce (not the phrase); receipt carries no private material", async () => {
    const home = freshHome();
    await seedKey(home);
    const r = await rotate(home);
    assert.equal(r.consent_binding.strength, "envelope_bound");
    assert.equal(r.consent_binding.nonce, ENVELOPE.nonce);
    assert.ok(r.consent_binding.envelope_sha256);
    const persisted = JSON.parse(readFileSync(r.receipt_path, "utf8"));
    assert.equal(persisted.schema, KEY_ROTATE_RECEIPT_SCHEMA);
    assert.equal(readFileSync(r.receipt_path, "utf8").includes("PRIVATE KEY"), false);
  });

  it("flags phrase-only consent as INSUFFICIENT when no envelope is supplied", async () => {
    const home = freshHome();
    await seedKey(home);
    const r = await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: home,
      retiredAt: STAMP,
    });
    assert.equal(r.rotated, true);
    assert.equal(r.consent_binding.strength, "phrase_only_INSUFFICIENT");
  });

  it("no network/federation/token/receipt-signing", async () => {
    const home = freshHome();
    await seedKey(home);
    const r = await rotate(home);
    assert.equal(r.boundary.network_used, false);
    assert.equal(r.boundary.federation_used, false);
    assert.equal(r.boundary.token_minted, false);
    assert.equal(r.boundary.receipt_signed, false);
  });
});

describe("rotateAuthorshipKey — failure injection (each ends in ONE explicit state)", () => {
  it("replayed consent nonce → refused, active key OLD_ACTIVE_UNCHANGED", async () => {
    const home = freshHome();
    await seedKey(home);
    const first = await rotate(home, { nonce: "dup", ceremony_id: "c" });
    assert.equal(first.rotated, true);
    const afterFirst = await loadPrivateKey(home);
    const second = await rotate(home, { nonce: "dup", ceremony_id: "c" });
    assert.equal(second.rotated, false);
    assert.equal(second.error, "consent_nonce_replayed");
    assert.equal(await loadPrivateKey(home), afterFirst); // unchanged
  });

  it("corrupt retirement registry → fail closed UPFRONT, old key unchanged", async () => {
    const home = freshHome();
    await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    writeFileSync(join(keyPaths(home).dir, "retired-registry.json"), "{ not json");
    const r = await rotate(home);
    assert.equal(r.rotated, false);
    assert.equal(r.error, "retired_registry_corrupt");
    // loader can't be used here (corrupt registry blocks it) — verify raw bytes
    assert.equal(readFileSync(keyPaths(home).privateKey, "utf8"), oldPriv);
  });

  it("symlink substitution of the active key → fail closed, symlink target unchanged", async () => {
    const home = freshHome();
    await seedKey(home);
    const paths = keyPaths(home);
    const realTarget = readFileSync(paths.privateKey, "utf8");
    const decoy = join(paths.dir, "decoy.pem");
    writeFileSync(decoy, realTarget);
    rmSync(paths.privateKey);
    symlinkSync(decoy, paths.privateKey);
    const r = await rotate(home);
    assert.equal(r.rotated, false); // readKeyFile refuses to follow the symlink
    assert.equal(readFileSync(decoy, "utf8"), realTarget); // decoy target untouched
  });

  it("partial pre-existing quarantine (wrong bytes) → quarantine_stage_failed, old key unchanged", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const oldPriv = await loadPrivateKey(home);
    const q = join(keyPaths(home).dir, "retired", oldFp);
    mkdirSync(q, { recursive: true });
    // pre-plant a WRONG private backup so stage byte-verify fails closed
    writeFileSync(join(q, "node0-ed25519.pem"), "WRONG BYTES");
    const r = await rotate(home);
    assert.equal(r.rotated, false);
    assert.equal(r.error, "quarantine_stage_failed");
    assert.equal(await loadPrivateKey(home), oldPriv); // old key unchanged
  });

  it("mid-rotation journal (crash before completion) → loader fails closed", async () => {
    const home = freshHome();
    await seedKey(home);
    // simulate a crash: journal stuck ACTIVATING
    writeFileSync(
      join(keyPaths(home).dir, "rotation-journal.json"),
      JSON.stringify({ state: "ACTIVATING", old_fingerprint: "x", new_fingerprint: "y" }),
    );
    assert.equal(await loadPublicKey(home), null); // blocked
    assert.equal(await loadPrivateKey(home), null);
  });

  it("runtime loading a retired active fingerprint → loader fails closed", async () => {
    const home = freshHome();
    const fp = await seedKey(home);
    // put the ACTIVE fingerprint on the denylist (inconsistent/bad state)
    writeFileSync(
      join(keyPaths(home).dir, "retired-registry.json"),
      JSON.stringify({ schema: "bizra.dema.retired_key_registry.v0.1", retired: [{ fingerprint: fp }] }),
    );
    assert.equal(await loadPublicKey(home), null);
    assert.equal(await loadPrivateKey(home), null);
  });

  it("wrong DEMA_HOME (no key) → no_key_to_rotate", async () => {
    const r = await rotate(freshHome());
    assert.equal(r.error, "no_key_to_rotate");
  });
});
