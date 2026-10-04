// CP5-01…07 — AUTHORSHIP-ROTATION-RESUME-1A.
//
// CP5 is the blocking defect the P0.2b crash matrix (2026-07-29) recorded and
// docs/gtm/TASK029_PRE_CEREMONY_HALT.md holds the TASK-029 ceremony behind: a
// crash after `appendRetiredRegistry` and before the active pointer commits
// leaves the old fingerprint retired while the pointer still names it, so the
// home has no usable active key.
//
// The pre-fix behaviour is FAIL-CLOSED, not unsafe: `loadActiveKeyPair` returns
// `retired_generation` and `loadGuardedActiveKey` blocks `rotation_in_progress`,
// so nothing ever signs with a retired key. CP5 is a LIVENESS defect — the home
// cannot move forward or back. These tests pin both halves: the refusal stays,
// and an explicitly consented resume rolls the interrupted rotation FORWARD onto
// the generation whose bytes were already archived and byte-verified before the
// retirement was written.
//
// The crash is real: a child process takes a genuine SIGKILL at the pointer
// rename (tests/fixtures/kill-before-pointer-commit-preload.mjs). Production
// carries no fault-injection branch.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  initAuthorshipKey,
  loadActiveKeyPair,
  loadGuardedActiveKey,
  activeKeyPaths,
  resumeAuthorshipRotation,
  inspectIdentityRecovery,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
  KEY_ROTATE_RESUME_CONSENT_PHRASE,
  KEY_ROTATE_RESUME_SCHEMA,
} from "../packages/receipts/src/authorship-key-store.js";
import { keypairMatches } from "../packages/receipts/src/authorship-signature.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRELOAD = join(REPO, "tests/fixtures/kill-before-pointer-commit-preload.mjs");
const STAMP = "2026-08-02T00:00:00.000Z";

const freshHome = () => mkdtempSync(join(tmpdir(), "dema-cp5-"));

async function seedKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
  return r.public_key_fingerprint;
}

// Drive a real rotation in a child that dies at the CP5 boundary.
function crashRotationAtPointerCommit(home) {
  const ap = activeKeyPaths(home);
  const script = `
    import { rotateAuthorshipKey, KEY_ROTATE_CONSENT_PHRASE }
      from ${JSON.stringify(join(REPO, "packages/receipts/src/authorship-key-store.js"))};
    await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: ${JSON.stringify(home)},
      retiredAt: ${JSON.stringify(STAMP)},
      reason: "compromised_key_rotation",
      envelope: { nonce: "cp5-nonce", ceremony_id: "cp5-cer", reason: "cp5" },
    });
  `;
  const killed = spawnSync(
    process.execPath,
    ["--import", PRELOAD, "--input-type=module", "--eval", script],
    {
      cwd: REPO,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, BIZRA_TEST_CP5_KEYS_DIR: ap.dir },
    },
  );
  assert.equal(
    killed.signal,
    "SIGKILL",
    `rotation did not die at the pointer boundary: ${killed.stderr}`,
  );
  return ap;
}

