// IDENTITY-PAIR-COHERENCE-1A — red-first contract.
//
// Invariant under proof: no signing consumer can observe or combine key
// material from different active generations, including during pointer
// changes, crashes, retries, or malformed-state recovery.
//
// T1-T17 mirror the mandatory test list of the slice contract. Every test
// runs against a throwaway DEMA_HOME (mkdtemp); the real ~/.dema is never
// resolved when demaHome is passed (T17).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import childProcess from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  initAuthorshipKey,
  loadActiveKeyPair,
  migrateLegacyAuthorshipKey,
  inspectActiveIdentity,
  activeKeyPaths,
  keyPaths,
  loadPublicKey,
  KEY_INIT_CONSENT_PHRASE,
  KEY_MIGRATE_CONSENT_PHRASE,
  ACTIVE_POINTER_SCHEMA,
  GENERATION_METADATA_SCHEMA,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  generateEd25519Keypair,
  signPayload,
  verifyPayload,
  sha256,
} from "../packages/receipts/src/authorship-signature.js";

const NOW = "2026-07-22T20:00:00.000Z";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-ipc1a-"));
}

// Build a second immutable generation and atomically swap the active pointer —
// the exact primitive a governed rotation will use. init can no longer replace
// an active generation (finding #2), so transition tests drive the pointer
// directly rather than through a forbidden force-reinit.
function plantGenerationAndActivate(home, now = NOW) {
  const ap = activeKeyPaths(home);
  const keys = generateEd25519Keypair();
  const fp = keys.public_key_fingerprint;
  const genDir = join(ap.generationsDir, fp);
  mkdirSync(genDir, { recursive: true });
  writeFileSync(join(genDir, "private.pem"), keys.private_key_pem, { mode: 0o600 });
  writeFileSync(join(genDir, "public.pem"), keys.public_key_pem);
  writeFileSync(
    join(genDir, "metadata.json"),
    JSON.stringify({
      schema: GENERATION_METADATA_SCHEMA,
      fingerprint: fp,
      generation_id: fp,
      algorithm: "ed25519",
      private_content_hash: sha256(keys.private_key_pem),
      public_content_hash: sha256(keys.public_key_pem),
      created_at: now,
      source: "test_transition",
    }, null, 2) + "\n",
  );
  const staged = `${ap.activePointer}.next`;
  const pointerBytes = JSON.stringify({
    schema: ACTIVE_POINTER_SCHEMA,
    generation_fingerprint: fp,
    generation_path: join("generations", fp),
    activated_at: now,
    previous_generation: null,
    transition_id: sha256(`test->${fp}@${now}`),
  }, null, 2) + "\n";
  writeFileSync(staged, pointerBytes);
  renameSync(staged, ap.activePointer);
  return fp;
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

describe("T1 valid generation loads one coherent pair", () => {
  it("returns ok with matching fingerprint, pems, and hashes", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true);
    assert.match(pair.fingerprint, /^[0-9a-f]{64}$/);
    assert.match(pair.private_key_pem, /BEGIN PRIVATE KEY/);
    assert.match(pair.public_key_pem, /BEGIN PUBLIC KEY/);
    assert.match(pair.metadata_hash, /^[0-9a-f]{64}$/);
    assert.match(pair.active_pointer_hash, /^[0-9a-f]{64}$/);
    // The served pair signs and verifies against itself — one generation.
    const sig = signPayload({ probe: "t1" }, pair.private_key_pem);
    assert.equal(verifyPayload({ probe: "t1" }, sig, pair.public_key_pem), true);
    // Pointer agrees with generation dir (T-pointer/generation agreement).
    const pointer = readPointer(home);
    assert.equal(pointer.schema, ACTIVE_POINTER_SCHEMA);
    assert.equal(pointer.generation_fingerprint, pair.fingerprint);
  });
});

describe("T2 mismatched generation files fail closed", () => {
  it("refuses a public.pem from a different keypair", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    const other = generateEd25519Keypair();
    writeFileSync(join(pair.generation_path, "public.pem"), other.public_key_pem);
    const reload = await loadActiveKeyPair(home);
    assert.equal(reload.ok, false);
    assert.equal(typeof reload.error, "string");
  });
});

describe("T3 malformed pointer fails closed", () => {
  it("refuses unparseable pointer JSON", async () => {
    const home = await initedHome();
    writeFileSync(activeKeyPaths(home).activePointer, "{not json");
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "malformed_pointer");
  });
  it("refuses a pointer with wrong schema", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    writePointer(home, { ...p, schema: "bizra.dema.wrong.v9" });
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "malformed_pointer");
  });
});

