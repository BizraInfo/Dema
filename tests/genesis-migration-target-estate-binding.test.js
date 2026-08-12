import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, statSync, symlinkSync, unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, dirname, basename } from "node:path";

import {
  buildAuthorshipMigrationPreview,
  buildAuthorshipMigrationConsentEnvelope,
  executeGenesisAuthorshipMigration,
  repositoryIdentityFromBinding,
} from "../packages/genesis/src/genesis-authorship-migration-binding.js";
import {
  keyPaths,
  loadActiveKeyPair,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { inspectConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import { captureDirectoryIdentity } from "../packages/mission/src/corridor-closure-gatherer.js";

/**
 * GENESIS-MIGRATION-TARGET-ESTATE-BINDING-1A
 *
 * The measured defect (SB-01 RED at the real binary, before repair): a
 * preview sealed and consented against estate A EXECUTED SUCCESSFULLY against
 * estate B — migrated:true, B held an active governed key, the nonce was
 * spent in B. Same sovereign label, same key bytes, same repository: the
 * executor's subject check was `subjectNodeId = preview.node_id` compared to
 * `preview.node_id` — x == x, which certified nothing.
 *
 * The identity model this suite pins:
 *   node_id        = SOVEREIGN_DECLARED. The estate's own canon: "IDENTITY IS
 *                    SUPPLIED, NEVER DERIVED". No disk fact may assert it.
 *   target_estate  = INDEPENDENTLY_OBSERVED_LOCAL_SUBSTRATE — the canonical
 *                    realpath/dev/ino of the governed home, observed by
 *                    captureDirectoryIdentity at preview AND re-observed
 *                    inside the executor's gate at execution.
 *   DIRECTORY_IDENTITY != NODE_IDENTITY — the triple names this directory
 *   object on this host, never the sovereign's node, and matching node_id
 *   alone is never sufficient.
 *
 * Fixture keys, disposable homes. No real ~/.dema.
 */

const BIN = new URL("../bin/dema", import.meta.url).pathname;
const NODE = "node0-sb-fixture";
const REPO = repositoryIdentityFromBinding({ commit: "a".repeat(40), tree: "c".repeat(40) });

let nonceCounter = 0;
const freshNonce = () => `sb-nonce-${++nonceCounter}-${process.pid}`;
const future = () => new Date(Date.now() + 3600_000).toISOString();
const scratch = () => mkdtempSync(join(tmpdir(), "sb-"));
const cleanup = (d) => rmSync(d, { recursive: true, force: true });

function writePair(h, kp) {
  const p = keyPaths(h);
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(p.privateKey, kp.private_key_pem, { mode: 0o600 });
  writeFileSync(p.publicKey, kp.public_key_pem, { mode: 0o644 });
}

function dema(h, args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      encoding: "utf8", cwd: tmpdir(), env: { ...process.env, DEMA_HOME: h },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}
const previewCmd = (h, out, nonce) =>
  dema(h, ["genesis", "migrate-key", "preview", "--node-id", NODE,
    "--nonce", nonce, "--expires-at", future(), "--out", out]);
const consentCmd = (h, previewPath, out) =>
  dema(h, ["genesis", "migrate-key", "consent", "--preview", previewPath,
    "--consent", KEY_MIGRATE_CONSENT_PHRASE, "--out", out]);
const executeCmd = (h, previewPath, envelopePath) =>
  dema(h, ["genesis", "migrate-key", "execute",
    "--preview", previewPath, "--consent-envelope", envelopePath]);
const parsedError = (r) => {
  try { return JSON.parse(r.stdout).error; } catch { return undefined; }
};

function snapshotHome(h) {
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries.sort()) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out.push(`${relative(h, p)}:${sha(readFileSync(p))}`);
    }
  };
  walk(h);
  return out.join("\n");
}

