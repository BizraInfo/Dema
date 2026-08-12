import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  buildAuthorshipMigrationPreview,
  buildAuthorshipMigrationConsentEnvelope,
  executeGenesisAuthorshipMigration,
  AUTHORSHIP_MIGRATION_PREVIEW_SCHEMA,
} from "../packages/genesis/src/genesis-authorship-migration-binding.js";
import {
  migrateLegacyAuthorshipKey,
  loadActiveKeyPair,
  keyPaths,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { captureDirectoryIdentity } from "../packages/mission/src/corridor-closure-gatherer.js";

/**
 * GENESIS-AUTHORSHIP-MIGRATION-CONSENT-BINDING-1A
 *
 * The authority gap under test:
 *
 *   CONSENT_TO_OPERATION_CLASS != CONSENT_TO_EXACT_AUTHORITY_TARGET
 *
 * `MIGRATE AUTHORSHIP KEY` previously authorized a CLASS of act, and the
 * implementation then migrated whichever coherent legacy pair sat on disk at
 * execution time. For Genesis ancestry that is insufficient: the sovereign
 * must authorize the EXACT fingerprint that becomes the first governed
 * generation. Required law:
 *
 *   PREVIEWED_FINGERPRINT == CONSENT_BOUND_FINGERPRINT
 *                         == EXECUTION_TIME_DERIVED_FINGERPRINT
 *
 * and the execution-time side is re-read and re-derived UNDER the identity
 * lease, BEFORE the first durable migration write. Anything else refuses with
 * zero durable mutation.
 *
 * MIGRATION != VERIFICATION: nothing here proves who created the legacy key
 * or any external identity of it — only that the human authorized this exact
 * fingerprint and this exact fingerprint is what was migrated and accepted.
 *
 * Fixture keys and disposable homes only. authority_delta = 0.
 */

const AT = "2026-08-12T00:00:00.000Z";
const LATER = "2026-08-12T01:00:00.000Z";
const EXPIRES = "2026-08-12T02:00:00.000Z";
const NODE = "node0-mcb-fixture";
const REPO = "sprint/genesis-loop-slice-b@test-fixture";

let nonceCounter = 0;
const freshNonce = () => `mcb-nonce-${++nonceCounter}-${process.pid}`;

function home() {
  return mkdtempSync(join(tmpdir(), "mcb-home-"));
}
function writeLegacyPair(h, kp) {
  const p = keyPaths(h);
  mkdirSync(p.dir, { recursive: true });
  chmodSync(p.dir, 0o700);
  writeFileSync(p.privateKey, kp.private_key_pem, { mode: 0o600 });
  writeFileSync(p.publicKey, kp.public_key_pem, { mode: 0o644 });
}
const cleanup = (h) => rmSync(h, { recursive: true, force: true });

/** Byte-level snapshot of the governed identity surface. The nonce ledger
 *  (consent/) is deliberately excluded where noted: a consumed nonce is the
 *  intended durable record of a refused attempt, not a mutation of identity. */
function snapshotGoverned(h, { excludeConsent = false } = {}) {
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries.sort()) {
      const p = join(d, e);
      const rel = relative(h, p);
      if (excludeConsent && rel.startsWith("consent")) continue;
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out.push(`${rel}:${sha(readFileSync(p))}`);
    }
  };
  walk(h);
  return out.join("\n");
}

function preview(h, extra = {}) {
  return buildAuthorshipMigrationPreview({
    demaHome: h, nodeId: NODE, nonce: freshNonce(),
    expiresAt: EXPIRES, repository: REPO, now: AT,
    targetEstate: captureDirectoryIdentity(h), ...extra,
  });
}

// GENESIS-AUTHORSHIP-MIGRATION-PRODUCTION-WIRING-1A tightened the executor to
// require a preview-bound sovereign consent envelope plus executing repository
// and subject bindings. These exact-target invariants are unchanged; this
// helper carries the human's consent binding so each MC case exercises the
// same target law through the now-mandatory envelope. A forged preview is
// consented-to as forged — the executor still catches it.
function execTarget(previewObj, h, over = {}) {
  const env = buildAuthorshipMigrationConsentEnvelope({
    preview: previewObj, consent: KEY_MIGRATE_CONSENT_PHRASE, now: AT,
  });
  return executeGenesisAuthorshipMigration({
    preview: previewObj,
    consentEnvelope: env.ok ? env.envelope : undefined,
    demaHome: h, now: LATER,
    executingRepository: REPO,
    subjectNodeId: previewObj?.node_id,
    observeTargetEstate: () => captureDirectoryIdentity(h),
    ...over,
  });
}