describe("T4 pointer path escape fails closed", () => {
  it("refuses a generation path outside the keys root", async () => {
    const home = await initedHome();
    const p = readPointer(home);
    const evil = mkdtempSync(join(tmpdir(), "dema-ipc1a-evil-"));
    const src = await loadActiveKeyPair(home);
    // Plant a structurally valid generation outside the home, then point at it.
    for (const f of ["private.pem", "public.pem", "metadata.json"]) {
      writeFileSync(join(evil, f), readFileSync(join(src.generation_path, f)));
    }
    writePointer(home, { ...p, generation_path: evil });
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "pointer_escape");
  });
});

describe("T5 symlinked generation files fail closed", () => {
  it("refuses a symlinked private.pem", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    const priv = join(pair.generation_path, "private.pem");
    const stash = join(home, "stash.pem");
    renameSync(priv, stash);
    symlinkSync(stash, priv);
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
  });
});

describe("T6 retired generation is never served", () => {
  it("refuses when active fingerprint appears in retired-registry", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    writeFileSync(
      activeKeyPaths(home).retiredRegistry,
      JSON.stringify({ retired: [{ fingerprint: pair.fingerprint }] }),
    );
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "retired_generation");
  });
  it("fails closed on an unreadable retired-registry", async () => {
    const home = await initedHome();
    writeFileSync(activeKeyPaths(home).retiredRegistry, "{corrupt");
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "retired_registry_unreadable");
  });
  it("absent registry is safe to serve", async () => {
    const home = await initedHome();
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, true);
  });
});

describe("T7 absent pointer never silently selects legacy files", () => {
  it("fails closed on a legacy-only home", async () => {
    const home = freshHome();
    const legacy = generateEd25519Keypair();
    const lp = keyPaths(home);
    mkdirSync(lp.dir, { recursive: true });
    writeFileSync(lp.privateKey, legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(lp.publicKey, legacy.public_key_pem);
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "no_active_pointer");
  });
});

describe("T8 explicit legacy migration produces one verified generation", () => {
  it("migrates a real legacy pair and then serves it coherently", async () => {
    const home = freshHome();
    const legacy = generateEd25519Keypair();
    const lp = keyPaths(home);
    mkdirSync(lp.dir, { recursive: true });
    writeFileSync(lp.privateKey, legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(lp.publicKey, legacy.public_key_pem);

    const refused = await migrateLegacyAuthorshipKey({ demaHome: home, now: NOW });
    assert.equal(refused.migrated, false);
    assert.equal(refused.error, "consent_required");
    // Zero mutation on refused consent.
    const still = await loadActiveKeyPair(home);
    assert.equal(still.ok, false);

    const done = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE,
      demaHome: home,
      now: NOW,
    });
    assert.equal(done.migrated, true);
    assert.equal(done.fingerprint, legacy.public_key_fingerprint);

    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true);
    assert.equal(pair.fingerprint, legacy.public_key_fingerprint);
    assert.equal(pair.private_key_pem, legacy.private_key_pem);
  });
  it("refuses to migrate a mismatched legacy pair", async () => {
    const home = freshHome();
    const a = generateEd25519Keypair();
    const b = generateEd25519Keypair();
    const lp = keyPaths(home);
    mkdirSync(lp.dir, { recursive: true });
    writeFileSync(lp.privateKey, a.private_key_pem, { mode: 0o600 });
    writeFileSync(lp.publicKey, b.public_key_pem);
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE,
      demaHome: home,
      now: NOW,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "pair_mismatch");
  });
});

describe("T9 readers observe old pair or new pair, never a mixed pair", () => {
  it("each snapshot is self-consistent across a pointer transition", async () => {
    const home = await initedHome();
    const before = await loadActiveKeyPair(home);
    // Drive the pointer-swap primitive directly (rotation does not exist in
    // this slice; init can no longer replace an active generation).
    plantGenerationAndActivate(home);
    const after = await loadActiveKeyPair(home);
    assert.equal(before.ok, true);
    assert.equal(after.ok, true);
    assert.notEqual(before.fingerprint, after.fingerprint);
    for (const snap of [before, after]) {
      const sig = signPayload({ probe: "t9" }, snap.private_key_pem);
      assert.equal(verifyPayload({ probe: "t9" }, sig, snap.public_key_pem), true);
    }
  });
});

describe("T10 crash before pointer rename preserves the old pair", () => {
  it("ignores a stale active-key.json.next", async () => {
    const home = await initedHome();
    const before = await loadActiveKeyPair(home);
    const staged = `${activeKeyPaths(home).activePointer}.next`;
    writeFileSync(staged, JSON.stringify({ schema: ACTIVE_POINTER_SCHEMA, generation_fingerprint: "deadbeef" }));
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, true);
    assert.equal(r.fingerprint, before.fingerprint);
  });
});

