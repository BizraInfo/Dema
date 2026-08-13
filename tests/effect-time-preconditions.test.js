// EFFECT-TIME-PRECONDITIONS-1A — TEMP-01…TEMP-04.
//
// THE DEFECT, measured on the composed candidate. A sealed observation is a fact
// about a past moment. It is not a lease over future reality. The actuator
// re-derived existence and type at effect time (source_missing,
// unsafe_symlink_source, target_exists) but never CONTENT — so after a valid p4
// was sealed, an external write changed the governed file and the final apply
// renamed THAT content and sealed a receipt for it:
//
//     graph says next: p5-final-apply
//     p5 executed on drifted content: true   blocked_by: []
//     landed bytes: "SOMEONE ELSE WROTE THIS"
//
//     PAST TRUTH        != CURRENT PRECONDITION
//     PHASE ELIGIBILITY != EFFECT-TIME PRECONDITION SATISFACTION
//
// The check lives in the actuator, inside the same call that performs the move,
// because that is the only place it cannot be stale. `nextCapsulePhase` hands the
// expectation over rather than leaving a caller to remember it.
//
// STATED LIMIT: p1 carries no expectation, because the capsule's preview binds
// pathnames and not content. Committing consent to source content is a separate
// act and is not faked here.
//
// Also pinned: UNDO-PROVENANCE-FAILSAFE. A governed undo can restore the world
// and then fail to append its receipt. The world changed and the provenance did
// not, which must fail safe rather than advance —
//
//     MUTATION SUCCEEDED != PROOF PERSISTED

import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  sealStateObservation,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";
import {
  buildMissionEffectCapsule,
  nextCapsulePhase,
  CAPSULE_PHASE_GRAPH,
} from "../packages/core/src/dema-reversible-file-steward.js";

const FROM = "a.json";
const TO = "b.json";
const ORIGINAL = "ORIGINAL GOVERNED BYTES\n";
const NOW = "2026-08-13T21:00:00Z";

const roots = [];
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "temp-"));
  roots.push(root);
  writeFileSync(join(root, FROM), ORIGINAL);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function capsuleFor(root, nonce) {
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce,
    expires_at: "2026-08-14T21:00:00Z",
  });
  assert.equal(built.ok, true, built.reason);
  return built.capsule;
}

const apply = (root, capsule, phase, expectedBeforeHash) =>
  executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: capsule.action_id,
      phase,
      expectedBeforeHash,
    }),
    fs,
    now: NOW,
  });

const seal = (root, capsule, phase) =>
  sealStateObservation({
    sandboxRoot: root,
    actionId: capsule.action_id,
    phase,
    names: [FROM, TO],
    fs,
    now: NOW,
  }).observation;

/** Real p1 → p2 → p3 → p4, all genuinely executed and sealed. */
function throughRestoration(nonce) {
  const root = sandbox();
  const capsule = capsuleFor(root, nonce);
  const p1 = apply(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(p1.executed, true, `p1 blocked: ${p1.blocked_by}`);
  const o2 = seal(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  const u3 = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });
  assert.equal(u3.proven, true, `undo not proven: ${u3.reason}`);
  const o4 = seal(root, capsule, CAPSULE_PHASE_GRAPH[3]);
  const evidence = [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2 },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: u3.receipt },
    { phase: CAPSULE_PHASE_GRAPH[3], observation: o4 },
  ];
  return { root, capsule, evidence, p1 };
}

// ── TEMP-01 · THE KILLER CONTROL — a drifted world is not mutated ───────────
test("TEMP-01: content that changed after p4 was sealed is refused at the final apply", () => {
  const { root, capsule, evidence, p1 } = throughRestoration("gm001-temp-000000000001");
  const step = nextCapsulePhase(capsule, evidence, fs);
  assert.equal(step.phase, CAPSULE_PHASE_GRAPH[4], "control: the graph must consider p5 eligible");
  assert.equal(step.expected_before_hash, p1.before_hash, "the capsule must hand over the expectation");

  // Something else writes the governed pathname AFTER the observation was sealed.
  writeFileSync(join(root, FROM), "SOMEONE ELSE WROTE THIS\n");

  const p5 = apply(root, capsule, CAPSULE_PHASE_GRAPH[4], step.expected_before_hash);
  assert.equal(p5.executed, false, "the final apply moved content nobody consented to");
  assert.ok(p5.blocked_by.includes("before_hash_drifted"), JSON.stringify(p5.blocked_by));
  assert.equal(fs.existsSync(join(root, TO)), false, "a drifted effect landed");
  assert.equal(readFileSync(join(root, FROM), "utf8"), "SOMEONE ELSE WROTE THIS\n", "the drift was clobbered");
});