// ── SB-01 ── the load-bearing discriminatory control (real binary)
test("SB-01: same node_id, same key bytes, different estate — refuses before the nonce claim", async () => {
  const kp = generateEd25519Keypair();
  const A = scratch(); const B = scratch();
  try {
    writePair(A, kp); writePair(B, kp); // identical bytes, deliberately
    const nonce = freshNonce();
    const previewPath = join(A, "preview.json");
    const envelopePath = join(A, "envelope.json");
    assert.equal(previewCmd(A, previewPath, nonce).code, 0);
    assert.equal(consentCmd(A, previewPath, envelopePath).code, 0);
    const sealedPreview = JSON.parse(readFileSync(previewPath, "utf8"));
    // SB-05, made explicit: everything the OLD check could see agrees.
    assert.equal(sealedPreview.node_id, NODE, "declared labels agree");
    assert.equal(
      (await loadActiveKeyPair(B)).ok, false, "B starts unmigrated");

    const before = snapshotHome(B);
    const ex = executeCmd(B, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "target_estate_mismatch",
      "matching node_id and matching key bytes must never stand in for the estate");
    assert.equal((await inspectConsentNonce({ nonce, demaHome: B })).used, false,
      "the estate refusal must precede the nonce claim");
    assert.equal((await loadActiveKeyPair(B)).ok, false);
    assert.equal(snapshotHome(B), before, "estate B must be byte-identical");
  } finally { cleanup(A); cleanup(B); }
});

// ── SB-02 ── path retarget between preview and execute (real binary)
test("SB-02: retargeting a parent alias between preview and execute refuses", async () => {
  const kp = generateEd25519Keypair();
  const base = scratch();
  const parentA = join(base, "parent-a"); const parentB = join(base, "parent-b");
  mkdirSync(join(parentA, "home"), { recursive: true });
  mkdirSync(join(parentB, "home"), { recursive: true });
  try {
    writePair(join(parentA, "home"), kp);
    writePair(join(parentB, "home"), kp);
    const link = join(base, "link");
    symlinkSync(parentA, link);
    const aliased = join(link, "home"); // final component is a REAL directory
    const nonce = freshNonce();
    const previewPath = join(base, "preview.json");
    const envelopePath = join(base, "envelope.json");
    assert.equal(previewCmd(aliased, previewPath, nonce).code, 0);
    assert.equal(consentCmd(aliased, previewPath, envelopePath).code, 0);

    unlinkSync(link);
    symlinkSync(parentB, link); // same spelling, different world
    const ex = executeCmd(aliased, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "target_estate_mismatch");
    assert.equal(
      (await inspectConsentNonce({ nonce, demaHome: aliased })).used, false);
    assert.equal((await loadActiveKeyPair(join(parentB, "home"))).ok, false);
  } finally { cleanup(base); }
});

// ── SB-03 ── harmless alias positive control (real binary)
// The PREVIEW observes the estate through an aliased spelling; execution
// observes it through the direct spelling. A detector comparing path strings
// would refuse this; realpath/dev/ino identity matches, and the ceremony
// completes. (Execution itself runs under the direct spelling because the
// key store's own post-commit loader verification is path-string sensitive —
// a pre-existing seam this slice measures and reports, not one it repaints.)
test("SB-03: two spellings of the same directory are the same estate", async () => {
  const A = scratch();
  const aliasBase = scratch();
  try {
    writePair(A, generateEd25519Keypair());
    const link = join(aliasBase, "alias-parent");
    symlinkSync(dirname(A), link);
    const aliased = join(link, basename(A)); // resolves to A
    const previewPath = join(aliasBase, "preview.json");
    const envelopePath = join(aliasBase, "envelope.json");
    assert.equal(previewCmd(aliased, previewPath, freshNonce()).code, 0);
    const sealedEstate = JSON.parse(readFileSync(previewPath, "utf8")).target_estate;
    assert.equal(sealedEstate.realpath, captureDirectoryIdentity(A).realpath,
      "the alias seals the canonical estate, not the spelling it was reached by");
    assert.equal(consentCmd(aliased, previewPath, envelopePath).code, 0);
    const ex = executeCmd(A, previewPath, envelopePath);
    assert.equal(ex.code, 0, ex.stdout || ex.stderr);
    assert.equal(JSON.parse(ex.stdout).migrated, true,
      "a detector comparing path strings would wrongly refuse this");
    assert.equal((await loadActiveKeyPair(A)).ok, true);
  } finally { cleanup(A); cleanup(aliasBase); }
});