describe("T11 crash after pointer rename exposes the new complete pair", () => {
  it("serves the generation the pointer names once renamed", async () => {
    const home = await initedHome();
    const newFp = plantGenerationAndActivate(home);
    const pointer = readPointer(home);
    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true);
    assert.equal(pair.fingerprint, pointer.generation_fingerprint);
    assert.equal(pair.fingerprint, newFp);
  });
});

describe("T12 corrupt generation metadata fails closed", () => {
  it("refuses unparseable metadata.json", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    writeFileSync(join(pair.generation_path, "metadata.json"), "{corrupt");
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "metadata_corrupt");
  });
  it("refuses metadata with wrong schema", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    const metaPath = join(pair.generation_path, "metadata.json");
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    assert.equal(meta.schema, GENERATION_METADATA_SCHEMA);
    writeFileSync(metaPath, JSON.stringify({ ...meta, schema: "nope" }));
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "metadata_corrupt");
  });
});

describe("T13 content-hash mismatch fails closed", () => {
  it("refuses when private.pem bytes differ from bound hash", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    const other = generateEd25519Keypair();
    // Same-format bytes, different content: hash binding must catch it even
    // before pair-consistency does.
    writeFileSync(join(pair.generation_path, "private.pem"), other.private_key_pem);
    const r = await loadActiveKeyPair(home);
    assert.equal(r.ok, false);
    assert.equal(r.error, "content_hash_mismatch");
  });
});

describe("T14+T15 static pair-coherence gate", () => {
  it("passes on the migrated tree and rejects a synthetic violator", async () => {
    const { runIdentityPairCoherenceCheck } = await import(
      "../scripts/review/identity-pair-coherence-check.mjs"
    );
    const clean = await runIdentityPairCoherenceCheck();
    assert.equal(clean.ok, true, JSON.stringify(clean.violations));

    const dir = mkdtempSync(join(tmpdir(), "dema-ipc1a-gate-"));
    const bad = join(dir, "bad-signer.js");
    writeFileSync(
      bad,
      'import { loadPrivateKey, loadPublicKey } from "../authorship-key-store.js";\n' +
        "export async function sign(h){ return [await loadPrivateKey(h), await loadPublicKey(h)]; }\n",
    );
    const dirty = await runIdentityPairCoherenceCheck({ extraFiles: [bad] });
    assert.equal(dirty.ok, false);
    assert.equal(dirty.violations.length, 1);
    assert.equal(dirty.violations[0].kind, "separate_pair_loaders");

    // 4C: the gate must ALSO reject a direct legacy-filename reader, which the
    // loader-name check alone would miss.
    const legacyReader = join(dir, "sneaky-reader.js");
    writeFileSync(
      legacyReader,
      'import { readFileSync } from "node:fs";\n' +
        'export function peek(h){ return readFileSync(h + "/keys/node0-ed25519.pem"); }\n',
    );
    const dirty2 = await runIdentityPairCoherenceCheck({ extraFiles: [legacyReader] });
    assert.equal(dirty2.ok, false);
    assert.equal(dirty2.violations[0].kind, "direct_legacy_key_path");
  });
});

describe("T16 receipt signatures remain verifiable", () => {
  it("legacy-fixture public keys still verify via loadPublicKey fallback", async () => {
    const home = freshHome();
    const legacy = generateEd25519Keypair();
    const lp = keyPaths(home);
    mkdirSync(lp.dir, { recursive: true });
    writeFileSync(lp.privateKey, legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(lp.publicKey, legacy.public_key_pem);
    const sig = signPayload({ probe: "t16" }, legacy.private_key_pem);
    const pub = await loadPublicKey(home);
    assert.equal(verifyPayload({ probe: "t16" }, sig, pub), true);
  });
  it("generation-store public keys verify the pair-loader's signatures", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    const sig = signPayload({ probe: "t16b" }, pair.private_key_pem);
    const pub = await loadPublicKey(home);
    assert.equal(verifyPayload({ probe: "t16b" }, sig, pub), true);
  });
});