// ── TEMP-02 · NON-VACUITY — the undrifted world still executes ──────────────
test("TEMP-02: with the world unchanged, the same guarded final apply succeeds", () => {
  const { root, capsule, evidence, p1 } = throughRestoration("gm001-temp-000000000002");
  const step = nextCapsulePhase(capsule, evidence, fs);
  const p5 = apply(root, capsule, CAPSULE_PHASE_GRAPH[4], step.expected_before_hash);
  assert.equal(p5.executed, true, `honest final apply blocked: ${p5.blocked_by}`);
  assert.equal(p5.before_hash, p1.before_hash, "it moved the consented bytes");
  assert.equal(readFileSync(join(root, TO), "utf8"), ORIGINAL);
});

// ── TEMP-03 · restoring the world restores eligibility ──────────────────────
test("TEMP-03: drift refused, then repaired, then the same graph executes", () => {
  const { root, capsule, evidence } = throughRestoration("gm001-temp-000000000003");
  const step = nextCapsulePhase(capsule, evidence, fs);

  writeFileSync(join(root, FROM), "drifted\n");
  assert.equal(apply(root, capsule, CAPSULE_PHASE_GRAPH[4], step.expected_before_hash).executed, false);

  // Put the consented bytes back. The history never changed; only the world did.
  writeFileSync(join(root, FROM), ORIGINAL);
  const good = apply(root, capsule, CAPSULE_PHASE_GRAPH[4], step.expected_before_hash);
  assert.equal(good.executed, true, `blocked after repair: ${good.blocked_by}`);
});

// ── TEMP-04 · a malformed expectation is refused, never ignored ─────────────
test("TEMP-04: an unusable expected-before-hash blocks rather than silently lapsing", () => {
  const { root, capsule } = throughRestoration("gm001-temp-000000000004");
  const plan = planReversibleRename({
    sandboxRoot: root,
    fileName: FROM,
    newName: TO,
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    actionId: capsule.action_id,
    phase: CAPSULE_PHASE_GRAPH[4],
    expectedBeforeHash: "not-a-hash",
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("unsafe_expected_before_hash"), JSON.stringify(plan.blocked_by));
  // Silently dropping it would downgrade a guarded caller to the unguarded path
  // without saying so — the same failure mode as an ignored plane declaration.
  assert.equal(plan.expected_before_hash, null);
});

// ── TEMP-05 · MUTATION SUCCEEDED != PROOF PERSISTED ─────────────────────────
test("TEMP-05: an undo whose receipt cannot be sealed does not advance the capsule", () => {
  const root = sandbox();
  const capsule = capsuleFor(root, "gm001-temp-000000000005");
  const p1 = apply(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(p1.executed, true);
  const o2 = seal(root, capsule, CAPSULE_PHASE_GRAPH[1]);

  // Isolate the APPEND. Turning the log into a directory also breaks the undo's
  // own receipt verification, so it would never restore and the test would pass
  // for the wrong reason. A read-only regular file still verifies and still
  // reads; only the write fails.
  const logPath = join(root, ".node0-receipts.ndjson");
  const saved = readFileSync(logPath, "utf8");
  fs.chmodSync(logPath, 0o444);

  const u3 = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });
  assert.equal(u3.undone, true, "control: the physical restoration must still have happened");
  assert.equal(u3.proven, true, "control: and it must still be proven against the backup");
  assert.equal(u3.receipt_sealed, false, "an unwritable log reported as sealed");
  assert.ok(u3.receipt, "the caller still holds the object — which is exactly the hazard");

  // WORLD_CHANGED + PROVENANCE_UNSEALED must fail safe, not advance.
  fs.chmodSync(logPath, 0o644);
  writeFileSync(logPath, saved);
  const r = nextCapsulePhase(
    capsule,
    [
      { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
      { phase: CAPSULE_PHASE_GRAPH[1], observation: o2 },
      { phase: CAPSULE_PHASE_GRAPH[2], receipt: u3.receipt },
    ],
    fs,
  );
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false, "unsealed provenance advanced");
  assert.notEqual(r.phase, CAPSULE_PHASE_GRAPH[4], "reached a real mutation on unsealed provenance");
});
