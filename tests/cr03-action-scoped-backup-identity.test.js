// CR-03-EXACT-EFFECT-UNDO-1A — CR03-01…CR03-09.
//
// THE MEASURED BLOCKER. Mission-001 Run-1 Attempt-1 could not satisfy §5.9
// ("for Mission 001, undo MUST be executable and tested") because the gate derives
// its backup path from `<from>.<content-hash-12>.bak` and writes it with flag "wx".
// Undo restores the file but never removes the backup, so a re-apply computes the
// SAME path, hits EEXIST, and refuses `backup_write_failed`. Execute → undo →
// re-execute is structurally impossible, which made "tested" and "landed" mutually
// exclusive on one atom.
//
// THE FIX IS IDENTITY, NOT EXCLUSIVITY. `wx` is doing real security work: it is
// what guarantees a backup is never silently clobbered. The collision is telling us
// the identity model is too weak — the same bytes in the same file are treated as
// the same backup regardless of which authorized action produced them. So the
// backup identity becomes action-scoped and phase-scoped and `wx` stays.
//
// UNDO != HISTORY REWRITE. Restoring the governed target state must not erase the
// evidence that the action and the rollback happened. CR03-06 pins that: after a
// proven undo the backup and the receipt log are still on disk. A rollback that
// deleted its own receipts to make the filesystem byte-identical would destroy the
// very proof that the rollback occurred.
//
// ADDITIVE BY OMISSION. With no actionId the path shape is unchanged, so every
// receipt already sealed in the estate still verifies (CR03-08).
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";

const NOW = "2026-08-13T16:00:00Z";
const BODY = "the governed target state\n";
const sha = (b) => createHash("sha256").update(b).digest("hex");

