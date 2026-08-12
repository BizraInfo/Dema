import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, statSync, renameSync, symlinkSync, truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  buildAuthorshipMigrationPreview,
  buildAuthorshipMigrationConsentEnvelope,
  executeGenesisAuthorshipMigration,
  repositoryIdentityFromBinding,
} from "../packages/genesis/src/genesis-authorship-migration-binding.js";
import {
  keyPaths,
  loadActiveKeyPair,
  migrateLegacyAuthorshipKey,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { inspectConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import { captureDirectoryIdentity } from "../packages/mission/src/corridor-closure-gatherer.js";
import { readExecutingWorktreePosture } from "../packages/mission/src/executing-repository-binding.js";

/**
 * GENESIS-ACT1-COMPOSED-READINESS-1A
 *
 * Can the entire Act-1 ceremony be trusted as ONE state transition? The
 * three composition REDs measured at 9a8707d9, before repair:
 *
 *   CE-01  a directory swapped at the governed pathname between the outer
 *          estate gate and the mutation (ino 11050392 → 11050396) was
 *          MIGRATED — authority checked against one directory identity
 *          reached writes in another. PRECONDITION_CHECKED !=
 *          PRECONDITION_COMMITTED.
 *   CE-02  the full real-CLI ceremony through a parent alias COMMITTED the
 *          pointer, then refused recovery_required — MUTATION_THEN_REFUSE.
 *   CE-03  a worktree with dirty load-bearing source previewed (exit 0) and
 *          EXECUTED (migrated:true) — dirty loaded bytes spent sovereign
 *          authority. COMMITTED_OBJECT_IDENTITY !=
 *          LOADED_WORKTREE_BYTE_IDENTITY.
 *
 * Repairs, each standing on an existing giant: the estate expectation and
 * the SAME injected observer travel into migrateLegacyAuthorshipKey and are
 * re-observed UNDER the identity lease (the fingerprint law, applied to the
 * estate); the CLI canonicalizes the governed home from the observed
 * realpath so every downstream path sees one spelling; and a posture
 * sibling of the repository binding refuses dirty/unmeasurable load-bearing
 * worktrees on both sovereign-facing surfaces.
 *
 * Fixture estates only. No real ~/.dema. Real bin/dema wherever the claim
 * is about the production surface.
 */

const BIN = new URL("../bin/dema", import.meta.url).pathname;
const NODE = "node0-cr-fixture";
const REPO = repositoryIdentityFromBinding({ commit: "a".repeat(40), tree: "c".repeat(40) });

let nonceCounter = 0;
const freshNonce = () => `cr-nonce-${++nonceCounter}-${process.pid}`;
const future = () => new Date(Date.now() + 3600_000).toISOString();
const scratch = () => mkdtempSync(join(tmpdir(), "cr-"));
const cleanup = (d) => rmSync(d, { recursive: true, force: true });

function writePair(h, kp) {
  const p = keyPaths(h);
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(p.privateKey, kp.private_key_pem, { mode: 0o600 });
  writeFileSync(p.publicKey, kp.public_key_pem, { mode: 0o644 });
}

function dema(h, args, bin = BIN) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], {
      encoding: "utf8", cwd: tmpdir(), env: { ...process.env, DEMA_HOME: h },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}
const previewArgs = (nonce, out) => ["genesis", "migrate-key", "preview",
  "--node-id", NODE, "--nonce", nonce, "--expires-at", future(), "--out", out];
const consentArgs = (previewPath, out) => ["genesis", "migrate-key", "consent",
  "--preview", previewPath, "--consent", KEY_MIGRATE_CONSENT_PHRASE, "--out", out];
const executeArgs = (previewPath, envelopePath) => ["genesis", "migrate-key", "execute",
  "--preview", previewPath, "--consent-envelope", envelopePath];
const parsedError = (r) => {
  try { return JSON.parse(r.stdout).error; } catch { return undefined; }
};

function snapshotHome(h, { excludeConsent = false } = {}) {
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

// ── CR-01 ── the composed positive: one ceremony, one transition, provable
// from durable bytes by a fresh interpreter.
test("CR-01: composed ceremony migrates, and a fresh process re-derives the exact identity", async () => {
  const h = scratch();
  try {
    writePair(h, generateEd25519Keypair());
    const nonce = freshNonce();
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    const pv = dema(h, previewArgs(nonce, previewPath));
    assert.equal(pv.code, 0, pv.stderr);
    const artifact = JSON.parse(readFileSync(previewPath, "utf8"));
    assert.equal(consentCmdOk(h, previewPath, envelopePath), true);
    const ex = dema(h, executeArgs(previewPath, envelopePath));
    assert.equal(ex.code, 0, ex.stdout || ex.stderr);
    assert.equal(JSON.parse(ex.stdout).migrated, true);

    // Exactly one nonce consumed, exactly one generation, exact fingerprint.
    assert.equal((await inspectConsentNonce({ nonce, demaHome: h })).used, true);
    const active = await loadActiveKeyPair(h);
    assert.equal(active.ok, true);
    assert.equal(active.fingerprint, artifact.expected_fingerprint);
    const generations = readdirSync(join(h, "keys", "generations"));
    assert.equal(generations.length, 1, "no second key may be generated");

    // CR-09: kill nothing less than the whole interpreter — a NEW process
    // must re-derive the exact active identity from durable bytes alone.
    const out = execFileSync(process.execPath, ["-e", `
      import(${JSON.stringify(new URL("../packages/receipts/src/authorship-key-store.js", import.meta.url).href)})
        .then(async (m) => {
          const a = await m.loadActiveKeyPair(${JSON.stringify(h)});
          console.log(JSON.stringify({ ok: a.ok, fingerprint: a.fingerprint }));
        });
    `], { encoding: "utf8", env: { ...process.env } });
    const reloaded = JSON.parse(out.trim().split("\n").pop());
    assert.equal(reloaded.ok, true, "fresh-process loader must accept durable state");
    assert.equal(reloaded.fingerprint, artifact.expected_fingerprint,
      "the fresh process re-derives the exact previewed identity");
  } finally { cleanup(h); }
});
function consentCmdOk(h, previewPath, out) {
  return dema(h, consentArgs(previewPath, out)).code === 0;
}

// ── CE-01 ── the estate survives to the commitment boundary (kernel)
test("CE-01: a directory swapped at the governed pathname refuses under the lease", async () => {
  const kp = generateEd25519Keypair();
  const base = scratch();
  const P = join(base, "estate");
  const B = join(base, "impostor");
  mkdirSync(P); mkdirSync(B);
  try {
    writePair(P, kp); writePair(B, kp);
    const gateIdentity = captureDirectoryIdentity(P);
    // The gap, made deterministic: after the outer gate captured identity A,
    // the world swaps the directory at the pathname (same spelling, new ino).
    renameSync(P, join(base, "estate-original"));
    renameSync(B, P);
    assert.notEqual(captureDirectoryIdentity(P).ino, gateIdentity.ino);

    const before = snapshotHome(P);
    const refused = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE,
      demaHome: P,
      expectedFingerprint: kp.public_key_fingerprint,
      expectedTargetEstate: gateIdentity,
      observeTargetEstate: () => captureDirectoryIdentity(P),
    });
    assert.equal(refused.migrated, false);
    assert.equal(refused.error, "target_estate_mismatch_at_lease",
      "the lease-time re-observation is the boundary the swap cannot cross");
    assert.equal((await loadActiveKeyPair(P)).ok, false);
    assert.equal(snapshotHome(P), before,
      "the swapped-in directory must be byte-identical after the refusal");

    // REMOVAL CONTROL: the generic class-consent API without the estate law
    // is the pre-repair world — the same swap migrates. This measured
    // wrongness is what proves the lease-time recheck is load-bearing.
    const vacuous = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE,
      demaHome: P,
      expectedFingerprint: kp.public_key_fingerprint,
    });
    assert.equal(vacuous.migrated, true,
      "REMOVAL CONTROL: without the lease-time estate law the swap succeeds");
  } finally { cleanup(base); }
});

