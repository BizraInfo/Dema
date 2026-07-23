// IDENTITY-RECOVERY-REFUSE-AND-REPORT-1E — red-first contract.
//
// Founder decision: identity recovery is narrowed to REFUSE-AND-REPORT.
// Detection and diagnosis may be automatic; root-of-trust recovery MUTATION
// requires a separate, explicitly consented C5 transaction that this slice
// deliberately does NOT implement.
//
// Invariant under proof: no automatic path (init, migrate, inspection) ever
// mutates an invalid active identity — no pointer rename/delete/replace, no
// generation move, no metadata repair, no replacement keypair. R1–R21 mirror
// the mandatory test list of the 1E bootstrap. Every test runs against a
// throwaway DEMA_HOME (mkdtemp); the real ~/.dema is never resolved when
// demaHome is passed (R21).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync as spawn } from "node:child_process";
import { join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import * as store from "../packages/receipts/src/authorship-key-store.js";
import {
  generateEd25519Keypair,
  sha256,
} from "../packages/receipts/src/authorship-signature.js";

const {
  initAuthorshipKey,
  migrateLegacyAuthorshipKey,
  activeKeyPaths,
  keyPaths,
  KEY_INIT_CONSENT_PHRASE,
  KEY_MIGRATE_CONSENT_PHRASE,
  ACTIVE_POINTER_SCHEMA,
  GENERATION_METADATA_SCHEMA,
} = store;

const NOW = "2026-07-23T20:00:00.000Z";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-irr1e-"));
}

async function initedHome() {
  const home = freshHome();
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
    now: NOW,
  });
  assert.equal(r.initialized, true);
  return home;
}

function readPointer(home) {
  return JSON.parse(readFileSync(activeKeyPaths(home).activePointer, "utf8"));
}

function writePointer(home, doc) {
  writeFileSync(activeKeyPaths(home).activePointer, JSON.stringify(doc));
}

// Full-fidelity tree snapshot: every entry's kind + content hash (files) or
// link target (symlinks). Two identical snapshots prove ZERO mutation.
function snapshotTree(root) {
  const entries = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const rel = relative(root, path);
      // No check-then-use anywhere: readlink IS the symlink probe, and
      // everything else is classified via fstat on an O_NOFOLLOW-opened
      // descriptor — never a path re-check after a path check.
      let linkTarget = null;
      try {
        linkTarget = readlinkSync(path);
      } catch {
        linkTarget = null;
      }
      if (linkTarget !== null) {
        entries.push([rel, "symlink", linkTarget]);
        continue;
      }
      let fd = null;
      try {
        fd = openSync(
          path,
          fsConstants.O_RDONLY |
            (fsConstants.O_NOFOLLOW ?? 0) |
            (fsConstants.O_NONBLOCK ?? 0),
        );
        const stat = fstatSync(fd);
        if (stat.isDirectory()) {
          entries.push([rel, "dir", ""]);
          walk(path);
        } else if (stat.isFile()) {
          entries.push([rel, "file", sha256(readFileSync(fd, "utf8"))]);
        } else {
          entries.push([rel, "other", String(stat.mode)]);
        }
      } catch {
        entries.push([rel, "other", "unopenable"]);
      } finally {
        if (fd !== null) closeSync(fd);
      }
    }
  };
  walk(root);
  return JSON.stringify(entries);
}

async function initAttempt(home) {
  return initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
    now: NOW,
  });
}

async function migrateAttempt(home) {
  return migrateLegacyAuthorshipKey({
    consent: KEY_MIGRATE_CONSENT_PHRASE,
    demaHome: home,
    now: NOW,
  });
}

function assertRefusalEnvelope(r, expectedClass) {
  assert.equal(r.error, "recovery_required");
  assert.equal(r.recovery_class, expectedClass);
  assert.equal(r.recommended_action, "RUN_EXPLICIT_IDENTITY_RECOVERY");
  assert.equal(r.active_pointer_preserved, true);
  assert.equal(r.authority_delta, 0);
}