describe("CLI: dema authorship key migrate", () => {
  const CLI = new URL("../apps/cli/src/index.js", import.meta.url).pathname;

  function runCli(args, home) {
    const { execFileSync } = childProcess;
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        env: { ...process.env, DEMA_HOME: home },
        encoding: "utf8",
      });
      return { exitCode: 0, stdout };
    } catch (error) {
      return { exitCode: error.status, stdout: error.stdout ?? "" };
    }
  }

  it("refuses without the exact consent phrase (exit 1) and migrates with it (exit 0)", async () => {
    const home = freshHome();
    const legacy = generateEd25519Keypair();
    const lp = keyPaths(home);
    mkdirSync(lp.dir, { recursive: true });
    writeFileSync(lp.privateKey, legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(lp.publicKey, legacy.public_key_pem);

    const refused = runCli(["authorship", "key", "migrate", "--json"], home);
    assert.equal(refused.exitCode, 1);

    const done = runCli(
      ["authorship", "key", "migrate", "--consent", KEY_MIGRATE_CONSENT_PHRASE, "--json"],
      home,
    );
    assert.equal(done.exitCode, 0, done.stdout);
    const doc = JSON.parse(done.stdout);
    assert.equal(doc.migrated, true);
    assert.equal(doc.fingerprint, legacy.public_key_fingerprint);
    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true);
  });
});

describe("F2 init cannot replace an active generation (finding #2)", () => {
  it("force:true with an existing pointer refuses and leaves the pointer unchanged", async () => {
    const home = await initedHome();
    const before = readPointer(home);
    const beforePair = await loadActiveKeyPair(home);

    const r = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
      force: true,
      now: NOW,
    });
    assert.equal(r.initialized, false);
    assert.equal(r.error, "key_already_exists");

    const after = readPointer(home);
    assert.deepEqual(after, before);
    const afterPair = await loadActiveKeyPair(home);
    assert.equal(afterPair.fingerprint, beforePair.fingerprint);
    // No stray second generation was authoritatively activated.
    assert.equal(after.generation_fingerprint, beforePair.fingerprint);
  });
});

describe("F3 presence is not verification (finding #3)", () => {
  it("ABSENT on a fresh home", async () => {
    const r = await inspectActiveIdentity(freshHome());
    assert.equal(r.state, "ABSENT");
    assert.equal(r.verified, false);
  });
  it("VERIFIED only on a real loadActiveKeyPair success", async () => {
    const home = await initedHome();
    const r = await inspectActiveIdentity(home);
    assert.equal(r.state, "VERIFIED");
    assert.equal(r.verified, true);
    assert.match(r.fingerprint, /^[0-9a-f]{64}$/);
  });
  it("BLOCKED_CORRUPT (never VERIFIED) when the generation is corrupt", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    writeFileSync(join(pair.generation_path, "metadata.json"), "{corrupt");
    const r = await inspectActiveIdentity(home);
    assert.equal(r.state, "BLOCKED_CORRUPT");
    assert.equal(r.verified, false);
  });
  it("BLOCKED_RETIRED (never VERIFIED) when the active generation is retired", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    writeFileSync(
      activeKeyPaths(home).retiredRegistry,
      JSON.stringify({ retired: [{ fingerprint: pair.fingerprint }] }),
    );
    const r = await inspectActiveIdentity(home);
    assert.equal(r.state, "BLOCKED_RETIRED");
    assert.equal(r.verified, false);
  });
  it("BLOCKED_POINTER_INVALID (never VERIFIED) on a malformed pointer", async () => {
    const home = await initedHome();
    writeFileSync(activeKeyPaths(home).activePointer, "{not json");
    const r = await inspectActiveIdentity(home);
    assert.equal(r.state, "BLOCKED_POINTER_INVALID");
    assert.equal(r.verified, false);
  });
  it("PRESENT_UNVERIFIED on a legacy-only home (pointer absent, flat files present)", async () => {
    const home = freshHome();
    const legacy = generateEd25519Keypair();
    const lp = keyPaths(home);
    mkdirSync(lp.dir, { recursive: true });
    writeFileSync(lp.privateKey, legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(lp.publicKey, legacy.public_key_pem);
    const r = await inspectActiveIdentity(home);
    assert.equal(r.state, "PRESENT_UNVERIFIED");
    assert.equal(r.verified, false);
  });
});