// ── MC-01 ── exact target: preview A, consent binds A, execution re-derives A
test("MC-01: exact-target migration proceeds when all three fingerprints agree", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await preview(h);
    assert.equal(pv.ok, true, pv.reason ?? "");
    assert.equal(pv.preview.expected_fingerprint, A.public_key_fingerprint);
    assert.equal(pv.preview.schema, AUTHORSHIP_MIGRATION_PREVIEW_SCHEMA);

    const r = await execTarget(pv.preview, h);
    assert.equal(r.migrated, true, r.error ?? "");
    assert.equal(r.fingerprint, A.public_key_fingerprint);
  } finally { cleanup(h); }
});

// ── MC-02 ── THE LOAD-BEARING NEGATIVE CONTROL: swap to coherent pair B
test("MC-02: a different coherent pair at execution time refuses with zero mutation", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    const B = generateEd25519Keypair();
    assert.notEqual(A.public_key_fingerprint, B.public_key_fingerprint);
    writeLegacyPair(h, A);
    const pv = await preview(h);
    assert.equal(pv.preview.expected_fingerprint, A.public_key_fingerprint);

    // The attack: between consent and execution, the legacy files become a
    // DIFFERENT, internally coherent Ed25519 pair. A verifier that only
    // proves coherence would migrate B under A's consent.
    writeLegacyPair(h, B);

    const before = snapshotGoverned(h, { excludeConsent: true });
    const r = await execTarget(pv.preview, h);
    assert.equal(r.migrated, false);
    assert.equal(r.error, "expected_fingerprint_mismatch");
    // Zero durable identity mutation: no generation, no pointer, no promotion.
    const loaded = await loadActiveKeyPair(h);
    assert.equal(loaded.ok, false, "no active identity may exist after refusal");
    assert.equal(snapshotGoverned(h, { excludeConsent: true }), before,
      "governed surface must be byte-identical after the refusal");
  } finally { cleanup(h); }
});

// ── MC-03 ── malformed / mismatched pair at execution time
test("MC-03: malformed execution-time pair refuses before mutation", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await preview(h);
    const p = keyPaths(h);
    writeFileSync(p.publicKey, "-----BEGIN PUBLIC KEY-----\ngarbage\n-----END PUBLIC KEY-----\n");

    const before = snapshotGoverned(h, { excludeConsent: true });
    const r = await execTarget(pv.preview, h);
    assert.equal(r.migrated, false);
    assert.equal(snapshotGoverned(h, { excludeConsent: true }), before);
  } finally { cleanup(h); }
});

// ── MC-04 ── caller spoof: the sealed preview wins, never caller merge order
test("MC-04: caller-supplied fingerprint cannot override the sealed preview", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair(); // the spoof value
    const B = generateEd25519Keypair(); // the real disk + preview target
    writeLegacyPair(h, B);
    const pv = await preview(h);
    assert.equal(pv.preview.expected_fingerprint, B.public_key_fingerprint);

    const r = await execTarget(pv.preview, h, { expectedFingerprint: A.public_key_fingerprint });
    assert.equal(r.migrated, true, r.error ?? "");
    // A naive merge order ({...preview, ...callerArgs}) would have bound A and
    // refused against disk B. The sealed preview's target must have won:
    assert.equal(r.fingerprint, B.public_key_fingerprint);
    assert.notEqual(r.fingerprint, A.public_key_fingerprint);
  } finally { cleanup(h); }
});

// ── MC-05 ── omitted target: the Genesis profile never downgrades to phrase-only
test("MC-05: a preview without an expected fingerprint refuses — no downgrade", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await preview(h);
    // Forge a binding-free preview. Hash is recomputed by the forger, so the
    // omission itself — not a stale hash — must be what refuses.
    const forged = { ...pv.preview };
    delete forged.expected_fingerprint;

    const before = snapshotGoverned(h);
    const r = await execTarget(forged, h);
    assert.equal(r.migrated, false);
    assert.ok(
      ["binding_target_missing", "preview_hash_mismatch"].includes(r.error),
      `got ${r.error}`,
    );
    assert.equal(snapshotGoverned(h), before, "refusal must be fully immutable");
  } finally { cleanup(h); }
});

