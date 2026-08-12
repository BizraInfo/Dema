import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, statSync, existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  buildAuthorshipMigrationPreview,
  repositoryIdentityFromBinding,
} from "../packages/genesis/src/genesis-authorship-migration-binding.js";
import {
  keyPaths,
  loadActiveKeyPair,
  KEY_MIGRATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { inspectConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";

/**
 * GENESIS-MIGRATION-CLI-ROUNDTRIP-1A
 *
 * The measured seam: `dema genesis migrate-key preview` printed a presentation
 * wrapper `{ok, preview}` while `execute --preview <f>` consumed the file's
 * root AS the sealed preview, and no CLI surface built the consent envelope at
 * all — so the natural operator flow (capture stdout, hand the file onward)
 * refused `preview_schema_unknown`, and the ceremony required hand-authored
 * JSON. PRODUCED_AUTHORITY_ARTIFACT must equal CONSUMED_AUTHORITY_ARTIFACT.
 *
 * The canonical three-artifact flow proven here, end to end at the REAL
 * binary, with zero manual JSON surgery:
 *
 *   preview --node-id .. --nonce .. --expires-at .. --out preview.json
 *   consent --preview preview.json --consent "<PHRASE>" --out envelope.json
 *   execute --preview preview.json --consent-envelope envelope.json
 *
 * stdout stays presentation; the --out artifact is the inner executable
 * object. Fixture keys, disposable homes; the executing-repository binding
 * from TASK-066 stays load-bearing on every execute path.
 */

const BIN = new URL("../bin/dema", import.meta.url).pathname;
const NODE = "node0-rt-fixture";

let nonceCounter = 0;
const freshNonce = () => `rt-nonce-${++nonceCounter}-${process.pid}`;
const home = () => mkdtempSync(join(tmpdir(), "rt-home-"));
const cleanup = (h) => rmSync(h, { recursive: true, force: true });
const future = () => new Date(Date.now() + 3600_000).toISOString();

function writeLegacyPair(h) {
  const kp = generateEd25519Keypair();
  const p = keyPaths(h);
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(p.privateKey, kp.private_key_pem, { mode: 0o600 });
  writeFileSync(p.publicKey, kp.public_key_pem, { mode: 0o644 });
}

/** Run the real binary. Never throws; returns {code, stdout, stderr}. */
function dema(h, args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      encoding: "utf8", cwd: tmpdir(), env: { ...process.env, DEMA_HOME: h },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return {
      code: e.status ?? 1,
      stdout: String(e.stdout ?? ""),
      stderr: String(e.stderr ?? ""),
    };
  }
}

const previewCmd = (h, out, { nonce = freshNonce(), expiresAt = future() } = {}) =>
  dema(h, ["genesis", "migrate-key", "preview",
    "--node-id", NODE, "--nonce", nonce, "--expires-at", expiresAt,
    ...(out ? ["--out", out] : [])]);
const consentCmd = (h, previewPath, phrase, out) =>
  dema(h, ["genesis", "migrate-key", "consent",
    "--preview", previewPath,
    ...(phrase === undefined ? [] : ["--consent", phrase]),
    ...(out ? ["--out", out] : [])]);
const executeCmd = (h, previewPath, envelopePath) =>
  dema(h, ["genesis", "migrate-key", "execute",
    "--preview", previewPath, "--consent-envelope", envelopePath]);

/** Whole-home byte snapshot, consent ledger included — pre-nonce refusals
 *  may move nothing at all. */
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

const parsedError = (r) => {
  try { return JSON.parse(r.stdout).error; } catch { return undefined; }
};

// ── RT-01 ── the natural flow is one canonical artifact chain
test("RT-01: preview --out → consent → execute migrates with zero JSON surgery", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");

    const pv = previewCmd(h, previewPath);
    assert.equal(pv.code, 0, pv.stderr);
    const wrapper = JSON.parse(pv.stdout);
    assert.equal(wrapper.ok, true, "stdout stays the presentation wrapper");
    const artifact = JSON.parse(readFileSync(previewPath, "utf8"));
    assert.deepEqual(artifact, wrapper.preview,
      "the --out artifact must be exactly the inner sealed preview");
    assert.equal(typeof artifact.preview_hash, "string");

    const c = consentCmd(h, previewPath, KEY_MIGRATE_CONSENT_PHRASE, envelopePath);
    assert.equal(c.code, 0, c.stderr);
    const envelope = JSON.parse(readFileSync(envelopePath, "utf8"));
    assert.equal(envelope.preview_hash, artifact.preview_hash,
      "the envelope binds the exact preview hash");
    assert.equal(envelope.nonce, artifact.nonce);

    const ex = executeCmd(h, previewPath, envelopePath);
    assert.equal(ex.code, 0, ex.stdout || ex.stderr);
    assert.equal(JSON.parse(ex.stdout).migrated, true);
    const active = await loadActiveKeyPair(h);
    assert.equal(active.ok, true, "canonical active loader must accept the result");
    assert.equal(active.fingerprint, artifact.expected_fingerprint,
      "the migrated identity is the exact previewed fingerprint");
  } finally { cleanup(h); }
});