describe("T17 the real ~/.dema/keys is never touched", () => {
  it("all resolved paths stay inside the passed demaHome", async () => {
    const home = await initedHome();
    const pair = await loadActiveKeyPair(home);
    const ap = activeKeyPaths(home);
    for (const p of [pair.generation_path, ap.activePointer, ap.generationsDir, ap.retiredRegistry]) {
      assert.equal(p.startsWith(home), true, p);
      assert.equal(p.startsWith(join(homedir(), ".dema")), false, p);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY-TRANSITION-ISOLATION-1B — the five PR#412 review findings.
// ═══════════════════════════════════════════════════════════════════════════

function legacyHome(pem) {
  const home = freshHome();
  const lp = keyPaths(home);
  mkdirSync(lp.dir, { recursive: true });
  writeFileSync(lp.privateKey, pem.private_key_pem, { mode: 0o600 });
  writeFileSync(lp.publicKey, pem.public_key_pem);
  return home;
}

function pemPair(type, opts) {
  const { publicKey, privateKey } = generateKeyPairSync(type, opts);
  return {
    private_key_pem: privateKey.export({ type: "pkcs8", format: "pem" }),
    public_key_pem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

describe("R1 exclusive transition ownership (finding P1 concurrency)", () => {
  it("T1 two simultaneous initializers produce exactly one identity", async () => {
    const home = freshHome();
    const [a, b] = await Promise.all([
      initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home, now: NOW }),
      initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home, now: NOW }),
    ]);
    const wins = [a, b].filter((r) => r.initialized === true);
    assert.equal(wins.length, 1, "exactly one initializer may win");
    // T3: the reported success fingerprint IS the one actually active.
    const active = await loadActiveKeyPair(home);
    assert.equal(active.ok, true);
    assert.equal(active.fingerprint, wins[0].public_key_fingerprint);
    // The loser mutated no authority: exactly one generation dir exists.
    const gens = readdirSync(activeKeyPaths(home).generationsDir);
    assert.equal(gens.length, 1);
  });

  it("T2 a caller that cannot acquire the lease performs ZERO mutation", async () => {
    const home = freshHome();
    const ap = activeKeyPaths(home);
    // Pre-hold the lease with THIS (alive) pid — a concurrent init must refuse.
    mkdirSync(ap.transactionsDir, { recursive: true });
    writeFileSync(ap.identityLease, JSON.stringify({ pid: process.pid }));
    const r = await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home, now: NOW });
    assert.equal(r.initialized, false);
    assert.equal(r.error, "identity_transition_in_progress");
    assert.equal(existsSync(ap.activePointer), false, "no pointer written");
    assert.equal(existsSync(ap.generationsDir), false, "no generation written");
  });

  it("T2b a stale lease (dead holder pid) reports recovery_required, not auto-deleted", async () => {
    const home = freshHome();
    const ap = activeKeyPaths(home);
    mkdirSync(ap.transactionsDir, { recursive: true });
    // pid 2147483646 — astronomically unlikely to be alive; process.kill→ESRCH.
    writeFileSync(ap.identityLease, JSON.stringify({ pid: 2147483646 }));
    const r = await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home, now: NOW });
    assert.equal(r.initialized, false);
    assert.equal(r.error, "recovery_required");
    assert.equal(existsSync(ap.identityLease), true, "stale lease preserved for adjudication");
  });

  it("T4 no shared active-key.json.next path is left behind by a normal init", async () => {
    const home = await initedHome();
    assert.equal(existsSync(`${activeKeyPaths(home).activePointer}.next`), false);
  });
});

describe("R2 Ed25519 algorithm enforcement (finding P1 algorithm)", () => {
  for (const [name, mk] of [
    ["T5 RSA", () => pemPair("rsa", { modulusLength: 2048 })],
    ["T6 P-256", () => pemPair("ec", { namedCurve: "prime256v1" })],
    ["T7 X25519", () => pemPair("x25519")],
  ]) {
    it(`${name} legacy pair is rejected before any mutation`, async () => {
      const home = legacyHome(mk());
      const r = await migrateLegacyAuthorshipKey({
        consent: KEY_MIGRATE_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.migrated, false);
      assert.equal(r.error, "unsupported_key_algorithm");
      assert.equal(existsSync(activeKeyPaths(home).activePointer), false);
      assert.equal(existsSync(activeKeyPaths(home).generationsDir), false);
    });
  }

  it("T8 a valid Ed25519 legacy pair migrates", async () => {
    const home = legacyHome(generateEd25519Keypair());
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE,
      demaHome: home,
      now: NOW,
    });
    assert.equal(r.migrated, true);
    assert.equal((await loadActiveKeyPair(home)).ok, true);
  });
});