// ── SB-04 ── unmeasurable estate refuses on both surfaces (real binary)
test("SB-04: an unobservable estate refuses preview and execute with zero effect", async () => {
  const kp = generateEd25519Keypair();
  const A = scratch(); const base = scratch();
  try {
    writePair(A, kp);
    const finalLink = join(base, "home-link");
    symlinkSync(A, finalLink); // final component IS a symlink: observer refuses

    const pv = dema(finalLink, ["genesis", "migrate-key", "preview",
      "--node-id", NODE, "--nonce", freshNonce(), "--expires-at", future(),
      "--out", join(base, "p.json")]);
    assert.notEqual(pv.code, 0);
    assert.match(pv.stderr, /target_estate_unverifiable/);

    // A valid ceremony sealed on A, then executed through the unobservable path:
    const nonce = freshNonce();
    const previewPath = join(base, "preview.json");
    const envelopePath = join(base, "envelope.json");
    assert.equal(previewCmd(A, previewPath, nonce).code, 0);
    assert.equal(consentCmd(A, previewPath, envelopePath).code, 0);
    const ex = executeCmd(finalLink, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "target_estate_unverifiable");
    assert.equal((await inspectConsentNonce({ nonce, demaHome: A })).used, false);
    assert.equal((await loadActiveKeyPair(A)).ok, false);
  } finally { cleanup(A); cleanup(base); }
});

// ── SB-06 ── the old weaker preview cannot authorize the new profile (kernel)
test("SB-06: v0.1 and estate-stripped previews refuse — no downgrade route", async () => {
  const h = scratch();
  try {
    writePair(h, generateEd25519Keypair());
    const estate = captureDirectoryIdentity(h);
    const observe = () => captureDirectoryIdentity(h);
    const pv = await buildAuthorshipMigrationPreview({
      demaHome: h, nodeId: NODE, nonce: freshNonce(), expiresAt: future(),
      repository: REPO, now: new Date().toISOString(), targetEstate: estate,
    });
    assert.equal(pv.ok, true);

    // A genuine old-shape preview: v0.1 schema, no target_estate.
    const { target_estate: _dropped, ...v01 } = {
      ...pv.preview,
      schema: "bizra.dema.genesis_authorship_migration_preview.v0.1",
    };
    const envelope = (p) => buildAuthorshipMigrationConsentEnvelope({
      preview: p, consent: KEY_MIGRATE_CONSENT_PHRASE, now: new Date().toISOString(),
    }).envelope;
    const r1 = await executeGenesisAuthorshipMigration({
      preview: v01, consentEnvelope: envelope(v01), demaHome: h,
      now: new Date().toISOString(), executingRepository: REPO,
      observeTargetEstate: observe,
    });
    assert.equal(r1.migrated, false);
    assert.equal(r1.error, "preview_schema_unknown",
      "the schema version is the explicit refusal for true v0.1 previews");

    // A v0.2 preview with the estate stripped but everything else intact.
    const { target_estate: _stripped, ...naked } = { ...pv.preview };
    const r2 = await executeGenesisAuthorshipMigration({
      preview: naked, consentEnvelope: envelope(naked), demaHome: h,
      now: new Date().toISOString(), executingRepository: REPO,
      observeTargetEstate: observe,
    });
    assert.equal(r2.migrated, false);
    assert.equal(r2.error, "target_estate_binding_required",
      "silence about the estate is a refusal, never a fallback to x == x");
    assert.equal((await loadActiveKeyPair(h)).ok, false);
  } finally { cleanup(h); }
});

// ── SB-07 ── sealed estate field tamper (real binary)
test("SB-07: tampering the sealed target_estate refuses at the preview hash", async () => {
  const h = scratch();
  try {
    writePair(h, generateEd25519Keypair());
    const nonce = freshNonce();
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    assert.equal(previewCmd(h, previewPath, nonce).code, 0);
    assert.equal(consentCmd(h, previewPath, envelopePath).code, 0);
    const tampered = JSON.parse(readFileSync(previewPath, "utf8"));
    tampered.target_estate = { ...tampered.target_estate, ino: "424242" };
    writeFileSync(previewPath, JSON.stringify(tampered));

    const ex = executeCmd(h, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "preview_hash_mismatch",
      "the estate participates in the sealed hash — edits die at the earliest gate");
    assert.equal((await inspectConsentNonce({ nonce, demaHome: h })).used, false);
    assert.equal((await loadActiveKeyPair(h)).ok, false);
  } finally { cleanup(h); }
});