// ── RT-02 ── the presentation wrapper is not the authority artifact
test("RT-02: captured stdout wrapper deterministically refuses where the artifact is required", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    const capturePath = join(h, "captured-stdout.json");
    const envelopePath = join(h, "envelope.json");
    const pv = previewCmd(h, previewPath);
    assert.equal(pv.code, 0);
    writeFileSync(capturePath, pv.stdout); // exactly `preview > captured-stdout.json`

    const c = consentCmd(h, capturePath, KEY_MIGRATE_CONSENT_PHRASE, join(h, "c2.json"));
    assert.notEqual(c.code, 0, "consent must not normalize the wrapper");
    assert.match(c.stderr, /preview_required/);
    assert.equal(existsSync(join(h, "c2.json")), false, "no envelope may be emitted");

    const good = consentCmd(h, previewPath, KEY_MIGRATE_CONSENT_PHRASE, envelopePath);
    assert.equal(good.code, 0);
    const ex = executeCmd(h, capturePath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "preview_schema_unknown",
      "execute must refuse the wrapper deterministically, never unwrap it");
  } finally { cleanup(h); }
});

// ── RT-03 ── no human phrase, no envelope
test("RT-03: consent without an explicit phrase refuses and emits nothing", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    assert.equal(previewCmd(h, previewPath).code, 0);
    const out = join(h, "envelope.json");
    const c = consentCmd(h, previewPath, undefined, out);
    assert.notEqual(c.code, 0);
    assert.match(c.stderr, /consent_required/);
    assert.equal(existsSync(out), false, "no executable consent envelope may exist");
  } finally { cleanup(h); }
});

// ── RT-04 ── a wrong phrase is not consent
test("RT-04: a wrong phrase refuses and emits nothing", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    assert.equal(previewCmd(h, previewPath).code, 0);
    const out = join(h, "envelope.json");
    const c = consentCmd(h, previewPath, "migrate authorship key", out);
    assert.notEqual(c.code, 0);
    assert.match(c.stderr, /consent_required/);
    assert.equal(existsSync(out), false, "no executable consent envelope may exist");
  } finally { cleanup(h); }
});

// ── RT-05 ── consent bound to a different preview
test("RT-05: envelope for preview A refuses against preview B before the nonce claim", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const pathA = join(h, "preview-a.json");
    const pathB = join(h, "preview-b.json");
    const envelopePath = join(h, "envelope-a.json");
    const nonceA = freshNonce();
    const nonceB = freshNonce();
    assert.equal(previewCmd(h, pathA, { nonce: nonceA }).code, 0);
    assert.equal(previewCmd(h, pathB, { nonce: nonceB }).code, 0);
    assert.equal(consentCmd(h, pathA, KEY_MIGRATE_CONSENT_PHRASE, envelopePath).code, 0);

    const before = snapshotHome(h);
    const ex = executeCmd(h, pathB, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "consent_binding_mismatch");
    assert.equal((await inspectConsentNonce({ nonce: nonceA, demaHome: h })).used, false);
    assert.equal((await inspectConsentNonce({ nonce: nonceB, demaHome: h })).used, false,
      "the binding refusal must precede any nonce claim");
    assert.equal((await loadActiveKeyPair(h)).ok, false);
    assert.equal(snapshotHome(h), before, "fixture home must be byte-identical");
  } finally { cleanup(h); }
});

// ── RT-06 ── preview tampered after consent
test("RT-06: a load-bearing field edited after consent refuses before the nonce claim", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    const nonce = freshNonce();
    assert.equal(previewCmd(h, previewPath, { nonce }).code, 0);
    assert.equal(consentCmd(h, previewPath, KEY_MIGRATE_CONSENT_PHRASE, envelopePath).code, 0);

    const tampered = JSON.parse(readFileSync(previewPath, "utf8"));
    tampered.node_id = "node0-somebody-else";
    writeFileSync(previewPath, JSON.stringify(tampered));

    const before = snapshotHome(h);
    const ex = executeCmd(h, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "preview_hash_mismatch",
      "the earliest correct gate is the preview's own re-derived hash");
    assert.equal((await inspectConsentNonce({ nonce, demaHome: h })).used, false);
    assert.equal((await loadActiveKeyPair(h)).ok, false);
    assert.equal(snapshotHome(h), before);
  } finally { cleanup(h); }
});