describe("R3 resumable legacy migration (finding P1 interrupted)", () => {
  it("T9 retry after generation created but before pointer activation resumes", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome(legacy);
    const ap = activeKeyPaths(home);
    const fp = legacy.public_key_fingerprint;
    // Simulate a crash AFTER writeGeneration but BEFORE pointer activation:
    // the generation dir exists and is valid, but no active-key.json.
    const genDir = join(ap.generationsDir, fp);
    mkdirSync(genDir, { recursive: true });
    writeFileSync(join(genDir, "private.pem"), legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(join(genDir, "public.pem"), legacy.public_key_pem);
    writeFileSync(join(genDir, "metadata.json"), JSON.stringify({
      schema: GENERATION_METADATA_SCHEMA, fingerprint: fp, generation_id: fp,
      algorithm: "ed25519", private_content_hash: sha256(legacy.private_key_pem),
      public_content_hash: sha256(legacy.public_key_pem), created_at: NOW, source: "legacy_migration",
    }, null, 2) + "\n");
    assert.equal(existsSync(ap.activePointer), false);

    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, true);
    assert.equal(r.resumed, true);
    assert.equal((await loadActiveKeyPair(home)).fingerprint, fp);
    // T10: no second generation was created.
    assert.equal(readdirSync(ap.generationsDir).length, 1);
  });

  it("T11 an existing generation with CONFLICTING bytes returns recovery_required", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome(legacy);
    const ap = activeKeyPaths(home);
    const fp = legacy.public_key_fingerprint;
    const genDir = join(ap.generationsDir, fp);
    mkdirSync(genDir, { recursive: true });
    // Different private.pem bytes than the legacy pair — a conflict.
    writeFileSync(join(genDir, "private.pem"), generateEd25519Keypair().private_key_pem, { mode: 0o600 });
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "recovery_required");
    assert.equal(existsSync(ap.activePointer), false);
  });
});

describe("R4 PRESENT_UNVERIFIED is preserved (finding P2 status)", () => {
  it("T12+T13 a legacy-only home reports PRESENT_UNVERIFIED and recommends migration", async () => {
    const home = legacyHome(generateEd25519Keypair());
    const r = await inspectActiveIdentity(home);
    assert.equal(r.state, "PRESENT_UNVERIFIED");
    assert.equal(r.recommended_action, "MIGRATE_AUTHORSHIP_KEY");
    // Realm home surfaces it distinctly — NOT collapsed to UNINITIALIZED.
    const { gatherDemaRealmState } = await import("../packages/core/src/dema-realm-home.js");
    const state = await gatherDemaRealmState({ demaHome: home });
    assert.equal(state.identity.status, "PRESENT_UNVERIFIED");
    assert.equal(state.identity.recommended_action, "MIGRATE_AUTHORSHIP_KEY");
    assert.equal(state.seed_awake, false);
  });
  it("a truly empty home is UNINITIALIZED / initialize", async () => {
    const r = await inspectActiveIdentity(freshHome());
    assert.equal(r.state, "ABSENT");
    assert.equal(r.recommended_action, "INITIALIZE_AUTHORSHIP_KEY");
  });
});

describe("R5 authoritative observation (finding P2 unsafe pointer)", () => {
  it("T14 a symlinked active pointer is BLOCKED_POINTER_INVALID, never present", async () => {
    const home = await initedHome();
    const ap = activeKeyPaths(home);
    const real = readFileSync(ap.activePointer, "utf8");
    const stash = join(home, "keys", "pointer-stash.json");
    writeFileSync(stash, real);
    rmSync(ap.activePointer);
    symlinkSync(stash, ap.activePointer);
    const r = await inspectActiveIdentity(home);
    assert.equal(r.verified, false);
    assert.equal(r.state, "BLOCKED_POINTER_INVALID");
  });

  it("T15 observe-gatherer presence agrees with the loader on the safety-critical case", async () => {
    const { gatherNode0ActivationObservations } = await import(
      "../apps/cli/src/commands/observe-gatherer.js"
    );
    const observe = (home) =>
      gatherNode0ActivationObservations({
        env: { DEMA_HOME: home },
        fetchImpl: async () => {
          throw new Error("no net");
        },
      });

    // VERIFIED home → present.
    const verified = await initedHome();
    assert.equal((await observe(verified)).identity.key_file_present, true);

    // Empty home → not present.
    assert.equal((await observe(freshHome())).identity.key_file_present, false);

    // THE BUG: a symlinked active pointer must NOT count as present — the
    // observer (lstat, content-free) now rejects it just as the loader does.
    const escaped = await initedHome();
    const ap = activeKeyPaths(escaped);
    const stash = join(escaped, "keys", "stash.json");
    writeFileSync(stash, readFileSync(ap.activePointer, "utf8"));
    rmSync(ap.activePointer);
    symlinkSync(stash, ap.activePointer);
    const loader = await inspectActiveIdentity(escaped);
    assert.equal(loader.state, "BLOCKED_POINTER_INVALID");
    const obs = await observe(escaped);
    assert.equal(
      obs.identity.key_file_present,
      false,
      "symlinked pointer must not count as present",
    );
  });
});

describe("R6 hygiene", () => {
  it("T16 the flagged unused imports (chmodSync, rmSync) are gone from THIS file's import list", () => {
    const src = readFileSync(new URL(import.meta.url), "utf8");
    const importBlock = src.slice(0, src.indexOf('} from "node:fs";'));
    assert.equal(/\bchmodSync\b/.test(importBlock), false, "chmodSync should not be imported");
    // rmSync IS re-imported and genuinely used (T14) — assert it is actually used.
    assert.ok(src.split("rmSync").length > 2, "rmSync must be used, not just imported");
  });
});