function assertInitRefusal(r, expectedClass) {
  assert.equal(r.initialized, false);
  assertRefusalEnvelope(r, expectedClass);
  assert.equal(r.generation_preserved, true);
  assert.equal(r.new_identity_generated, false);
}

function assertMigrateRefusal(r, expectedClass) {
  assert.equal(r.migrated, false);
  assertRefusalEnvelope(r, expectedClass);
  assert.equal(r.legacy_pair_preserved, true);
}

// Scenario builders — each returns a home whose ACTIVE identity is invalid in
// one precise way. Setup mutation is fixture work; the zero-mutation snapshot
// is taken AFTER setup, before the call under test.

async function homeInvalidGenesisPointer() {
  const home = await initedHome();
  const p = readPointer(home);
  assert.equal(p.previous_generation, null);
  rmSync(join(activeKeyPaths(home).generationsDir, p.generation_fingerprint), {
    recursive: true,
  });
  return home;
}

async function homeInvalidPriorPointer() {
  const home = await initedHome();
  const p = readPointer(home);
  rmSync(join(activeKeyPaths(home).generationsDir, p.generation_fingerprint), {
    recursive: true,
  });
  writePointer(home, { ...p, previous_generation: "b".repeat(64) });
  return home;
}

async function homeUntrackedPointer() {
  const home = await initedHome();
  writeFileSync(activeKeyPaths(home).activePointer, "{not json");
  return home;
}

async function homeSymlinkedPointer() {
  const home = await initedHome();
  const ap = activeKeyPaths(home);
  const outside = mkdtempSync(join(tmpdir(), "dema-irr1e-out-"));
  const target = join(outside, "planted-pointer.json");
  writeFileSync(target, readFileSync(ap.activePointer, "utf8"));
  rmSync(ap.activePointer);
  symlinkSync(target, ap.activePointer);
  return { home, target };
}

async function homeNonRegularPointer() {
  const home = await initedHome();
  const ap = activeKeyPaths(home);
  rmSync(ap.activePointer);
  mkdirSync(ap.activePointer);
  return home;
}

async function homeCorruptGeneration() {
  const home = await initedHome();
  const p = readPointer(home);
  const genDir = join(activeKeyPaths(home).generationsDir, p.generation_fingerprint);
  const other = generateEd25519Keypair();
  writeFileSync(join(genDir, "public.pem"), other.public_key_pem);
  return { home, genDir, fingerprint: p.generation_fingerprint };
}

async function homeRetiredGeneration() {
  const home = await initedHome();
  const p = readPointer(home);
  writeFileSync(
    activeKeyPaths(home).retiredRegistry,
    `${JSON.stringify({ retired: [{ fingerprint: p.generation_fingerprint }] })}\n`,
  );
  return home;
}

function legacyPair(home) {
  const paths = keyPaths(home);
  mkdirSync(paths.dir, { recursive: true });
  const keys = generateEd25519Keypair();
  writeFileSync(paths.privateKey, keys.private_key_pem, { mode: 0o600 });
  writeFileSync(paths.publicKey, keys.public_key_pem);
  return keys;
}

// A home where init committed its pointer but canonical verification fails:
// a DIRECTORY at keys/retired-registry.json makes checkRetired unreadable, so
// the post-commit loadActiveKeyPair refuses while pointer + generation exist.
async function homeCommittedVerificationFailure() {
  const home = freshHome();
  const ap = activeKeyPaths(home);
  mkdirSync(ap.dir, { recursive: true });
  mkdirSync(ap.retiredRegistry);
  const first = await initAttempt(home);
  assert.equal(first.initialized, false);
  assert.equal(first.error, "recovery_required");
  assert.equal(first.transition_state, "pointer_committed_verification_failed");
  return { home, first };
}

