import test from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const sha256Hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");

import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  verifyExecuteReceipt,
  recomputeReceiptContentHash,
  recomputeReceiptStateHash,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA,
} from "../packages/core/src/node0-reversible-execute-gate.js";

// NODE0-REVERSIBLE-EXECUTE-GATE-1A — the hinge: the FIRST real, reversible,
// sandbox-contained filesystem mutation in this repo. Everything is fail-closed,
// consent-gated by exact phrase, confined to a sandbox root, and proven reversible.
// Tests run against REAL fs in a temp sandbox so before/after hashes are MEASURED.

const NOW = "2026-06-28T18:00:00.000Z";
const PROBE = "node0-loop-probe.txt";

function freshSandbox() {
  const root = mkdtempSync(join(tmpdir(), "node0-exec-gate-"));
  writeFileSync(join(root, PROBE), "loop probe payload\n");
  return root;
}

// ── consent gate (DoD #3) ───────────────────────────────────────────────────
test("plan refuses without the exact GO phrase (byte-match, fail-closed)", () => {
  const p = planReversibleRename({
    sandboxRoot: "/sbx",
    fileName: PROBE,
    newName: "renamed.txt",
    goPhrase: "go: execute governed reversible rename in sandbox", // wrong case
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  });
  assert.equal(p.eligible, false);
  assert.ok(p.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with the exact GO phrase + supported action", () => {
  const p = planReversibleRename({
    sandboxRoot: "/sbx",
    fileName: PROBE,
    newName: "renamed.txt",
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  });
  assert.equal(p.eligible, true);
  assert.deepEqual(p.blocked_by, []);
});

// ── sandbox containment (DoD #8) ────────────────────────────────────────────
test("plan blocks path traversal / non-basename names (no escape)", () => {
  for (const bad of ["../evil", "a/b", "..", ".", "/etc/passwd", "x\\y"]) {
    const p = planReversibleRename({
      sandboxRoot: "/sbx",
      fileName: bad,
      newName: "ok.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    assert.equal(p.eligible, false, `should block source name ${bad}`);
    assert.ok(p.blocked_by.includes("unsafe_source_name"));
  }
});

test("plan blocks an unsupported action type (only the reversible rename is allowed)", () => {
  const p = planReversibleRename({
    sandboxRoot: "/sbx",
    fileName: PROBE,
    newName: "ok.txt",
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
    actionType: "delete_file",
  });
  assert.equal(p.eligible, false);
  assert.ok(p.blocked_by.includes("unsupported_action_type"));
});

// ── real execution (DoD #1,#2,#4,#5,#7) ─────────────────────────────────────
test("execute renames the real file, measures real before/after hashes, writes backup + sealed receipt", () => {
  const root = freshSandbox();
  try {
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });

    // real rename happened on disk
    assert.equal(existsSync(join(root, PROBE)), false);
    assert.equal(existsSync(join(root, "renamed.txt")), true);

    // hashes are real + content preserved by a rename
    assert.match(receipt.before_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(receipt.before_hash, receipt.after_hash);
    assert.equal(receipt.schema, NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA);

    // backup written before the action, recoverable
    assert.ok(receipt.backup && existsSync(receipt.backup.path));
    assert.equal(receipt.backup.hash, receipt.before_hash);

    // receipt sealed + appended to an on-disk append-only log
    assert.ok(receipt.executed);
    assert.ok(receipt.consent.go_phrase_hash);
    assert.equal(receipt.executed_at, NOW);
    assert.ok(existsSync(receipt.receipt_log_path));
    assert.match(receipt.content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(receipt.state_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(receipt.state_hash, recomputeReceiptStateHash(receipt));
    assert.equal(verifyExecuteReceipt(receipt, { fs: nodeFs }).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("execute on a blocked plan performs NO filesystem mutation (fail-closed)", () => {
  const root = freshSandbox();
  try {
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: "wrong phrase",
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    assert.equal(receipt.executed, false);
    // original untouched
    assert.equal(existsSync(join(root, PROBE)), true);
    assert.equal(existsSync(join(root, "renamed.txt")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("execute refuses to overwrite an existing target (no clobber)", () => {
  const root = freshSandbox();
  try {
    writeFileSync(join(root, "taken.txt"), "already here\n");
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "taken.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    assert.equal(receipt.executed, false);
    assert.ok(receipt.blocked_by.includes("target_exists"));
    assert.equal(readFileSync(join(root, "taken.txt"), "utf8"), "already here\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── proven reversibility (DoD #6) ───────────────────────────────────────────
test("undo restores the original file name AND the original hash — reversibility is proven, not claimed", () => {
  const root = freshSandbox();
  try {
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    const undo = undoReversibleRename({ receipt, fs: nodeFs });

    assert.equal(undo.undone, true);
    assert.equal(undo.proven, true);
    assert.equal(undo.restored_hash, receipt.before_hash);
    assert.equal(existsSync(join(root, PROBE)), true);
    assert.equal(existsSync(join(root, "renamed.txt")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── boundary + verify (DoD #8, integrity) ───────────────────────────────────
test("receipt boundary asserts sandbox-only, no delete, no network, traversal blocked", () => {
  const root = freshSandbox();
  try {
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    assert.equal(receipt.boundary.sandbox_only, true);
    assert.equal(receipt.boundary.delete_performed, false);
    assert.equal(receipt.boundary.network_used, false);
    assert.equal(receipt.boundary.secrets_accessed, false);
    assert.equal(receipt.boundary.path_traversal_blocked, true);
    assert.equal(receipt.boundary.reversible, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("verifyExecuteReceipt accepts an honest receipt and rejects a tampered one", () => {
  const root = freshSandbox();
  try {
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    assert.equal(verifyExecuteReceipt(receipt).ok, true);

    const forged = JSON.parse(JSON.stringify(receipt));
    forged.after_hash = "sha256:" + "0".repeat(64);
    assert.equal(verifyExecuteReceipt(forged).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── ADVERSARIAL REGRESSIONS (from red-team wf_0d53ffcc-758) ──────────────────
// Inode-based containment: a basename can be a SYMLINK to an external target.
// Lexical/string containment let a symlinked source read an out-of-sandbox file
// and a symlinked .node0-backups write outside the sandbox. Must fail closed.

test("ADVERSARIAL: a symlinked source pointing OUTSIDE the sandbox is blocked (no read/exfil escape)", () => {
  const root = mkdtempSync(join(tmpdir(), "node0-exec-sym-"));
  const outside = mkdtempSync(join(tmpdir(), "node0-exec-out-"));
  try {
    const secret = join(outside, "secret.txt");
    writeFileSync(secret, "TOP-SECRET-PRIVATE-KEY\n");
    symlinkSync(secret, join(root, "link.txt")); // guard-passing basename, symlink target outside
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: "link.txt",
      newName: "stolen.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    assert.equal(receipt.executed, false, "must not execute on a symlinked source");
    assert.ok(receipt.blocked_by.some((r) => r.includes("symlink")));
    // the external secret must NOT have been copied anywhere into the sandbox
    const backupDir = join(root, ".node0-backups");
    const leaked = existsSync(backupDir) ? readdirSync(backupDir) : [];
    assert.equal(leaked.length, 0, "no backup of the external secret may exist");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("ADVERSARIAL: a symlinked .node0-backups dir is blocked (no out-of-sandbox backup write)", () => {
  const root = mkdtempSync(join(tmpdir(), "node0-exec-symb-"));
  const outside = mkdtempSync(join(tmpdir(), "node0-exec-outb-"));
  try {
    writeFileSync(join(root, PROBE), "loop probe payload\n");
    symlinkSync(outside, join(root, ".node0-backups")); // backup dir is a symlink to outside
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    assert.equal(receipt.executed, false, "must not execute through a symlinked backup dir");
    assert.equal(readdirSync(outside).length, 0, "nothing may be written outside the sandbox");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("ADVERSARIAL: a re-hashed fully-fabricated receipt is rejected by fs-aware verify (not in sealed log)", () => {
  const root = mkdtempSync(join(tmpdir(), "node0-exec-forge-"));
  try {
    writeFileSync(join(root, PROBE), "loop probe payload\n");
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const real = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    // honest receipt passes fs-aware verify (it IS in the sealed log)
    assert.equal(verifyExecuteReceipt(real, { fs: nodeFs }).ok, true);

    // forge: change from/to, then RECOMPUTE the content hash so integrity passes
    const forged = JSON.parse(JSON.stringify(real));
    delete forged.receipt_log_path;
    forged.from = "id_ed25519";
    forged.to = "exfiltrated.txt";
    forged.content_hash = recomputeReceiptContentHash(forged);
    // integrity-only verify can't catch this; fs-aware verify must (hash not in log)
    assert.equal(verifyExecuteReceipt(forged, { fs: nodeFs }).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ADVERSARIAL: verify rejects a forged consent hash even when re-hashed", () => {
  const root = mkdtempSync(join(tmpdir(), "node0-exec-cons-"));
  try {
    writeFileSync(join(root, PROBE), "loop probe payload\n");
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const real = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    const forged = JSON.parse(JSON.stringify(real));
    delete forged.receipt_log_path;
    forged.consent = { go_phrase_hash: "sha256:" + "f".repeat(64), mode: "forged" };
    forged.content_hash = recomputeReceiptContentHash(forged);
    assert.equal(verifyExecuteReceipt(forged).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ADVERSARIAL: undo binds to the on-disk backup, so a forged before_hash cannot fake proven", () => {
  const root = mkdtempSync(join(tmpdir(), "node0-exec-undo-"));
  try {
    writeFileSync(join(root, PROBE), "loop probe payload\n");
    const plan = planReversibleRename({
      sandboxRoot: root,
      fileName: PROBE,
      newName: "renamed.txt",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const real = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
    // attacker tampers the renamed file AND forges before/after to match, re-sealing
    writeFileSync(join(root, "renamed.txt"), "ATTACKER-CHOSEN\n");
    const tamperedHash = "sha256:" + sha256Hex("ATTACKER-CHOSEN\n");
    const forged = JSON.parse(JSON.stringify(real));
    delete forged.receipt_log_path;
    forged.before_hash = tamperedHash;
    forged.after_hash = tamperedHash;
    forged.content_hash = recomputeReceiptContentHash(forged);
    const undo = undoReversibleRename({ receipt: forged, fs: nodeFs });
    assert.equal(undo.proven, false, "undo must not attest restoration of attacker content");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