describe("R3b migration transaction ownership + partial resume", () => {
  it("migration blocked by a LIVE lease reports in_progress with zero mutation", async () => {
    const home = legacyHome(generateEd25519Keypair());
    const ap = activeKeyPaths(home);
    mkdirSync(ap.transactionsDir, { recursive: true });
    writeFileSync(ap.identityLease, JSON.stringify({ pid: process.pid }));
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "identity_transition_in_progress");
    assert.equal(existsSync(ap.activePointer), false);
  });

  it("migration resumes from an INCOMPLETE generation (only private.pem written)", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome(legacy);
    const ap = activeKeyPaths(home);
    const genDir = join(ap.generationsDir, legacy.public_key_fingerprint);
    mkdirSync(genDir, { recursive: true });
    // Crash left only the private half — matching bytes, so it's repairable.
    writeFileSync(join(genDir, "private.pem"), legacy.private_key_pem, { mode: 0o600 });
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, true);
    assert.equal(r.resumed, true);
    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true);
    assert.equal(pair.fingerprint, legacy.public_key_fingerprint);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY-POST-MERGE-CONVERGENCE-1C — the two merged edge defects + the
// review-execution-≠-verdict governance proof.
// ═══════════════════════════════════════════════════════════════════════════

function legacyHome1c(pem) {
  const home = freshHome();
  const lp = keyPaths(home);
  mkdirSync(lp.dir, { recursive: true });
  writeFileSync(lp.privateKey, pem.private_key_pem, { mode: 0o600 });
  writeFileSync(lp.publicKey, pem.public_key_pem);
  return home;
}

describe("1C-A generation classification validates content, not presence", () => {
  it("truncated-but-present metadata is NOT classified complete → migration refuses", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome1c(legacy);
    const ap = activeKeyPaths(home);
    const fp = legacy.public_key_fingerprint;
    const genDir = join(ap.generationsDir, fp);
    mkdirSync(genDir, { recursive: true });
    writeFileSync(join(genDir, "private.pem"), legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(join(genDir, "public.pem"), legacy.public_key_pem);
    writeFileSync(join(genDir, "metadata.json"), '{"schema":"trunc');  // present but malformed

    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    // Repairable: canonical metadata regenerated from the still-verified pair,
    // malformed bytes preserved, and the loader ACCEPTS the result.
    assert.equal(r.migrated, true);
    const load = await loadActiveKeyPair(home);
    assert.equal(load.ok, true);
    assert.equal(existsSync(join(genDir, "metadata.json.recovery")), true, "bad bytes preserved");
    // The regenerated metadata is valid.
    const meta = JSON.parse(readFileSync(join(genDir, "metadata.json"), "utf8"));
    assert.equal(meta.fingerprint, fp);
    assert.equal(meta.algorithm, "ed25519");
  });

  it("a generation whose metadata fingerprint is WRONG never migrates to success", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome1c(legacy);
    const ap = activeKeyPaths(home);
    const fp = legacy.public_key_fingerprint;
    const genDir = join(ap.generationsDir, fp);
    mkdirSync(genDir, { recursive: true });
    writeFileSync(join(genDir, "private.pem"), legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(join(genDir, "public.pem"), legacy.public_key_pem);
    // Parseable JSON, valid schema, but WRONG content hashes (not regenerable-safe).
    writeFileSync(join(genDir, "metadata.json"), JSON.stringify({
      schema: GENERATION_METADATA_SCHEMA, fingerprint: fp, generation_id: fp,
      algorithm: "ed25519", private_content_hash: "0".repeat(64),
      public_content_hash: "0".repeat(64), created_at: NOW, source: "x",
    }));
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "recovery_required");
    assert.equal(existsSync(ap.activePointer), false);
  });

  it("valid pre-existing generation is complete_verified and resumes", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome1c(legacy);
    const ap = activeKeyPaths(home);
    const fp = legacy.public_key_fingerprint;
    const genDir = join(ap.generationsDir, fp);
    mkdirSync(genDir, { recursive: true });
    writeFileSync(join(genDir, "private.pem"), legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(join(genDir, "public.pem"), legacy.public_key_pem);
    writeFileSync(join(genDir, "metadata.json"), JSON.stringify({
      schema: GENERATION_METADATA_SCHEMA, fingerprint: fp, generation_id: fp,
      algorithm: "ed25519", private_content_hash: sha256(legacy.private_key_pem),
      public_content_hash: sha256(legacy.public_key_pem), created_at: NOW, source: "legacy_migration",
    }, null, 2) + "\n");
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, true);
    assert.equal(r.resumed, true);
    assert.equal((await loadActiveKeyPair(home)).ok, true);
  });

  it("an IRREGULAR object (directory) at a generation-file path → recovery_required", async () => {
    const legacy = generateEd25519Keypair();
    const home = legacyHome1c(legacy);
    const ap = activeKeyPaths(home);
    const fp = legacy.public_key_fingerprint;
    const genDir = join(ap.generationsDir, fp);
    mkdirSync(genDir, { recursive: true });
    writeFileSync(join(genDir, "private.pem"), legacy.private_key_pem, { mode: 0o600 });
    writeFileSync(join(genDir, "public.pem"), legacy.public_key_pem);
    mkdirSync(join(genDir, "metadata.json"));  // a DIRECTORY where a file belongs
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, false);
    assert.equal(r.error, "recovery_required");
    assert.equal(existsSync(ap.activePointer), false);
  });
});