describe("R1 invalid genesis pointer causes zero recovery mutation", () => {
  it("init refuses with INVALID_GENESIS_POINTER and mutates nothing", async () => {
    const home = await homeInvalidGenesisPointer();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assertInitRefusal(r, "INVALID_GENESIS_POINTER");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R2 invalid prior pointer causes zero recovery mutation", () => {
  it("init refuses with INVALID_PRIOR_POINTER and mutates nothing", async () => {
    const home = await homeInvalidPriorPointer();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assertInitRefusal(r, "INVALID_PRIOR_POINTER");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R3 untracked malformed pointer causes zero mutation", () => {
  it("init refuses with UNTRACKED_INVALID_POINTER and mutates nothing", async () => {
    const home = await homeUntrackedPointer();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assertInitRefusal(r, "UNTRACKED_INVALID_POINTER");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R4 symlinked pointer causes zero mutation", () => {
  it("init refuses with UNSAFE_POINTER_PATH; symlink and its target survive", async () => {
    const { home, target } = await homeSymlinkedPointer();
    const ap = activeKeyPaths(home);
    const before = snapshotTree(home);
    const targetBytes = readFileSync(target, "utf8");
    const r = await initAttempt(home);
    assertInitRefusal(r, "UNSAFE_POINTER_PATH");
    assert.equal(snapshotTree(home), before);
    assert.equal(lstatSync(ap.activePointer).isSymbolicLink(), true);
    assert.equal(readlinkSync(ap.activePointer), target);
    assert.equal(readFileSync(target, "utf8"), targetBytes);
  });
});

describe("R4b pointer behind a symlinked keys dir causes zero mutation", () => {
  it("init and migrate refuse with UNSAFE_POINTER_PATH; nothing moves", async () => {
    const home = freshHome();
    const outside = mkdtempSync(join(tmpdir(), "dema-irr1e-dir-"));
    writeFileSync(join(outside, "active-key.json"), "{planted");
    symlinkSync(outside, join(home, "keys"), "dir");
    const before = snapshotTree(outside);
    const ri = await initAttempt(home);
    const rm2 = await migrateAttempt(home);
    assertInitRefusal(ri, "UNSAFE_POINTER_PATH");
    assertMigrateRefusal(rm2, "UNSAFE_POINTER_PATH");
    assert.equal(snapshotTree(outside), before);
    assert.equal(lstatSync(join(home, "keys")).isSymbolicLink(), true);
  });
});

describe("R5 non-regular pointer causes zero mutation", () => {
  it("init refuses with UNSAFE_POINTER_PATH on a directory pointer", async () => {
    const home = await homeNonRegularPointer();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assertInitRefusal(r, "UNSAFE_POINTER_PATH");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R6 corrupt generation causes zero mutation", () => {
  it("init refuses with CORRUPT_GENERATION and mutates nothing", async () => {
    const { home } = await homeCorruptGeneration();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assertInitRefusal(r, "CORRUPT_GENERATION");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R7 retired generation causes zero mutation", () => {
  it("init refuses with RETIRED_GENERATION and mutates nothing", async () => {
    const home = await homeRetiredGeneration();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assertInitRefusal(r, "RETIRED_GENERATION");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R8 failed post-init verification preserves the pointer", () => {
  it("committed pointer survives the verification failure untouched", async () => {
    const { home, first } = await homeCommittedVerificationFailure();
    assert.equal(first.active_pointer_preserved, true);
    assert.equal(first.authority_delta, 0);
    assert.equal(first.recommended_action, "RUN_EXPLICIT_IDENTITY_RECOVERY");
    const pointer = readPointer(home);
    assert.equal(pointer.schema, ACTIVE_POINTER_SCHEMA);
    assert.match(pointer.generation_fingerprint, /^[0-9a-f]{64}$/);
  });
});

describe("R9 failed post-init verification preserves the generation", () => {
  it("generation dir keeps private/public/metadata for the committed pointer", async () => {
    const { home, first } = await homeCommittedVerificationFailure();
    assert.equal(first.generation_preserved, true);
    const pointer = readPointer(home);
    const genDir = join(
      activeKeyPaths(home).generationsDir,
      pointer.generation_fingerprint,
    );
    const files = readdirSync(genDir).sort();
    assert.deepEqual(files, ["metadata.json", "private.pem", "public.pem"]);
  });
});

describe("R10 retry does not generate a second keypair", () => {
  it("second init refuses and generations dir still holds exactly one entry", async () => {
    const { home } = await homeCommittedVerificationFailure();
    const retry = await initAttempt(home);
    assert.equal(retry.initialized, false);
    assert.equal(retry.error, "recovery_required");
    assert.equal(retry.new_identity_generated, false);
    const generations = readdirSync(activeKeyPaths(home).generationsDir);
    assert.equal(generations.length, 1);
  });
});

describe("R11 repeated retry returns a stable recovery classification", () => {
  it("three retries return the same recovery_class with zero mutation", async () => {
    const { home } = await homeCommittedVerificationFailure();
    const r1 = await initAttempt(home);
    const before = snapshotTree(home);
    const r2 = await initAttempt(home);
    const r3 = await initAttempt(home);
    assert.equal(r1.error, "recovery_required");
    assert.equal(typeof r1.recovery_class, "string");
    assert.equal(r2.recovery_class, r1.recovery_class);
    assert.equal(r3.recovery_class, r1.recovery_class);
    assert.equal(snapshotTree(home), before);
  });
});

describe("R12 invalid-pointer migration does not remigrate", () => {
  it("migrate refuses with recovery_required and mutates nothing", async () => {
    const home = await homeUntrackedPointer();
    legacyPair(home);
    const before = snapshotTree(home);
    const r = await migrateAttempt(home);
    assertMigrateRefusal(r, "UNTRACKED_INVALID_POINTER");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R13 invalid-pointer migration does not overwrite a concurrent valid identity", () => {
  it("a foreign valid generation and the invalid pointer both survive migrate", async () => {
    const home = await homeUntrackedPointer();
    legacyPair(home);
    // Concurrent process planted a complete valid generation (no pointer swap).
    const ap = activeKeyPaths(home);
    const keys = generateEd25519Keypair();
    const genDir = join(ap.generationsDir, keys.public_key_fingerprint);
    mkdirSync(genDir, { recursive: true });
    writeFileSync(join(genDir, "private.pem"), keys.private_key_pem, { mode: 0o600 });
    writeFileSync(join(genDir, "public.pem"), keys.public_key_pem);
    writeFileSync(
      join(genDir, "metadata.json"),
      `${JSON.stringify({
        schema: GENERATION_METADATA_SCHEMA,
        fingerprint: keys.public_key_fingerprint,
        generation_id: keys.public_key_fingerprint,
        algorithm: "ed25519",
        private_content_hash: sha256(keys.private_key_pem),
        public_content_hash: sha256(keys.public_key_pem),
        created_at: NOW,
        source: "test_concurrent",
      }, null, 2)}\n`,
    );
    const before = snapshotTree(home);
    const r = await migrateAttempt(home);
    assert.equal(r.migrated, false);
    assert.equal(r.error, "recovery_required");
    assert.equal(snapshotTree(home), before);
  });
});

describe("R14 no automatic path invokes pointer rename", () => {
  it("the symlinked pointer is byte-identical after init AND migrate attempts", async () => {
    const { home, target } = await homeSymlinkedPointer();
    legacyPair(home);
    const ap = activeKeyPaths(home);
    const before = snapshotTree(home);
    await initAttempt(home);
    await migrateAttempt(home);
    assert.equal(snapshotTree(home), before);
    assert.equal(lstatSync(ap.activePointer).isSymbolicLink(), true);
    assert.equal(readlinkSync(ap.activePointer), target);
  });
});

describe("R15 no automatic path deletes authority evidence", () => {
  it("corrupt generation files survive init AND migrate attempts unchanged", async () => {
    const { home, genDir } = await homeCorruptGeneration();
    legacyPair(home);
    const before = snapshotTree(home);
    await initAttempt(home);
    await migrateAttempt(home);
    assert.equal(snapshotTree(home), before);
    const files = readdirSync(genDir).sort();
    assert.deepEqual(files, ["metadata.json", "private.pem", "public.pem"]);
  });
});

describe("R16 no automatic path repairs metadata", () => {
  it("malformed metadata bytes are preserved; no .recovery sibling appears", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    const genDir = join(activeKeyPaths(home).generationsDir, p.generation_fingerprint);
    writeFileSync(join(genDir, "metadata.json"), "{bad metadata");
    legacyPair(home);
    const before = snapshotTree(home);
    const ri = await initAttempt(home);
    const rm = await migrateAttempt(home);
    assertInitRefusal(ri, "CORRUPT_GENERATION");
    assertMigrateRefusal(rm, "CORRUPT_GENERATION");
    assert.equal(snapshotTree(home), before);
    assert.equal(readFileSync(join(genDir, "metadata.json"), "utf8"), "{bad metadata");
    assert.deepEqual(
      readdirSync(genDir).filter((f) => f.endsWith(".recovery")),
      [],
    );
  });
});

describe("R17 recovery inspector returns no private-key content", () => {
  it("inspection of a valid identity carries no PEM or secret material", async () => {
    const home = await initedHome();
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "VALID_ACTIVE_IDENTITY");
    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /PRIVATE KEY/);
    assert.doesNotMatch(serialized, /BEGIN [A-Z ]*KEY/);
  });

  it("inspection of a corrupt identity carries no PEM or secret material", async () => {
    const { home } = await homeCorruptGeneration();
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "CORRUPT_GENERATION");
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE KEY|BEGIN [A-Z ]*KEY/);
  });
});

describe("R18 incomplete artifact evidence reports UNKNOWN", () => {
  it("a non-file entry under receipts yields artifact_binding_state UNKNOWN", async () => {
    const { home } = await homeCorruptGeneration();
    mkdirSync(join(home, "receipts", "nested"), { recursive: true });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.artifact_binding_state, "UNKNOWN");
  });

  it("an unknown fingerprint yields UNKNOWN, never a definitive non-use", async () => {
    const home = await homeUntrackedPointer();
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "UNTRACKED_INVALID_POINTER");
    assert.equal(report.artifact_binding_state, "UNKNOWN");
  });

  it("a bounded clean scan reports NOT_DETECTED_BOUNDED_SCAN, and a bound receipt DETECTED", async () => {
    const { home, fingerprint } = await homeCorruptGeneration();
    mkdirSync(join(home, "receipts"), { recursive: true });
    writeFileSync(join(home, "receipts", "unrelated.json"), "{}\n");
    const clean = await store.inspectIdentityRecovery(home);
    assert.equal(clean.artifact_binding_state, "NOT_DETECTED_BOUNDED_SCAN");
    writeFileSync(
      join(home, "receipts", "authorship-1.json"),
      `${JSON.stringify({ public_key_fingerprint: fingerprint })}\n`,
    );
    const bound = await store.inspectIdentityRecovery(home);
    assert.equal(bound.artifact_binding_state, "DETECTED");
  });
});

describe("R19 valid active identity still returns verified key_already_exists", () => {
  it("init refuses with verified_existing_identity and zero authority delta", async () => {
    const home = await initedHome();
    const before = snapshotTree(home);
    const r = await initAttempt(home);
    assert.equal(r.initialized, false);
    assert.equal(r.error, "key_already_exists");
    assert.equal(r.verified_existing_identity, true);
    assert.equal(r.authority_delta, 0);
    assert.equal(snapshotTree(home), before);
  });

  it("migrate refuses with verified already_migrated and zero authority delta", async () => {
    const home = await initedHome();
    legacyPair(home);
    const before = snapshotTree(home);
    const r = await migrateAttempt(home);
    assert.equal(r.migrated, false);
    assert.equal(r.error, "already_migrated");
    assert.equal(r.verified_existing_identity, true);
    assert.equal(r.authority_delta, 0);
    assert.equal(snapshotTree(home), before);
  });
});

describe("R20 all resolved paths remain inside disposable DEMA_HOME", () => {
  it("inspector paths are contained in the throwaway home", async () => {
    const home = await homeInvalidGenesisPointer();
    const report = await store.inspectIdentityRecovery(home);
    for (const p of [report.active_pointer_path, report.generation_path]) {
      if (p === null) continue;
      const rel = relative(home, p);
      assert.equal(rel === ".." || rel.startsWith("..") || isAbsolute(rel), false);
    }
    assert.equal(report.recovery_class, "INVALID_GENESIS_POINTER");
  });
});

describe("R21 real ~/.dema/keys is never resolved, read or written", () => {
  it("explicit demaHome never falls back to HOME or DEMA_HOME env", async () => {
    const canaryEnvHome = mkdtempSync(join(tmpdir(), "dema-irr1e-env-"));
    const canaryHome = mkdtempSync(join(tmpdir(), "dema-irr1e-home-"));
    const oldHome = process.env.HOME;
    const oldDemaHome = process.env.DEMA_HOME;
    process.env.HOME = canaryHome;
    process.env.DEMA_HOME = canaryEnvHome;
    try {
      const home = await homeInvalidGenesisPointer();
      await initAttempt(home);
      await migrateAttempt(home);
      await store.inspectIdentityRecovery(home);
      const valid = await initedHome();
      await store.inspectIdentityRecovery(valid);
      assert.deepEqual(readdirSync(canaryEnvHome), []);
      assert.deepEqual(readdirSync(canaryHome), []);
      assert.equal(keyPaths(home).dir.startsWith(home), true);
    } finally {
      process.env.HOME = oldHome;
      if (oldDemaHome === undefined) delete process.env.DEMA_HOME;
      else process.env.DEMA_HOME = oldDemaHome;
    }
  });
});

describe("inspectIdentityRecovery contract (§10)", () => {
  it("returns the full refuse-and-report schema on an invalid identity", async () => {
    const home = await homeInvalidPriorPointer();
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.schema, "bizra.dema.identity_recovery_inspection.v0.1");
    assert.equal(report.recovery_class, "INVALID_PRIOR_POINTER");
    assert.equal(typeof report.active_pointer_path, "string");
    assert.match(report.active_pointer_hash, /^[0-9a-f]{64}$/);
    assert.match(report.generation_fingerprint, /^[0-9a-f]{64}$/);
    // 1E.1-A: a loader-rejected pointer's path claim is never republished.
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.match(report.pointer_claimed_generation_path_hash, /^[0-9a-f]{64}$/);
    assert.equal(report.loader_error, "generation_missing");
    assert.equal(report.previous_generation, "b".repeat(64));
    assert.equal(typeof report.legacy_pair_presence, "boolean");
    assert.equal(report.transition_lease_state, "NONE");
    assert.equal(report.automatic_recovery_allowed, false);
    assert.equal(report.required_consent_class, "C5");
    assert.equal(report.recommended_action, "RUN_EXPLICIT_IDENTITY_RECOVERY");
    assert.equal(report.authority_delta, 0);
  });

  it("maps an empty home to NO_ACTIVE_IDENTITY", async () => {
    const report = await store.inspectIdentityRecovery(freshHome());
    assert.equal(report.recovery_class, "NO_ACTIVE_IDENTITY");
    assert.equal(report.automatic_recovery_allowed, false);
  });

  it("maps a live transition lease to IDENTITY_TRANSITION_IN_PROGRESS", async () => {
    const home = await initedHome();
    const ap = activeKeyPaths(home);
    mkdirSync(ap.transactionsDir, { recursive: true });
    writeFileSync(ap.identityLease, JSON.stringify({ pid: process.pid }));
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "IDENTITY_TRANSITION_IN_PROGRESS");
    assert.equal(report.transition_lease_state, "HOLDER_ALIVE");
  });

  it("maps a dead-holder lease to IDENTITY_TRANSITION_IN_PROGRESS with HOLDER_DEAD", async () => {
    const home = await initedHome();
    const ap = activeKeyPaths(home);
    const dead = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    mkdirSync(ap.transactionsDir, { recursive: true });
    writeFileSync(ap.identityLease, JSON.stringify({ pid: dead.pid }));
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "IDENTITY_TRANSITION_IN_PROGRESS");
    assert.equal(report.transition_lease_state, "HOLDER_DEAD");
    assert.equal(report.recommended_action, "RUN_EXPLICIT_IDENTITY_RECOVERY");
  });

  it("maps an unreadable retired registry to RECOVERY_STATE_UNKNOWN", async () => {
    const home = await initedHome();
    const ap = activeKeyPaths(home);
    rmSync(ap.retiredRegistry, { force: true });
    mkdirSync(ap.retiredRegistry);
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "RECOVERY_STATE_UNKNOWN");
  });
});

// ── IDENTITY-RECOVERY-REPORT-INTEGRITY-1E.1 ────────────────────────────────
// Review round on exact head 58c543f. Finding A: the inspector republished a
// loader-rejected pointer's raw generation_path — attacker-controlled claims
// must never be promoted into authoritative diagnostics. Finding B: the static
// gate's extractor only saw `function` declarations — every callable form must
// be covered or the gate must fail closed.

describe("1E.1-A generation-path evidence containment", () => {
  it("A1 absolute external path claim is never returned — hash + trust state only", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    writePointer(home, { ...p, generation_path: "/zz-attacker-marker/chosen/path" });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.equal(
      report.pointer_claimed_generation_path_hash,
      sha256("/zz-attacker-marker/chosen/path"),
    );
    assert.doesNotMatch(JSON.stringify(report), /zz-attacker-marker/);
  });

  it("A2 ../ traversal claim is never returned", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    writePointer(home, {
      ...p,
      generation_path: "../../../../zz-traversal-marker",
    });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.doesNotMatch(JSON.stringify(report), /zz-traversal-marker/);
  });

  it("A3 a claim that normalizes outside generations is rejected", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    writePointer(home, {
      ...p,
      generation_path: "generations/../../zz-normalize-marker",
    });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.doesNotMatch(JSON.stringify(report), /zz-normalize-marker/);
  });

  it("A4 a symlink-escape claim is rejected without republication", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    const outside = mkdtempSync(join(tmpdir(), "dema-irr1e1-esc-"));
    symlinkSync(outside, join(activeKeyPaths(home).generationsDir, "zz-evil-link"), "dir");
    writePointer(home, { ...p, generation_path: join("generations", "zz-evil-link") });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.doesNotMatch(JSON.stringify(report), /zz-evil-link/);
  });

  it("A5 a mismatched-fingerprint path claim is rejected", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    const ap = activeKeyPaths(home);
    const realGen = join(ap.generationsDir, p.generation_fingerprint);
    const fakeFp = "c".repeat(64);
    const fakeGen = join(ap.generationsDir, fakeFp);
    mkdirSync(fakeGen, { recursive: true });
    for (const f of ["private.pem", "public.pem", "metadata.json"]) {
      writeFileSync(join(fakeGen, f), readFileSync(join(realGen, f), "utf8"));
    }
    writePointer(home, { ...p, generation_path: join("generations", fakeFp) });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.doesNotMatch(JSON.stringify(report), new RegExp(fakeFp));
  });

  it("A6 a valid canonical generation path is returned VERIFIED_CONTAINED", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "VALID_ACTIVE_IDENTITY");
    assert.equal(report.generation_path_state, "VERIFIED_CONTAINED");
    assert.equal(typeof report.generation_path, "string");
    assert.equal(report.generation_path.endsWith(p.generation_fingerprint), true);
    assert.equal(report.pointer_claimed_generation_path_hash, null);
  });

  it("A7 a pointer with no usable path claim reports ABSENT", async () => {
    const home = await homeUntrackedPointer();
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "ABSENT");
    assert.equal(report.pointer_claimed_generation_path_hash, null);
  });

  it("A9 a path-like previous_generation claim is never republished", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    writePointer(home, {
      ...p,
      generation_path: "generations/" + "d".repeat(64),
      previous_generation: "/zz-prev-attacker-marker/../etc",
    });
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.previous_generation, null);
    assert.doesNotMatch(JSON.stringify(report), /zz-prev-attacker-marker/);
  });

  it("A10 a well-formed fingerprint previous_generation claim is retained", async () => {
    const home = await homeInvalidPriorPointer();
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.previous_generation, "b".repeat(64));
  });

  it("A8 the dangling-genesis claim from R20 is hash-only, not republished", async () => {
    const home = await homeInvalidGenesisPointer();
    const claimed = readPointer(home).generation_path;
    const report = await store.inspectIdentityRecovery(home);
    assert.equal(report.recovery_class, "INVALID_GENESIS_POINTER");
    assert.equal(report.generation_path, null);
    assert.equal(report.generation_path_state, "UNTRUSTED_OR_UNCONTAINED");
    assert.equal(report.pointer_claimed_generation_path_hash, sha256(claimed));
  });
});

