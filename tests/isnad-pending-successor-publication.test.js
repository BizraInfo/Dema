// ISNAD G-1 / G-2 — writer/reader regressions.
//
// Disposable demaHome only. The authorship crash fixture kills a child process
// whose keys dir is that home. No production ledger is addressed.
//
// G-1: while a succession is pending, the predecessor may append its permitted
// ordinary receipt and the named successor may append the matching commit.
// An ordinary receipt signed by that successor is refused and the ledger bytes
// stay as they were.
//
// G-2: a plain JSON body still appends and verifies. A Date, an accessor, or
// toJSON is refused with the ledger bytes unchanged. A plain body mutated
// during the publication mkdir is published as the snapshot taken before that
// await, and the reader accepts that same representation.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  loadActiveKeyPair,
  loadPublicKey,
  loadGenerationPublicKey,
  activeKeyPaths,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  appendCanonicalReceipt,
  verifyCanonicalLedger,
  loadCanonicalLedger,
  CANONICAL_LEDGER_RELPATH,
} from "../packages/receipts/src/canonical-ledger.js";
import {
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "../packages/receipts/src/canonical-receipt.js";
import {
  buildSuccessionIntentBody,
  buildSuccessionCommitBody,
} from "../packages/receipts/src/authority-succession.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const KILL_AFTER = join(REPO, "tests/fixtures/kill-after-pointer-commit-preload.mjs");
const STAMP = "2026-08-11T00:00:00.000Z";
const LABEL = VALID_TRUTH_LABELS[0];

const freshHome = () => mkdtempSync(join(tmpdir(), "isnad-repair-"));

function ledgerBytes(home) {
  const path = join(home, CANONICAL_LEDGER_RELPATH);
  return existsSync(path) ? readFileSync(path) : null;
}

function assertLedgerBytesUnchanged(before, home) {
  const after = ledgerBytes(home);
  if (before === null) {
    assert.equal(after, null);
    return;
  }
  assert.ok(after.equals(before));
}

async function seedKey(home) {
  const seeded = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(seeded.initialized, true, seeded.error ?? "");
  return seeded;
}

function crashRotationAfterPointerCommit(home) {
  const ap = activeKeyPaths(home);
  const script = `
    import { rotateAuthorshipKey, KEY_ROTATE_CONSENT_PHRASE }
      from ${JSON.stringify(join(REPO, "packages/receipts/src/authorship-key-store.js"))};
    await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: ${JSON.stringify(home)},
      retiredAt: ${JSON.stringify(STAMP)},
      reason: "compromised_key_rotation",
      envelope: { nonce: "isnad-repair", ceremony_id: "isnad-repair", reason: "probe" },
    });
  `;
  const killed = spawnSync(
    process.execPath,
    ["--import", KILL_AFTER, "--input-type=module", "--eval", script],
    {
      cwd: REPO,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, BIZRA_TEST_CP5_KEYS_DIR: ap.dir },
    },
  );
  assert.equal(killed.signal, "SIGKILL", `rotation did not die after the pointer commit: ${killed.stderr}`);
  return ap;
}

function appendArgs(home, body, now, publicationOps) {
  return {
    canonicalBody: body,
    truthLabel: LABEL,
    whatProves: "this disposable probe exercised the canonical append path",
    whatDoesNotProve: "a production or shared ledger was written",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now,
    ...(publicationOps ? { publicationOps } : {}),
  };
}

async function appendBody(home, body, now, publicationOps) {
  return appendCanonicalReceipt(appendArgs(home, body, now, publicationOps));
}

function publishedLineRecomputes(line) {
  const parsed = JSON.parse(line);
  const { receipt_id, receipt_signature_b64, ...body } = parsed;
  return sha256(stableStringify(body)) === receipt_id
    && sha256(stableStringify(body.canonical_body)) === body.body_hash
    && typeof receipt_signature_b64 === "string"
    && receipt_signature_b64.length > 0;
}

function returnedReceiptRecomputes(receipt) {
  const { receipt_id, receipt_signature_b64, ...body } = receipt;
  return sha256(stableStringify(body)) === receipt_id
    && sha256(stableStringify(body.canonical_body)) === body.body_hash
    && typeof receipt_signature_b64 === "string";
}

async function readerVerdict(home) {
  const entries = await loadCanonicalLedger({ demaHome: home });
  if (entries.length === 0) {
    return verifyCanonicalLedger({ demaHome: home });
  }
  // The anchor is the key that signed entry 0, not whichever key is active now.
  const rootPem = await loadGenerationPublicKey(
    home,
    entries[0].operator_public_key_fingerprint,
  );
  return verifyCanonicalLedger({ demaHome: home, pubkeyPem: rootPem });
}

