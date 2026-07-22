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
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import childProcess from "node:child_process";
import {
  initAuthorshipKey,
  loadActiveKeyPair,
  migrateLegacyAuthorshipKey,
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
} from "../packages/receipts/src/authorship-signature.js";

const NOW = "2026-07-22T20:00:00.000Z";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-ipc1a-"));
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
    // Second generation arrives via explicit re-init (force) — rotation does
    // not exist in this slice; the transition primitive is the pointer swap.
    const r2 = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
      force: true,
      now: NOW,
    });
    assert.equal(r2.initialized, true);
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
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
      force: true,
      now: NOW,
    });
    const pointer = readPointer(home);
    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true);
    assert.equal(pair.fingerprint, pointer.generation_fingerprint);
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
