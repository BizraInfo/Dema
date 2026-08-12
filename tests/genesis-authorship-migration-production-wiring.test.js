import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildAuthorshipMigrationPreview,
  buildAuthorshipMigrationConsentEnvelope,
  executeGenesisAuthorshipMigration,
  repositoryIdentityFromCommit,
  AUTHORSHIP_MIGRATION_CONSENT_SCHEMA,
} from "../packages/genesis/src/genesis-authorship-migration-binding.js";
import {
  keyPaths,
  loadActiveKeyPair,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";

/**
 * GENESIS-AUTHORSHIP-MIGRATION-PRODUCTION-WIRING-1A
 *
 * The prior slice proved the exact-target kernel. This one proves the kernel
 * is LOAD-BEARING and that consent binds the preview, because:
 *
 *   SECURE_KERNEL_EXISTS   != SECURE_PATH_IS_LOAD_BEARING
 *   PREVIEW_INTEGRITY      != CONSENT_AUTHENTICITY
 *   CONSENT_TO_PHRASE      != CONSENT_TO_PREVIEW
 *
 * MEASURED BYPASS, BEFORE REPAIR: `dema authorship key migrate --consent
 * "MIGRATE AUTHORSHIP KEY"` invoked `migrateLegacyAuthorshipKey({consent})`
 * directly — phrase-only, no preview, no fingerprint, no nonce, no expiry.
 * PW-01 drives the REAL bin/dema and pins that this path now refuses.
 *
 * The sovereign consent envelope binds: operation · preview_hash ·
 * nonce · expiry · exact phrase. Required invariant, verified by the executor
 * BEFORE the nonce claim and before any governed mutation:
 *
 *   HUMAN_CONSENT.preview_hash == SEALED_PREVIEW.preview_hash (re-derived)
 *
 * Fixture keys and disposable homes only. authority_delta = 0.
 */

const AT = "2026-08-12T00:00:00.000Z";
const LATER = "2026-08-12T01:00:00.000Z";
const EXPIRES = "2026-08-12T02:00:00.000Z";
const NODE = "node0-pw-fixture";
const REPO_COMMIT = "a".repeat(40);
const REPO = repositoryIdentityFromCommit(REPO_COMMIT);

let nonceCounter = 0;
const freshNonce = () => `pw-nonce-${++nonceCounter}-${process.pid}`;

const home = () => mkdtempSync(join(tmpdir(), "pw-home-"));
const cleanup = (h) => rmSync(h, { recursive: true, force: true });
function writeLegacyPair(h, kp) {
  const p = keyPaths(h);
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(p.privateKey, kp.private_key_pem, { mode: 0o600 });
  writeFileSync(p.publicKey, kp.public_key_pem, { mode: 0o644 });
}

async function sealed(h, extra = {}) {
  const pv = await buildAuthorshipMigrationPreview({
    demaHome: h, nodeId: NODE, nonce: freshNonce(),
    expiresAt: EXPIRES, repository: REPO, now: AT, ...extra,
  });
  assert.equal(pv.ok, true, pv.reason ?? "");
  return pv.preview;
}
function envelopeFor(preview, extra = {}) {
  const env = buildAuthorshipMigrationConsentEnvelope({
    preview, consent: KEY_MIGRATE_CONSENT_PHRASE, now: AT, ...extra,
  });
  assert.equal(env.ok, true, env.reason ?? "");
  return env.envelope;
}
function run(preview, envelope, h, extra = {}) {
  return executeGenesisAuthorshipMigration({
    preview, consentEnvelope: envelope, demaHome: h, now: LATER,
    executingRepository: REPO, subjectNodeId: NODE, ...extra,
  });
}

// ── PW-01 ── the production CLI bypass is closed: real bin/dema refuses
test("PW-01: legacy phrase-only CLI migrate refuses and names the governed path", () => {
  const h = home();
  try {
    writeLegacyPair(h, generateEd25519Keypair());
    let out;
    let code = 0;
    try {
      out = execFileSync(process.execPath, [
        new URL("../bin/dema", import.meta.url).pathname,
        "authorship", "key", "migrate",
        "--consent", KEY_MIGRATE_CONSENT_PHRASE, "--json",
      ], { encoding: "utf8", env: { ...process.env, DEMA_HOME: h } });
    } catch (e) {
      out = String(e.stdout ?? "");
      code = e.status ?? 1;
    }
    const r = JSON.parse(out);
    assert.equal(r.migrated, false,
      "phrase-only production migration is the measured bypass — it must refuse");
    assert.equal(r.error, "genesis_governed_path_required");
    assert.notEqual(code, 0);
    // And nothing moved:
    const p = keyPaths(h);
    assert.throws(() => readFileSync(join(p.dir, "active-key.json")), /ENOENT/);
  } finally { cleanup(h); }
});

// ── PW-02 ── preview A + consent envelope bound to preview B → refuse
test("PW-02: consent bound to a different preview refuses with zero migration", async () => {
  const h = home();
  try {
    writeLegacyPair(h, generateEd25519Keypair());
    const pvA = await sealed(h);
    const pvB = await sealed(h); // different nonce → different hash
    assert.notEqual(pvA.preview_hash, pvB.preview_hash);
    const envB = envelopeFor(pvB);
    const r = await run(pvA, envB, h);
    assert.equal(r.migrated, false);
    assert.equal(r.error, "consent_binding_mismatch");
    assert.equal((await loadActiveKeyPair(h)).ok, false);
  } finally { cleanup(h); }
});

// ── PW-03 ── exact phrase with no consent-bound preview → refuse
test("PW-03: phrase without an envelope refuses on the Genesis path", async () => {
  const h = home();
  try {
    writeLegacyPair(h, generateEd25519Keypair());
    const pv = await sealed(h);
    const r = await executeGenesisAuthorshipMigration({
      preview: pv, consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: h, now: LATER,
      executingRepository: REPO, subjectNodeId: NODE,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "consent_envelope_required");
  } finally { cleanup(h); }
});

// ── PW-04 ── spoofed presentation cannot outrun the human-bound hash
test("PW-04: edited preview with matching envelope-to-original refuses", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    const B = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await sealed(h);
    const env = envelopeFor(pv); // human bound to the REAL preview hash
    const forged = { ...pv, expected_fingerprint: B.public_key_fingerprint };
    const r = await run(forged, env, h);
    assert.equal(r.migrated, false);
    // Either seal-integrity or binding catches it; both are pre-nonce.
    assert.ok(["preview_hash_mismatch", "consent_binding_mismatch"].includes(r.error),
      `got ${r.error}`);
  } finally { cleanup(h); }
});