// ── MC-06 ── replay: spent nonce and stale expiry cannot authorize
test("MC-06: expiry and nonce replay both refuse", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    writeLegacyPair(h, A);

    // Expired preview refuses before anything durable happens.
    const stale = await preview(h, { expiresAt: "2026-08-11T00:00:00.000Z" });
    const before = snapshotGoverned(h);
    const r1 = await execTarget(stale.preview, h);
    assert.equal(r1.migrated, false);
    assert.equal(r1.error, "preview_expired");
    assert.equal(snapshotGoverned(h), before);

    // A nonce consumed by a refused attempt is spent: same nonce, fresh valid
    // preview, must refuse on the nonce — proving refusals burn nonces and
    // replay is dead even before the already-migrated guard can mask it.
    const N = freshNonce();
    const B = generateEd25519Keypair();
    const pv1 = await preview(h, { nonce: N });
    writeLegacyPair(h, B); // force MC-02-style refusal, consuming N
    const r2 = await execTarget(pv1.preview, h);
    assert.equal(r2.migrated, false);
    assert.equal(r2.error, "expected_fingerprint_mismatch");

    const pv2 = await preview(h, { nonce: N }); // same nonce, now binds B
    const r3 = await execTarget(pv2.preview, h);
    assert.equal(r3.migrated, false);
    assert.ok(String(r3.error).includes("nonce"), `got ${r3.error}`);
  } finally { cleanup(h); }
});

// ── MC-07 ── post-commit: the canonical loader must accept the exact target
test("MC-07: after success the canonical active-key loader accepts fingerprint A", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await preview(h);
    const r = await execTarget(pv.preview, h);
    assert.equal(r.migrated, true, r.error ?? "");
    const loaded = await loadActiveKeyPair(h);
    assert.equal(loaded.ok, true, loaded.error ?? "");
    assert.equal(loaded.fingerprint, A.public_key_fingerprint);
  } finally { cleanup(h); }
});

// ── MC-09 ── the preview hash binds the target field: tamper is caught
test("MC-09: editing the bound fingerprint after sealing refuses on the hash", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    const B = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await preview(h);
    const forged = { ...pv.preview, expected_fingerprint: B.public_key_fingerprint };
    // hash NOT recomputed — the seal must catch the edit
    const r = await execTarget(forged, h);
    assert.equal(r.migrated, false);
    assert.equal(r.error, "preview_hash_mismatch");
  } finally { cleanup(h); }
});

// ── MC-10 ── authority accounting: authority, state, and effect are distinct
test("MC-10: success reports authority_delta 0 with an explicit state delta", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await preview(h);
    const r = await execTarget(pv.preview, h);
    assert.equal(r.migrated, true, r.error ?? "");
    assert.equal(r.authority_delta, 0);
    assert.equal(r.state_delta.generation_written, true);
    assert.equal(r.state_delta.pointer_committed, true);
    assert.equal(r.state_delta.new_key_material, false);
  } finally { cleanup(h); }
});

// ── base API ── generic migrate keeps working; exact-target is enforced when given
test("base API: expectedFingerprint refuses mismatch under the lease; omitted keeps legacy semantics", async () => {
  const hA = home();
  const hB = home();
  try {
    const A = generateEd25519Keypair();
    const B = generateEd25519Keypair();
    // Mismatch: bound to A, disk holds B.
    writeLegacyPair(hA, B);
    const r1 = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: hA, now: AT,
      expectedFingerprint: A.public_key_fingerprint,
    });
    assert.equal(r1.migrated, false);
    assert.equal(r1.error, "expected_fingerprint_mismatch");
    assert.equal((await loadActiveKeyPair(hA)).ok, false);
    // Omitted: historical generic semantics preserved.
    writeLegacyPair(hB, B);
    const r2 = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: hB, now: AT,
    });
    assert.equal(r2.migrated, true, r2.error ?? "");
    assert.equal(r2.fingerprint, B.public_key_fingerprint);
  } finally { cleanup(hA); cleanup(hB); }
});