// ── CE-01-SEQ ── the executor wires the recheck (sequenced observer)
test("CE-01-SEQ: an estate that changes between gate and lease refuses with the nonce accounted", async () => {
  const kp = generateEd25519Keypair();
  const A = scratch(); const B = scratch();
  try {
    writePair(A, kp); writePair(B, kp);
    const estateA = captureDirectoryIdentity(A);
    const estateB = captureDirectoryIdentity(B);
    const pv = await buildAuthorshipMigrationPreview({
      demaHome: A, nodeId: NODE, nonce: freshNonce(), expiresAt: future(),
      repository: REPO, now: new Date().toISOString(), targetEstate: estateA,
    });
    assert.equal(pv.ok, true);
    const env = buildAuthorshipMigrationConsentEnvelope({
      preview: pv.preview, consent: KEY_MIGRATE_CONSENT_PHRASE,
      now: new Date().toISOString(),
    });
    // The world changes between the two observations: gate sees A, the
    // lease-time re-observation sees B. Deterministic — no timing races.
    let calls = 0;
    const sequencedObserver = () => (++calls === 1 ? estateA : estateB);
    const r = await executeGenesisAuthorshipMigration({
      preview: pv.preview, consentEnvelope: env.envelope, demaHome: A,
      now: new Date().toISOString(), executingRepository: REPO,
      observeTargetEstate: sequencedObserver,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "target_estate_mismatch_at_lease");
    assert.equal(calls >= 2, true, "the executor must wire the observer through to the lease");
    // Claim-before-effect law: the nonce was legitimately committed before
    // the lease — the refusal's durable record. Never reported as zero
    // mutation; the governed identity surface itself is untouched.
    assert.equal((await inspectConsentNonce({ nonce: pv.preview.nonce, demaHome: A })).used, true);
    assert.equal((await loadActiveKeyPair(A)).ok, false);
  } finally { cleanup(A); cleanup(B); }
});

// ── CE-02 ── parent-alias ceremony completes cleanly (real binary)
test("CE-02: the full ceremony through a parent alias migrates with no mutation-then-refuse", async () => {
  const base = scratch();
  const parent = join(base, "parent");
  const home = join(parent, "home");
  mkdirSync(home, { recursive: true });
  try {
    writePair(home, generateEd25519Keypair());
    const link = join(base, "link");
    symlinkSync(parent, link);
    const aliased = join(link, "home");
    const nonce = freshNonce();
    const previewPath = join(base, "preview.json");
    const envelopePath = join(base, "envelope.json");
    assert.equal(dema(aliased, previewArgs(nonce, previewPath)).code, 0);
    assert.equal(consentCmdOk(aliased, previewPath, envelopePath), true);
    const ex = dema(aliased, executeArgs(previewPath, envelopePath));
    assert.equal(ex.code, 0, ex.stdout || ex.stderr);
    const result = JSON.parse(ex.stdout);
    assert.equal(result.migrated, true,
      "SAME_DIRECTORY_IDENTITY must not become different authority by spelling");
    const active = await loadActiveKeyPair(home);
    assert.equal(active.ok, true, "the canonical loader accepts — no recovery_required");
  } finally { cleanup(base); }
});

// ── CE-03 ── dirty load-bearing worktree refuses on both surfaces (real binary)
test("CE-03: dirty load-bearing sources refuse preview and execute before any authority", async () => {
  const clone = scratch();
  const h = scratch();
  try {
    const repoRoot = new URL("..", import.meta.url).pathname;
    execFileSync("git", ["clone", "-q", "--no-hardlinks", repoRoot, clone]);
    writeFileSync(join(clone, "apps/cli/src/commands/genesis.js"),
      readFileSync(join(clone, "apps/cli/src/commands/genesis.js"), "utf8") +
      "\n// dirty load-bearing byte\n");
    writePair(h, generateEd25519Keypair());
    const cloneBin = join(clone, "bin", "dema");
    const pv = dema(h, previewArgs(freshNonce(), join(h, "p.json")), cloneBin);
    assert.notEqual(pv.code, 0);
    assert.match(pv.stderr, /working_tree_dirty/,
      "the sovereign is never asked to consent to a dirty execution context");
    const ex = dema(h, executeArgs(join(h, "p.json"), join(h, "e.json")), cloneBin);
    assert.notEqual(ex.code, 0);
    assert.match(ex.stderr, /working_tree_dirty/);
    assert.equal((await loadActiveKeyPair(h)).ok, false);
  } finally { cleanup(clone); cleanup(h); }
});

// ── CE-04 ── posture observer refuses blindness, and scopes to load-bearing paths
test("CE-04: unmeasurable posture refuses; only load-bearing dirt blocks", async () => {
  const broken = await readExecutingWorktreePosture({
    runGit: () => { throw new Error("no git"); },
  });
  assert.equal(broken.ok, false);
  assert.equal(broken.reason, "working_tree_unverifiable");

  const missing = await readExecutingWorktreePosture({});
  assert.equal(missing.reason, "git_runner_missing");

  const docsOnly = await readExecutingWorktreePosture({
    runGit: () => " M docs/TESTING.md\n?? tests/new.test.js\n",
  });
  assert.equal(docsOnly.working_tree_clean, true,
    "a dirty test or doc never blocks the ceremony");

  const kernelDirty = await readExecutingWorktreePosture({
    runGit: () => " M packages/genesis/src/genesis-authorship-migration-binding.js\n",
  });
  assert.equal(kernelDirty.working_tree_clean, false);

  const quoted = await readExecutingWorktreePosture({
    runGit: () => ' M "packages/odd name.js"\n',
  });
  assert.equal(quoted.working_tree_clean, false,
    "a quoted path under a load-bearing prefix must not read as clean");
});

// ── CE-05 ── crash debris is fail-closed and recoverable (real binary)
test("CE-05: a truncated artifact refuses deterministically; a fresh path recovers", async () => {
  const h = scratch();
  try {
    writePair(h, generateEd25519Keypair());
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    assert.equal(dema(h, previewArgs(freshNonce(), previewPath)).code, 0);
    assert.equal(consentCmdOk(h, previewPath, envelopePath), true);
    // Crash model: the preview artifact survives only partially.
    truncateSync(previewPath, Math.floor(statSync(previewPath).size / 2));
    const ex = dema(h, executeArgs(previewPath, envelopePath));
    assert.equal(ex.code, 1);
    assert.match(ex.stderr, /Refused: --preview and --consent-envelope/);
    assert.equal((await loadActiveKeyPair(h)).ok, false);

    // Recovery: the damaged artifact is left as evidence; a NEW path
    // completes the ceremony. wx is create-once, not crash-atomic — this
    // control proves debris cannot become authority, not durability.
    const p2 = join(h, "preview-2.json");
    const e2 = join(h, "envelope-2.json");
    assert.equal(dema(h, previewArgs(freshNonce(), p2)).code, 0);
    assert.equal(consentCmdOk(h, p2, e2), true);
    const ex2 = dema(h, executeArgs(p2, e2));
    assert.equal(ex2.code, 0, ex2.stdout || ex2.stderr);
    assert.equal(JSON.parse(ex2.stdout).migrated, true);
  } finally { cleanup(h); }
});

// ── C-13 ── replayed authority dies at the nonce, not at a soft mask
test("C-13: replaying the consumed ceremony refuses at the nonce authority", async () => {
  const h = scratch();
  try {
    writePair(h, generateEd25519Keypair());
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    assert.equal(dema(h, previewArgs(freshNonce(), previewPath)).code, 0);
    assert.equal(consentCmdOk(h, previewPath, envelopePath), true);
    assert.equal(JSON.parse(dema(h, executeArgs(previewPath, envelopePath)).stdout).migrated, true);
    const replay = dema(h, executeArgs(previewPath, envelopePath));
    assert.notEqual(replay.code, 0);
    assert.equal(parsedError(replay), "consent_nonce_already_claimed",
      "replay dies at the ONE nonce authority, before already_migrated could mask it");
  } finally { cleanup(h); }
});