// ── SB-09 ── removal control: the independent observation is load-bearing (kernel)
test("SB-09: feeding the preview's own estate back re-opens the hole; real observation closes it", async () => {
  const kp = generateEd25519Keypair();
  const mk = () => { const d = scratch(); writePair(d, kp); return d; };

  // Vacuous world: observer returns the preview-carried estate (x == x).
  const A1 = mk(); const B1 = mk();
  try {
    const pv = await buildAuthorshipMigrationPreview({
      demaHome: A1, nodeId: NODE, nonce: freshNonce(), expiresAt: future(),
      repository: REPO, now: new Date().toISOString(),
      targetEstate: captureDirectoryIdentity(A1),
    });
    assert.equal(pv.ok, true);
    const env = buildAuthorshipMigrationConsentEnvelope({
      preview: pv.preview, consent: KEY_MIGRATE_CONSENT_PHRASE,
      now: new Date().toISOString(),
    });
    const vacuous = await executeGenesisAuthorshipMigration({
      preview: pv.preview, consentEnvelope: env.envelope, demaHome: B1,
      now: new Date().toISOString(), executingRepository: REPO,
      observeTargetEstate: () => pv.preview.target_estate,
    });
    assert.equal(vacuous.migrated, true,
      "REMOVAL CONTROL: preview-fed observation lets estate A's authority spend in B — " +
      "this measured wrongness is what proves the independent observation is load-bearing");
  } finally { cleanup(A1); cleanup(B1); }

  // Real world: independent observation of the executing estate refuses.
  const A2 = mk(); const B2 = mk();
  try {
    const pv = await buildAuthorshipMigrationPreview({
      demaHome: A2, nodeId: NODE, nonce: freshNonce(), expiresAt: future(),
      repository: REPO, now: new Date().toISOString(),
      targetEstate: captureDirectoryIdentity(A2),
    });
    const env = buildAuthorshipMigrationConsentEnvelope({
      preview: pv.preview, consent: KEY_MIGRATE_CONSENT_PHRASE,
      now: new Date().toISOString(),
    });
    const real = await executeGenesisAuthorshipMigration({
      preview: pv.preview, consentEnvelope: env.envelope, demaHome: B2,
      now: new Date().toISOString(), executingRepository: REPO,
      observeTargetEstate: () => captureDirectoryIdentity(B2),
    });
    assert.equal(real.migrated, false);
    assert.equal(real.error, "target_estate_mismatch");
    assert.equal((await loadActiveKeyPair(B2)).ok, false);
  } finally { cleanup(A2); cleanup(B2); }
});

// ── SB-10 ── the repository gate still outranks the estate gate (kernel)
test("SB-10: a foreign repository refuses before the estate is even compared", async () => {
  const h = scratch();
  try {
    writePair(h, generateEd25519Keypair());
    const pv = await buildAuthorshipMigrationPreview({
      demaHome: h, nodeId: NODE, nonce: freshNonce(), expiresAt: future(),
      repository: repositoryIdentityFromBinding({
        commit: "b".repeat(40), tree: "d".repeat(40),
      }),
      now: new Date().toISOString(),
      targetEstate: captureDirectoryIdentity(scratch()), // mismatched estate too
    });
    const env = buildAuthorshipMigrationConsentEnvelope({
      preview: pv.preview, consent: KEY_MIGRATE_CONSENT_PHRASE,
      now: new Date().toISOString(),
    });
    const r = await executeGenesisAuthorshipMigration({
      preview: pv.preview, consentEnvelope: env.envelope, demaHome: h,
      now: new Date().toISOString(), executingRepository: REPO,
      observeTargetEstate: () => captureDirectoryIdentity(h),
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "repository_binding_mismatch",
      "TASK-066 is not weakened: repository truth is judged before the estate");
  } finally { cleanup(h); }
});