describe("1E.1-B gate covers every callable form or fails closed", () => {
  async function runGate(sourceOverride) {
    const { runIdentityRecoveryRefuseReportCheck } = await import(
      "../scripts/review/identity-recovery-refuse-report-check.mjs"
    );
    return runIdentityRecoveryRefuseReportCheck({ sourceOverride });
  }

  it("B9 an arrow-function mutator helper is detected", async () => {
    const r = await runGate(
      "const hidden = () => rename(a, b);\n" +
        "function classifyPointerAuthority(h) { return hidden(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B10 a function-expression mutator helper is detected", async () => {
    const r = await runGate(
      "const hidden = function () { unlink(x); };\n" +
        "function classifyPointerAuthority(h) { return hidden(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B11 an object-method mutator helper fails the gate", async () => {
    const r = await runGate(
      "const obj = { helper() { rename(a, b); } };\n" +
        "function classifyPointerAuthority(h) { return obj.helper(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B12 a class-method mutator helper is detected", async () => {
    const r = await runGate(
      "class K { helper() { rename(a, b); } }\n" +
        "function classifyPointerAuthority(h) { return new K().helper(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B13 indirect multi-hop mutation reachability is detected", async () => {
    const r = await runGate(
      "function deep() { return rename(a, b); }\n" +
        "function middle() { return deep(); }\n" +
        "function classifyPointerAuthority(h) { return middle(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B14 a clean read-only helper graph passes", async () => {
    const r = await runGate(
      "const readHelper = async (p) => p;\n" +
        "function classifyPointerAuthority(h) { return readHelper(h); }\n" +
        "function inspectIdentityRecovery(h) { return classifyPointerAuthority(h); }\n",
    );
    assert.equal(r.ok, true);
  });

  it("B16 an object-literal getter mutator fails the gate", async () => {
    const r = await runGate(
      "const obj = { get hidden() { return rename(a, b); } };\n" +
        "function classifyPointerAuthority(h) { return obj.hidden; }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B17 a generator-method mutator fails the gate", async () => {
    const r = await runGate(
      "const obj = { *hidden() { yield rename(a, b); } };\n" +
        "function classifyPointerAuthority(h) { return obj.hidden(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B18 a computed-name method mutator fails the gate", async () => {
    const r = await runGate(
      'const key = "hidden";\n' +
        "const obj = { [key]() { rename(a, b); } };\n" +
        "function classifyPointerAuthority(h) { return obj[key](); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });

  it("B15 unsupported callable syntax fails closed rather than disappearing", async () => {
    const r = await runGate(
      "const weird = (0, () => rename(a, b));\n" +
        "function classifyPointerAuthority(h) { return weird(); }\n" +
        "function inspectIdentityRecovery(h) { return null; }\n",
    );
    assert.equal(r.ok, false);
  });
});

describe("static refuse-and-report gate", () => {
  it("passes on the real tree and fails on quarantine-shaped source", async () => {
    const { runIdentityRecoveryRefuseReportCheck } = await import(
      "../scripts/review/identity-recovery-refuse-report-check.mjs"
    );
    const real = await runIdentityRecoveryRefuseReportCheck();
    assert.equal(real.ok, true);
    const synthetic = await runIdentityRecoveryRefuseReportCheck({
      sourceOverride:
        "async function quarantineActivePointer(h){ await rename(a,b); }\n" +
        "async function classifyPointerAuthority(h){ return quarantineActivePointer(h); }\n",
    });
    assert.equal(synthetic.ok, false);
  });
});