// ── RT-07 ── expired preview
test("RT-07: an expired preview refuses before governed effect", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    const nonce = freshNonce();
    const expired = new Date(Date.now() - 60_000).toISOString();
    assert.equal(previewCmd(h, previewPath, { nonce, expiresAt: expired }).code, 0,
      "the builder seals what it is told; expiry is enforced at execution");
    assert.equal(consentCmd(h, previewPath, KEY_MIGRATE_CONSENT_PHRASE, envelopePath).code, 0);
    const ex = executeCmd(h, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "preview_expired");
    assert.equal((await inspectConsentNonce({ nonce, demaHome: h })).used, false);
    assert.equal((await loadActiveKeyPair(h)).ok, false);
  } finally { cleanup(h); }
});

// ── RT-08 ── corrupt artifacts refuse deterministically, never crash
test("RT-08: malformed preview or envelope JSON is a deterministic refusal", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const corrupt = join(h, "corrupt.json");
    writeFileSync(corrupt, "{ this is not json");
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    assert.equal(previewCmd(h, previewPath).code, 0);
    assert.equal(consentCmd(h, previewPath, KEY_MIGRATE_CONSENT_PHRASE, envelopePath).code, 0);

    for (const [p, e] of [[corrupt, envelopePath], [previewPath, corrupt]]) {
      const ex = executeCmd(h, p, e);
      assert.equal(ex.code, 1);
      assert.match(ex.stderr, /Refused: --preview and --consent-envelope/);
      assert.doesNotMatch(ex.stderr, /at .*\d+:\d+/, "a refusal is not a stack trace");
    }
    const c = consentCmd(h, corrupt, KEY_MIGRATE_CONSENT_PHRASE, join(h, "c2.json"));
    assert.equal(c.code, 1);
    assert.equal(existsSync(join(h, "c2.json")), false);
  } finally { cleanup(h); }
});

// ── RT-09 ── create-once artifact writes: a pre-existing target refuses untouched
test("RT-09: --out refuses to overwrite and leaves original bytes unchanged", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    const previewPath = join(h, "preview.json");
    const original = '{"pre":"existing"}';
    writeFileSync(previewPath, original);
    const pv = previewCmd(h, previewPath);
    assert.notEqual(pv.code, 0, "the write must be create-once, never replace");
    assert.match(pv.stderr, /artifact_exists/);
    assert.equal(readFileSync(previewPath, "utf8"), original);

    const goodPreview = join(h, "preview2.json");
    assert.equal(previewCmd(h, goodPreview).code, 0);
    const envelopePath = join(h, "envelope.json");
    writeFileSync(envelopePath, original);
    const c = consentCmd(h, goodPreview, KEY_MIGRATE_CONSENT_PHRASE, envelopePath);
    assert.notEqual(c.code, 0);
    assert.match(c.stderr, /artifact_exists/);
    assert.equal(readFileSync(envelopePath, "utf8"), original);
  } finally { cleanup(h); }
});

// ── RT-10 ── the documented ceremony is the executed ceremony
test("RT-10: TESTING.md documents exactly the command forms RT-01 executes", () => {
  const doc = readFileSync(new URL("../docs/TESTING.md", import.meta.url), "utf8");
  for (const form of [
    "genesis migrate-key preview --node-id <id> --nonce <n> --expires-at <iso> --out <preview.json>",
    "genesis migrate-key consent --preview <preview.json> --consent \"<PHRASE>\" --out <envelope.json>",
    "genesis migrate-key execute --preview <preview.json> --consent-envelope <envelope.json>",
  ]) {
    assert.ok(doc.includes(form),
      `documentation must carry the executable ceremony form: ${form}`);
  }
});

// ── RT-11 ── TASK-066 stays load-bearing through the round-trip surface
test("RT-11: a repository mismatch still wins before migration on the canonical flow", async () => {
  const h = home();
  try {
    writeLegacyPair(h);
    // A hash-coherent preview sealed to a repository this checkout is not:
    // built via the kernel (the CLI would seal the measured truth), then fed
    // through the REAL consent + execute surfaces.
    const forged = await buildAuthorshipMigrationPreview({
      demaHome: h,
      nodeId: NODE,
      nonce: freshNonce(),
      expiresAt: future(),
      repository: repositoryIdentityFromBinding({
        commit: "a".repeat(40), tree: "c".repeat(40),
      }),
      now: new Date().toISOString(),
    });
    assert.equal(forged.ok, true);
    const previewPath = join(h, "preview.json");
    const envelopePath = join(h, "envelope.json");
    writeFileSync(previewPath, JSON.stringify(forged.preview));
    assert.equal(consentCmd(h, previewPath, KEY_MIGRATE_CONSENT_PHRASE, envelopePath).code, 0);

    const before = snapshotHome(h);
    const ex = executeCmd(h, previewPath, envelopePath);
    assert.notEqual(ex.code, 0);
    assert.equal(parsedError(ex), "repository_binding_mismatch",
      "the independently observed repository outranks every artifact");
    assert.equal((await inspectConsentNonce({ nonce: forged.preview.nonce, demaHome: h })).used, false);
    assert.equal((await loadActiveKeyPair(h)).ok, false);
    assert.equal(snapshotHome(h), before);
  } finally { cleanup(h); }
});