// ── PW-05 ── repository drift: executing identity must match the sealed one
test("PW-05: repository drift refuses; unverifiable executing identity refuses", async () => {
  const h = home();
  try {
    writeLegacyPair(h, generateEd25519Keypair());
    const pv = await sealed(h); // sealed against REPO (commit aaaa…)
    const env = envelopeFor(pv);
    const r2 = await run(pv, env, h, {
      executingRepository: repositoryIdentityFromCommit("b".repeat(40)),
    });
    assert.equal(r2.migrated, false);
    assert.equal(r2.error, "repository_binding_mismatch");

    const r3 = await run(pv, env, h, { executingRepository: undefined });
    assert.equal(r3.migrated, false);
    assert.equal(r3.error, "repository_binding_unverifiable",
      "an unknown executing repository is never silently accepted");
  } finally { cleanup(h); }
});

// ── PW-06 ── node subject drift refuses
test("PW-06: a preview for node A cannot execute against subject B", async () => {
  const h = home();
  try {
    writeLegacyPair(h, generateEd25519Keypair());
    const pv = await sealed(h);
    const env = envelopeFor(pv);
    const r = await run(pv, env, h, { subjectNodeId: "some-other-node" });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "subject_binding_mismatch");
  } finally { cleanup(h); }
});

// ── PW-07 ── MC-02 preserved under the envelope path
test("PW-07: consented A, coherent B substituted → refuse before migration writes", async () => {
  const h = home();
  try {
    const A = generateEd25519Keypair();
    const B = generateEd25519Keypair();
    writeLegacyPair(h, A);
    const pv = await sealed(h);
    const env = envelopeFor(pv);
    writeLegacyPair(h, B);
    const r = await run(pv, env, h);
    assert.equal(r.migrated, false);
    assert.equal(r.error, "expected_fingerprint_mismatch");
    assert.equal((await loadActiveKeyPair(h)).ok, false);
  } finally { cleanup(h); }
});