describe("CP5 · interrupted authorship rotation", () => {
  it("CP5-01: the crash leaves the old fingerprint retired with the pointer not advanced", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const ap = crashRotationAtPointerCommit(home);

    const registry = JSON.parse(readFileSync(ap.retiredRegistry, "utf8"));
    assert.equal(
      registry.retired.some((entry) => entry.fingerprint === oldFp),
      true,
      "old fingerprint is retired",
    );

    const pointer = JSON.parse(readFileSync(ap.activePointer, "utf8"));
    assert.equal(pointer.generation_fingerprint, oldFp, "pointer never advanced");

    const journal = JSON.parse(readFileSync(join(ap.dir, "rotation-journal.json"), "utf8"));
    assert.equal(journal.state, "ACTIVATING");
  });

  it("CP5-02: the interrupted home refuses to sign — fail-closed, never a retired key", async () => {
    const home = freshHome();
    await seedKey(home);
    crashRotationAtPointerCommit(home);

    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, false);
    assert.equal(pair.error, "retired_generation");

    const guarded = await loadGuardedActiveKey(home);
    assert.equal(guarded.blocked, true);
    assert.equal(guarded.reason, "rotation_in_progress");
  });

  it("CP5-03: read-only inspection REPORTS the interrupted rotation and mutates nothing", async () => {
    const home = freshHome();
    await seedKey(home);
    const ap = crashRotationAtPointerCommit(home);
    const before = readFileSync(ap.activePointer, "utf8");

    const report = await inspectIdentityRecovery(home);
    assert.equal(report.rotation_resume_state, "RESUMABLE_FORWARD");
    assert.equal(report.rotation_journal_state, "ACTIVATING");

    assert.equal(readFileSync(ap.activePointer, "utf8"), before, "inspection never mutates");
  });

  it("CP5-04: resume without the exact consent phrase writes nothing", async () => {
    const home = freshHome();
    await seedKey(home);
    const ap = crashRotationAtPointerCommit(home);
    const before = readFileSync(ap.activePointer, "utf8");

    const refused = await resumeAuthorshipRotation({ consent: "please fix it", demaHome: home });
    assert.equal(refused.resumed, false);
    assert.equal(refused.error, "consent_required");
    assert.equal(refused.required_phrase, KEY_ROTATE_RESUME_CONSENT_PHRASE);
    assert.equal(readFileSync(ap.activePointer, "utf8"), before);
  });

  it("CP5-05: consented resume rolls forward to a usable, byte-matched active key", async () => {
    const home = freshHome();
    const oldFp = await seedKey(home);
    const ap = crashRotationAtPointerCommit(home);
    const journal = JSON.parse(readFileSync(join(ap.dir, "rotation-journal.json"), "utf8"));

    const resumed = await resumeAuthorshipRotation({
      consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
      demaHome: home,
      resumedAt: STAMP,
    });
    assert.equal(resumed.resumed, true, resumed.error);
    assert.equal(resumed.schema, KEY_ROTATE_RESUME_SCHEMA);
    assert.equal(resumed.active_fingerprint, journal.new_fingerprint);
    assert.equal(resumed.retired_fingerprint, oldFp);

    const pair = await loadActiveKeyPair(home);
    assert.equal(pair.ok, true, pair.error);
    assert.equal(pair.fingerprint, journal.new_fingerprint);
    assert.equal(keypairMatches(pair.private_key_pem, pair.public_key_pem), true);

    const guarded = await loadGuardedActiveKey(home);
    assert.equal(guarded.blocked, false);
    assert.equal(guarded.fingerprint, journal.new_fingerprint);
  });

  it("CP5-06: an exact re-run of resume is idempotent and changes no durable byte", async () => {
    const home = freshHome();
    await seedKey(home);
    const ap = crashRotationAtPointerCommit(home);
    await resumeAuthorshipRotation({
      consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
      demaHome: home,
      resumedAt: STAMP,
    });
    const snapshot = () => ({
      pointer: readFileSync(ap.activePointer, "utf8"),
      registry: readFileSync(ap.retiredRegistry, "utf8"),
      journal: readFileSync(join(ap.dir, "rotation-journal.json"), "utf8"),
    });
    const after = snapshot();

    const again = await resumeAuthorshipRotation({
      consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
      demaHome: home,
      resumedAt: STAMP,
    });
    assert.equal(again.resumed, true);
    assert.equal(again.already_resolved, true);
    assert.deepEqual(snapshot(), after, "an exact retry preserves every durable byte");
  });

  it("CP5-07: resume refuses when the archived generation does not match the journal", async () => {
    const home = freshHome();
    await seedKey(home);
    const ap = crashRotationAtPointerCommit(home);
    const journal = JSON.parse(readFileSync(join(ap.dir, "rotation-journal.json"), "utf8"));
    const genDir = join(ap.generationsDir, journal.new_fingerprint);
    const before = readFileSync(ap.activePointer, "utf8");

    // Corrupt the archived public key so it no longer matches its fingerprint.
    writeFileSync(join(genDir, "public.pem"), "-----BEGIN PUBLIC KEY-----\nnope\n-----END PUBLIC KEY-----\n");

    const refused = await resumeAuthorshipRotation({
      consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
      demaHome: home,
      resumedAt: STAMP,
    });
    assert.equal(refused.resumed, false);
    assert.equal(refused.error, "generation_unverifiable");
    assert.equal(readFileSync(ap.activePointer, "utf8"), before, "a refused resume writes nothing");
    assert.equal(existsSync(join(ap.dir, "rotation-journal.json")), true);
  });
});