describe("ISNAD G-1 pending successor", () => {
  it("allows the predecessor's ordinary receipt while the pointer has not moved", async () => {
    const predecessorHome = freshHome();
    const successorHome = freshHome();
    try {
      const predecessor = await seedKey(predecessorHome);
      const successor = await seedKey(successorHome);
      const successorPem = await loadPublicKey(successorHome);
      const intent = await appendBody(predecessorHome, buildSuccessionIntentBody({
        rotationTxId: "isnad-g1-pointer-unmoved",
        predecessorFingerprint: predecessor.public_key_fingerprint,
        successorFingerprint: successor.public_key_fingerprint,
        successorPublicKeyPem: successorPem,
        successorPublicKeySha256: sha256(successorPem),
        consentBindingSha256: sha256("isnad-g1-consent"),
        expectedPointerStateSha256: sha256("isnad-g1-pointer"),
      }), "2026-08-11T00:01:00.000Z");
      assert.equal(intent.appended, true, intent.reason ?? intent.error ?? "");

      const ordinary = await appendBody(
        predecessorHome,
        { probe: "ordinary", marker: "predecessor-while-pending" },
        "2026-08-11T00:02:00.000Z",
      );
      assert.equal(ordinary.appended, true, ordinary.reason ?? ordinary.error ?? "");

      const walk = await readerVerdict(predecessorHome);
      assert.equal(walk.verified, true, walk.reason ?? "");
      assert.equal(walk.successions.length, 0);
      assert.equal(walk.pending_successor.successor_fingerprint, successor.public_key_fingerprint);
      assert.equal(walk.final_authority_fingerprint, predecessor.public_key_fingerprint);
      const active = await loadActiveKeyPair(predecessorHome);
      assert.equal(active.fingerprint, predecessor.public_key_fingerprint);
      assert.equal(returnedReceiptRecomputes(ordinary.receipt), true);
    } finally {
      rmSync(predecessorHome, { recursive: true, force: true });
      rmSync(successorHome, { recursive: true, force: true });
    }
  });

  it("allows the matching successor commit after the pointer selects that successor", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      const paths = crashRotationAfterPointerCommit(home);
      const before = await loadCanonicalLedger({ demaHome: home });
      assert.equal(before.length, 1);
      const intentBody = before[0].canonical_body;
      const commit = await appendBody(home, buildSuccessionCommitBody({
        rotationTxId: intentBody.rotation_tx_id,
        predecessorFingerprint: intentBody.predecessor_fingerprint,
        successorFingerprint: intentBody.successor_fingerprint,
        intentReceiptId: before[0].receipt_id,
        observedPointerStateSha256: sha256(readFileSync(paths.activePointer, "utf8")),
        generationFingerprint: intentBody.successor_fingerprint,
        retirementRelationSha256: sha256(readFileSync(paths.retiredRegistry, "utf8")),
      }), "2026-08-11T00:03:00.000Z");
      assert.equal(commit.appended, true, commit.reason ?? commit.error ?? "");

      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true, walk.reason ?? "");
      assert.equal(walk.pending_successor, null);
      assert.equal(walk.successions.length, 1);
      const active = await loadActiveKeyPair(home);
      assert.equal(walk.final_authority_fingerprint, active.fingerprint);
      assert.equal(returnedReceiptRecomputes(commit.receipt), true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("refuses an ordinary receipt signed by the pending successor and leaves the ledger bytes unchanged", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      crashRotationAfterPointerCommit(home);
      const before = ledgerBytes(home);
      assert.ok(before);
      const refused = await appendBody(
        home,
        { probe: "ordinary", marker: "successor-before-commit" },
        "2026-08-11T00:04:00.000Z",
      );
      assert.equal(refused.appended, false);
      assert.equal(refused.error, "ledger_chain_broken");
      assert.equal(refused.reason, "pending_successor_may_only_commit");
      assertLedgerBytesUnchanged(before, home);

      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true, walk.reason ?? "");
      assert.ok(walk.pending_successor);
      assert.equal((await loadCanonicalLedger({ demaHome: home })).length, 1);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("allows an ordinary receipt after the succession commit has completed", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      const rotated = await rotateAuthorshipKey({
        consent: KEY_ROTATE_CONSENT_PHRASE,
        demaHome: home,
        retiredAt: STAMP,
        reason: "compromised_key_rotation",
        envelope: { nonce: "isnad-repair-done", ceremony_id: "isnad-repair-done", reason: "probe" },
      });
      assert.equal(rotated.rotated, true, rotated.error ?? "");
      const ordinary = await appendBody(
        home,
        { probe: "ordinary", marker: "successor-after-commit" },
        "2026-08-11T00:05:00.000Z",
      );
      assert.equal(ordinary.appended, true, ordinary.reason ?? ordinary.error ?? "");

      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true, walk.reason ?? "");
      assert.equal(walk.pending_successor, null);
      assert.equal(walk.successions.length, 1);
      const active = await loadActiveKeyPair(home);
      assert.equal(walk.final_authority_fingerprint, active.fingerprint);
      assert.equal((await loadCanonicalLedger({ demaHome: home })).length, 3);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("ISNAD G-2 publication snapshot", () => {
  it("appends a plain object, publishes that representation, and the reader accepts it", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      const body = { probe: "positive", n: 1 };
      const written = await appendBody(home, body, "2026-08-11T00:06:00.000Z");
      assert.equal(written.appended, true, written.reason ?? written.error ?? "");
      const line = ledgerBytes(home).toString("utf8").trim().split("\n").at(-1);
      assert.equal(JSON.stringify(written.receipt), line);
      assert.equal(publishedLineRecomputes(line), true);
      assert.equal(returnedReceiptRecomputes(written.receipt), true);
      assert.equal(written.receipt.canonical_body.probe, "positive");
      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true, walk.reason ?? "");
      assert.equal(walk.successions.length, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("refuses a Date body and leaves the ledger bytes unchanged", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      const before = ledgerBytes(home);
      const refused = await appendBody(
        home,
        { probe: "date", when: new Date("2020-01-01T00:00:00.000Z") },
        "2026-08-11T00:07:00.000Z",
      );
      assert.equal(refused.appended, false);
      assert.equal(refused.error, "canonical_body_invalid");
      assertLedgerBytesUnchanged(before, home);
      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true);
      assert.equal(walk.total_entries, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("refuses an accessor without reading it and leaves the ledger bytes unchanged", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      let reads = 0;
      const body = { probe: "getter" };
      Object.defineProperty(body, "n", {
        enumerable: true,
        get() {
          reads += 1;
          return reads;
        },
      });
      const before = ledgerBytes(home);
      const refused = await appendBody(home, body, "2026-08-11T00:08:00.000Z");
      assert.equal(refused.appended, false);
      assert.equal(refused.error, "canonical_body_invalid");
      assert.equal(reads, 0);
      assertLedgerBytesUnchanged(before, home);
      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true);
      assert.equal(walk.total_entries, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("refuses a non-enumerable toJSON without calling it and leaves the ledger bytes unchanged", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      let calls = 0;
      const body = { field: "signed-field" };
      Object.defineProperty(body, "toJSON", {
        enumerable: false,
        value() {
          calls += 1;
          return { swapped: true };
        },
      });
      const before = ledgerBytes(home);
      const refused = await appendBody(home, body, "2026-08-11T00:09:00.000Z");
      assert.equal(refused.appended, false);
      assert.equal(refused.error, "canonical_body_invalid");
      assert.equal(calls, 0);
      assertLedgerBytesUnchanged(before, home);
      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true);
      assert.equal(walk.total_entries, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("publishes the pre-await snapshot when the caller mutates the body during mkdir", async () => {
    const home = freshHome();
    try {
      await seedKey(home);
      const body = { marker: "before-sign" };
      const written = await appendBody(home, body, "2026-08-11T00:10:00.000Z", {
        async mkdir(path, options) {
          body.marker = "mutated-during-mkdir";
          return mkdir(path, options);
        },
        open,
        rename,
        unlink,
      });
      assert.equal(written.appended, true, written.reason ?? written.error ?? "");
      assert.equal(body.marker, "mutated-during-mkdir");
      assert.equal(written.receipt.canonical_body.marker, "before-sign");
      const raw = ledgerBytes(home).toString("utf8");
      const line = raw.trim().split("\n").at(-1);
      assert.equal(raw.includes("mutated-during-mkdir"), false);
      assert.equal(JSON.stringify(written.receipt), line);
      assert.equal(publishedLineRecomputes(line), true);
      assert.equal(returnedReceiptRecomputes(written.receipt), true);
      const walk = await readerVerdict(home);
      assert.equal(walk.verified, true, walk.reason ?? "");
      assert.equal(JSON.parse(line).canonical_body.marker, "before-sign");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