// ── PW-08 ── direct caller inventory: every production caller is classified
test("PW-08: every production caller of migrateLegacyAuthorshipKey is classified", () => {
  const CLASSIFIED = new Map([
    // definition site
    ["packages/receipts/src/authorship-key-store.js", "DEFINITION"],
    // the one governed delegate
    ["packages/genesis/src/genesis-authorship-migration-binding.js", "GENESIS_GOVERNED"],
    // review gate reads the SOURCE to verify refuse-and-report wiring — no invocation
    ["scripts/review/identity-recovery-refuse-report-check.mjs", "GATE_SOURCE_READ_ONLY"],
    // purity allowlist names it in prose
    ["scripts/review/kernel-purity-allowlist.js", "PROSE_REFERENCE"],
    // legacy CLI: may NAME the symbol in its refusal message, may not invoke it
    ["apps/cli/src/commands/authorship.js", "LEGACY_REFUSAL_ONLY"],
  ]);
  const rootUrl = new URL("..", import.meta.url).pathname;
  const hits = execFileSync("grep", [
    "-rl", "migrateLegacyAuthorshipKey",
    "--include=*.js", "--include=*.mjs",
    "packages/", "apps/", "scripts/", "bin/",
  ], { cwd: rootUrl, encoding: "utf8" })
    .trim().split("\n").filter((f) => f && !f.startsWith("tests/"));
  for (const f of hits) {
    assert.ok(CLASSIFIED.has(f),
      `unclassified production caller of migrateLegacyAuthorshipKey: ${f}`);
  }
  // And the two callers that must not INVOKE it in fact do not:
  const cli = readFileSync(join(rootUrl, "apps/cli/src/commands/authorship.js"), "utf8");
  assert.ok(!/migrateLegacyAuthorshipKey\s*\(/.test(cli),
    "the legacy CLI may reference the name in messages but never call it");
  const gate = readFileSync(join(rootUrl, "scripts/review/identity-recovery-refuse-report-check.mjs"), "utf8");
  assert.ok(!/await\s+migrateLegacyAuthorshipKey\s*\(/.test(gate));
});

// ── PW-09 ── removal control: the governed CLI path is wired, and detectably so
test("PW-09: the genesis CLI invokes the governed executor — regression is detectable", () => {
  const rootUrl = new URL("..", import.meta.url).pathname;
  const src = readFileSync(join(rootUrl, "apps/cli/src/commands/genesis.js"), "utf8");
  assert.ok(/executeGenesisAuthorshipMigration\s*\(/.test(src),
    "the governed executor must be the production Act-1 path");
  assert.ok(!/migrateLegacyAuthorshipKey/.test(src),
    "the genesis CLI must never reach the generic writer directly");
  // The seam this control watches: delete the executor call and this test is
  // the one that turns red — a hardened kernel nothing calls is not a defence.
});

// ── PW-10 ── human-consent removal control: preview + nonce alone never migrate
test("PW-10: a valid preview and fresh nonce without preview-bound consent refuse", async () => {
  const h = home();
  try {
    writeLegacyPair(h, generateEd25519Keypair());
    const pv = await sealed(h);
    // Envelope with the right phrase but hash-bound to nothing:
    const env = { schema: AUTHORSHIP_MIGRATION_CONSENT_SCHEMA, operation: "MIGRATE_AUTHORSHIP_KEY",
      consent: KEY_MIGRATE_CONSENT_PHRASE, nonce: pv.nonce, issued_at: AT, authority_delta: 0 };
    const r = await run(pv, env, h);
    assert.equal(r.migrated, false);
    assert.ok(["consent_binding_mismatch", "consent_envelope_malformed:preview_hash"].includes(r.error),
      `got ${r.error}`);
    // Wrong phrase inside an otherwise-valid envelope also refuses:
    const env2 = { ...envelopeFor(pv), consent: "migrate authorship key" };
    const r2 = await run(pv, env2, h);
    assert.equal(r2.migrated, false);
    assert.equal(r2.error, "consent_required");
  } finally { cleanup(h); }
});