const roots = [];
function sandbox(name = "a.json", body = BODY) {
  const root = mkdtempSync(join(tmpdir(), "cr03-"));
  roots.push(root);
  writeFileSync(join(root, name), body);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const plan = (root, over = {}) =>
  planReversibleRename({
    sandboxRoot: root,
    fileName: over.from ?? "a.json",
    newName: over.to ?? "a-2026-08-12.json",
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    actionId: over.actionId,
    phase: over.phase,
  });

const apply = (root, over = {}) =>
  executeReversibleRename({ plan: plan(root, over), fs, now: NOW });

// ── CR03-01 · the same bytes under a different authorized action must not collide ─
test("CR03-01: identical content under two different action ids does not collide", () => {
  const root = sandbox();
  const first = apply(root, { actionId: "act-alpha", phase: "provisional" });
  assert.equal(first.executed, true, `first apply blocked: ${first.blocked_by}`);
  const undone = undoReversibleRename({ receipt: first, fs, actionId: "act-alpha" });
  assert.equal(undone.proven, true, `undo not proven: ${undone.reason}`);

  // Same file, same bytes — under the OLD identity this is where Attempt-1 died.
  const second = apply(root, { actionId: "act-beta", phase: "provisional" });
  assert.equal(
    second.executed,
    true,
    `a second authorized action was refused: ${second.blocked_by}`,
  );
  assert.notEqual(first.backup.path, second.backup.path);
});

// ── CR03-02 · phases within one action are distinct backups ─────────────────
test("CR03-02: provisional and final phases of one action do not collide", () => {
  const root = sandbox();
  const prov = apply(root, { actionId: "act-capsule", phase: "provisional" });
  assert.equal(prov.executed, true, `provisional blocked: ${prov.blocked_by}`);
  assert.equal(undoReversibleRename({ receipt: prov, fs, actionId: "act-capsule" }).proven, true);
  const final = apply(root, { actionId: "act-capsule", phase: "final" });
  assert.equal(final.executed, true, `final blocked: ${final.blocked_by}`);
  assert.notEqual(prov.backup.path, final.backup.path);
});

// ── CR03-03 · exclusivity is PRESERVED, not traded away ─────────────────────
test("CR03-03: replaying the same action and phase still fails closed", () => {
  const root = sandbox();
  const first = apply(root, { actionId: "act-replay", phase: "provisional" });
  assert.equal(first.executed, true);
  assert.equal(undoReversibleRename({ receipt: first, fs, actionId: "act-replay" }).proven, true);
  const replay = apply(root, { actionId: "act-replay", phase: "provisional" });
  assert.equal(replay.executed, false, "wx exclusivity was weakened");
  assert.ok(replay.blocked_by.includes("backup_write_failed"));
});

// ── CR03-04 · undo must name the exact action it reverses ───────────────────
test("CR03-04: undo with the wrong action id refuses", () => {
  const root = sandbox();
  const r = apply(root, { actionId: "act-real", phase: "provisional" });
  assert.equal(r.executed, true);
  const wrong = undoReversibleRename({ receipt: r, fs, actionId: "act-impostor" });
  assert.equal(wrong.undone, false);
  assert.equal(wrong.proven, false);
  assert.equal(wrong.reason, "undo_action_mismatch");
  // and the effect is untouched by the refused undo
  assert.ok(existsSync(join(root, "a-2026-08-12.json")));
});

// ── CR03-05 · undo restores the governed state exactly ──────────────────────
test("CR03-05: undo restores original path and original bytes", () => {
  const root = sandbox();
  const before = sha(readFileSync(join(root, "a.json")));
  const r = apply(root, { actionId: "act-restore", phase: "provisional" });
  const u = undoReversibleRename({ receipt: r, fs, actionId: "act-restore" });
  assert.equal(u.proven, true);
  assert.ok(existsSync(join(root, "a.json")), "original path not restored");
  assert.ok(!existsSync(join(root, "a-2026-08-12.json")), "effected path still present");
  assert.equal(sha(readFileSync(join(root, "a.json"))), before);
});

// ── CR03-06 · UNDO != HISTORY REWRITE ───────────────────────────────────────
test("CR03-06: a proven undo preserves the backup and the receipt log", () => {
  const root = sandbox();
  const r = apply(root, { actionId: "act-audit", phase: "provisional" });
  assert.equal(undoReversibleRename({ receipt: r, fs, actionId: "act-audit" }).proven, true);
  assert.ok(
    existsSync(r.backup.path),
    "the backup was deleted — a rollback that erases its own evidence cannot be proven",
  );
  assert.ok(existsSync(join(root, ".node0-receipts.ndjson")), "receipt log erased by undo");
  const log = readFileSync(join(root, ".node0-receipts.ndjson"), "utf8").trim().split("\n");
  assert.ok(log.length >= 1, "the executed action left no durable record");
});

// ── CR03-07 · the capsule §5.9 requires becomes possible ────────────────────
test("CR03-07: apply → verify → undo → verify restored → final apply → verify", () => {
  const root = sandbox();
  const genesis = sha(readFileSync(join(root, "a.json")));

  const prov = apply(root, { actionId: "act-m001-2", phase: "provisional" });
  assert.equal(prov.executed, true);
  assert.equal(sha(readFileSync(join(root, "a-2026-08-12.json"))), genesis, "content changed");

  const u = undoReversibleRename({ receipt: prov, fs, actionId: "act-m001-2" });
  assert.equal(u.proven, true, "the effect's OWN undo was not proven");
  assert.equal(sha(readFileSync(join(root, "a.json"))), genesis, "restoration diverged");

  const final = apply(root, { actionId: "act-m001-2", phase: "final" });
  assert.equal(final.executed, true, `final apply blocked: ${final.blocked_by}`);
  assert.equal(sha(readFileSync(join(root, "a-2026-08-12.json"))), genesis);
  assert.ok(!existsSync(join(root, "a.json")));
  // Both phases remain as evidence.
  assert.ok(existsSync(prov.backup.path) && existsSync(final.backup.path));
});

// ── CR03-08 · ADDITIVE BY OMISSION — legacy identity unchanged ──────────────
test("CR03-08: with no action id the backup path shape is unchanged", () => {
  const root = sandbox();
  const r = apply(root);
  assert.equal(r.executed, true);
  const rel = r.backup.path.slice(root.length + 1);
  assert.match(
    rel,
    /^\.node0-backups\/a\.json\.[0-9a-f]{12}\.bak$/,
    `legacy backup path shape moved: ${rel}`,
  );
});

// ── CR03-09 · the historical collision, reproduced on purpose ───────────────
test("CR03-09: without action scoping the Attempt-1 collision returns", () => {
  const root = sandbox();
  const first = apply(root); // legacy identity, no actionId
  assert.equal(first.executed, true);
  assert.equal(undoReversibleRename({ receipt: first, fs }).proven, true);
  const replay = apply(root); // same bytes, same legacy identity
  assert.equal(replay.executed, false, "control: the legacy collision must still reproduce");
  assert.ok(replay.blocked_by.includes("backup_write_failed"));
  // This is the exact wall Mission-001 hit. CR03-01 shows the scoped identity clears
  // it without weakening the exclusivity that produced it.
  assert.equal(readdirSync(join(root, ".node0-backups")).length, 1);
});