describe("1C-B authoritative post-transition verification", () => {
  it("a normal migration passes the post-activation loader check", async () => {
    const home = legacyHome1c(generateEd25519Keypair());
    const r = await migrateLegacyAuthorshipKey({
      consent: KEY_MIGRATE_CONSENT_PHRASE, demaHome: home, now: NOW,
    });
    assert.equal(r.migrated, true);
    assert.equal((await loadActiveKeyPair(home)).fingerprint, r.fingerprint);
  });

  it("init passes post-activation verification and reports the active fingerprint", async () => {
    const home = freshHome();
    const r = await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home, now: NOW });
    assert.equal(r.initialized, true);
    assert.equal((await loadActiveKeyPair(home)).fingerprint, r.public_key_fingerprint);
  });
});

describe("1C-C observation requires a REGULAR file", () => {
  const observe = async (home) => {
    const { gatherNode0ActivationObservations } = await import(
      "../apps/cli/src/commands/observe-gatherer.js"
    );
    return gatherNode0ActivationObservations({
      env: { DEMA_HOME: home },
      fetchImpl: async () => { throw new Error("no net"); },
    });
  };

  it("a DIRECTORY at active-key.json reports NOT present", async () => {
    const home = freshHome();
    mkdirSync(join(home, "keys"), { recursive: true });
    mkdirSync(join(home, "keys", "active-key.json"));  // directory, not file
    assert.equal((await observe(home)).identity.key_file_present, false);
  });

  it("a DIRECTORY at the legacy pub-key path reports NOT present", async () => {
    const home = freshHome();
    mkdirSync(join(home, "keys"), { recursive: true });
    mkdirSync(join(home, "keys", "node0-ed25519.pub.pem"));
    assert.equal((await observe(home)).identity.key_file_present, false);
  });

  it("a regular safe pointer reports present", async () => {
    const home = await initedHome();
    assert.equal((await observe(home)).identity.key_file_present, true);
  });
});

describe("1C review admissibility — execution status is not a verdict", () => {
  it("green execution with blocking findings and admissible:false → MERGE_BLOCKED", async () => {
    const { evaluateReviewAdmissibility } = await import(
      "../packages/core/src/review-admissibility.js"
    );
    const d = evaluateReviewAdmissibility({
      review_executed: true,
      blocking_findings: 2,
      highest_severity: "P1",
      admissible: false,
    });
    assert.equal(d.decision, "MERGE_BLOCKED");
    assert.ok(d.reasons.includes("blocking_findings_present"));
    assert.ok(d.reasons.includes("verdict_not_admissible"));
  });

  it("clean review (executed, zero findings, admissible) → MERGE_ALLOWED", async () => {
    const { evaluateReviewAdmissibility } = await import(
      "../packages/core/src/review-admissibility.js"
    );
    const d = evaluateReviewAdmissibility({
      review_executed: true, blocking_findings: 0, highest_severity: null, admissible: true,
    });
    assert.equal(d.decision, "MERGE_ALLOWED");
  });

  it("missing/ill-typed fields fail closed to MERGE_BLOCKED", async () => {
    const { evaluateReviewAdmissibility } = await import(
      "../packages/core/src/review-admissibility.js"
    );
    assert.equal(evaluateReviewAdmissibility({}).decision, "MERGE_BLOCKED");
    assert.equal(evaluateReviewAdmissibility(null).decision, "MERGE_BLOCKED");
    // executed + admissible but findings unknown → still blocked.
    assert.equal(
      evaluateReviewAdmissibility({ review_executed: true, admissible: true }).decision,
      "MERGE_BLOCKED",
    );
  });
});
