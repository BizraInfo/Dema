// CAPSULE-PHASE-CAUSAL-PROVENANCE-1A — CP-01…CP-08.
//
// THE DEFECT THIS CLOSES, found in code written earlier the same day. The
// capsule's phase derivation credited `p3-exact-undo` and `p4-verify-restored`
// from ONE filesystem observation — a literal shared `case` fallthrough:
//
//     case "p3-exact-undo":
//     case "p4-verify-restored":
//       ok = hashOnDisk(from) === provisional.before_hash && !exists(to);
//
// That proves the world is restored. It does not prove the governed undo
// restored it. A recovery script, a human, or any other actor producing the
// same bytes at the same path satisfies the predicate, and the capsule then
// credits a constitutional transition that never ran.
//
//     CORRECT POSTCONDITION != PROVEN TRANSITION
//     STATE                 != CAUSALITY
//
// Measured root cause, and why the collapse was not laziness: `undoReversibleRename`
// sealed NOTHING. It returned a caller-holdable object and appended no entry to
// the executor's append-only log, so no provenance artifact for the undo
// transition existed to require. The repair creates one.
//
// THE GRAPH IS NOW STRICTLY ALTERNATING. Odd phases are TRANSITIONS, proven by a
// log-anchored receipt the executor sealed; even phases are OBSERVATIONS, proven
// by a log-anchored record the gate produced by reading the disk through the
// SAME O_NOFOLLOW regular-file reader the actuator uses. An authority verifier
// must never have a weaker path policy than the actuator it judges.
//
// Observations are sealed WHEN MADE rather than re-read at authorization time,
// because a multi-step graph's intermediate states are gone by the time the next
// phase is authorized — the reason the earlier code reached for a later receipt
// as a substitute. That substitution is removed: post-hoc reconstruction may
// serve an audit, never a live authorization.
//
// BOUNDED HONESTLY. Log inclusion is LOCAL EXECUTION PROVENANCE under the
// trusted-filesystem model — not cryptographic authenticity. A forged disk
// defeats it. Ed25519 signing is CR-05 and remains blocked on R0.

import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  sealStateObservation,
  OBSERVED_UNSAFE,
  OBSERVED_ABSENT,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";
import {
  buildMissionEffectCapsule,
  nextCapsulePhase,
  CAPSULE_PHASE_GRAPH,
} from "../packages/core/src/dema-reversible-file-steward.js";

const NOW = "2026-08-13T18:00:00Z";
const BODY = "the governed target state\n";
const FROM = "a.json";
const TO = "a-2026-08-12.json";

const roots = [];
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "cp-"));
  roots.push(root);
  writeFileSync(join(root, FROM), BODY);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const capsuleFor = (root) => {
  const built = buildMissionEffectCapsule({
    effect: {
      sandbox_root: root,
      go_phrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      atoms: [{ from: FROM, to: TO }],
    },
    mission_id: "GENESIS-MISSION-001",
    contract_hash: "sha256:contract",
    purpose_id: "real-corpus-steward",
    repository_commit: "c".repeat(40),
    repository_tree: "t".repeat(40),
    nonce: "gm001-cp-0000000000000001",
    expires_at: "2026-08-14T18:00:00Z",
  });
  assert.equal(built.ok, true, `capsule refused: ${built.reason}`);
  return built.capsule;
};

const applyPhase = (root, capsule, phase) =>
  executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: capsule.action_id,
      phase,
    }),
    fs,
    now: NOW,
  });

const observe = (root, capsule, phase) =>
  sealStateObservation({ sandboxRoot: root, actionId: capsule.action_id, phase, names: [FROM, TO], fs, now: NOW });

const step = (capsule, evidence) => nextCapsulePhase(capsule, evidence, fs);

// ── CP-01 · THE KILLER CONTROL — a restored world is not a governed undo ─────
test("CP-01: manual restoration without the governed undo cannot credit p3", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);

  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(p1.executed, true, `p1 blocked: ${p1.blocked_by}`);
  const o2 = observe(root, capsule, CAPSULE_PHASE_GRAPH[1]);

  // Restore the world by hand. No undo call, no undo receipt. The filesystem now
  // satisfies every postcondition p4 could ever ask for.
  renameSync(join(root, TO), join(root, FROM));
  assert.equal(readFileSync(join(root, FROM), "utf8"), BODY, "control: world IS restored");
  assert.equal(existsSync(join(root, TO)), false, "control: target IS gone");
  const o4 = observe(root, capsule, CAPSULE_PHASE_GRAPH[3]);

  // A caller supplies every row it can honestly hold, plus a perfect-looking
  // undo claim. The transition still never happened.
  const r = step(capsule, [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2.observation },
    { phase: CAPSULE_PHASE_GRAPH[2], undo: { undone: true, proven: true, restored_hash: p1.before_hash } },
    { phase: CAPSULE_PHASE_GRAPH[3], observation: o4.observation },
  ]);

  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false, "credited an undo that never ran");
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[2], "must stop AT the unproven transition");
  assert.notEqual(r.phase, CAPSULE_PHASE_GRAPH[4], "reached the final apply on a fabricated undo");
});

// ── CP-02 · NON-VACUITY — the real lifecycle does advance ────────────────────
test("CP-02: a real apply → observe → governed undo → observe reaches the final apply", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);

  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(p1.executed, true, `p1 blocked: ${p1.blocked_by}`);
  const o2 = observe(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  const u3 = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });
  assert.equal(u3.proven, true, `undo not proven: ${u3.reason}`);
  assert.ok(u3.receipt, "the governed undo sealed no receipt — p3 has no provenance to require");
  const o4 = observe(root, capsule, CAPSULE_PHASE_GRAPH[3]);

  const r = step(capsule, [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2.observation },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: u3.receipt },
    { phase: CAPSULE_PHASE_GRAPH[3], observation: o4.observation },
  ]);
  assert.deepEqual([...r.verified_completed], CAPSULE_PHASE_GRAPH.slice(0, 4));
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[4], `stopped early: ${JSON.stringify(r.stopped_at)}`);
});

// ── CP-03 · the undo must name the apply it reverses ─────────────────────────
test("CP-03: an undo receipt bound to another apply cannot credit this capsule's p3", () => {
  const a = sandbox();
  const b = sandbox();
  const capsule = capsuleFor(a);
  const other = capsuleFor(b);

  const p1 = applyPhase(a, capsule, CAPSULE_PHASE_GRAPH[0]);
  const o2 = observe(a, capsule, CAPSULE_PHASE_GRAPH[1]);
  const foreignApply = applyPhase(b, other, CAPSULE_PHASE_GRAPH[0]);
  const foreignUndo = undoReversibleRename({ receipt: foreignApply, fs, actionId: other.action_id });
  assert.equal(foreignUndo.proven, true, "control: the foreign undo really happened");

  const r = step(capsule, [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2.observation },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: foreignUndo.receipt },
  ]);
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false);
});

// ── CP-04 · transition and postcondition are separately necessary ────────────
test("CP-04: a genuine undo with a world that disagrees stops at the observation", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);

  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  const o2 = observe(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  const u3 = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });
  assert.equal(u3.proven, true);

  // The undo genuinely ran; then something else changed the bytes back.
  writeFileSync(join(root, FROM), "a different world\n");
  const o4 = observe(root, capsule, CAPSULE_PHASE_GRAPH[3]);

  const r = step(capsule, [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2.observation },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: u3.receipt },
    { phase: CAPSULE_PHASE_GRAPH[3], observation: o4.observation },
  ]);
  assert.ok(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), "the transition DID happen and must count");
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[3]), false, "the world disagrees");
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[3]);
});

// ── CP-05 · a forged undo receipt is not in the sealed log ───────────────────
test("CP-05: an undo receipt absent from the executor log is refused", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);
  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  const o2 = observe(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  const u3 = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });

  // Same shape, never sealed: strip it from the append-only log.
  const logPath = join(root, ".node0-receipts.ndjson");
  const kept = readFileSync(logPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.includes(u3.receipt.content_hash));
  writeFileSync(logPath, `${kept.join("\n")}\n`);

  const r = step(capsule, [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2.observation },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: u3.receipt },
  ]);
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false);
});

// ── CP-06 · p2 is no longer a tautology of p1 ────────────────────────────────
test("CP-06: an apply with no sealed observation cannot advance past p2", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);
  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);

  // The previous implementation credited p2 from the provisional receipt's own
  // fields (`after_hash === before_hash`), which a rename makes trivially true —
  // so p1 silently granted p2 and no independent verification ever occurred.
  const r = step(capsule, [{ phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 }]);
  assert.deepEqual([...r.verified_completed], [CAPSULE_PHASE_GRAPH[0]]);
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[1]);
});

// ── CP-07 · post-hoc reconstruction may not authorize ────────────────────────
test("CP-07: a later final-apply receipt cannot stand in for the undo it postdates", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);
  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  const o2 = observe(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  renameSync(join(root, TO), join(root, FROM)); // world restored, no governed undo
  const p5 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[4]);
  assert.equal(p5.executed, true, "control: the final apply really ran");

  // The removed substitution: crediting p3/p4 because a LATER receipt implies the
  // source must have been present. That is an audit inference, not authority.
  const r = step(capsule, [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2.observation },
    { phase: CAPSULE_PHASE_GRAPH[4], receipt: p5 },
  ]);
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false);
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[3]), false);
});

// ── CP-08 · the verifier reads no weaker than the actuator ───────────────────
test("CP-08: an observation refuses a symlink where the actuator would refuse it", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);
  rmSync(join(root, FROM));
  fs.symlinkSync("/etc/hostname", join(root, FROM));

  const o = observe(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  // This assertion used to read `observed[FROM] === null` and call that proof of
  // safety. It was half a proof. Refusing to follow the link is correct; encoding
  // the refusal as the same value used for "absent" handed a predicate that
  // demands absence a reason to be satisfied by blindness. OBSERVATION-ABSENCE-
  // SEMANTICS-1A splits them, so the claim is now the whole claim: the link is
  // not followed AND the refusal is not mistaken for nothing being there.
  assert.equal(o.observation.observed[FROM].state, OBSERVED_UNSAFE, "the verifier followed a symlink");
  assert.equal(o.observation.observed[FROM].reason, "symlink");
  assert.notEqual(o.observation.observed[FROM].state, OBSERVED_ABSENT, "a refusal read as an absence");
  assert.equal(o.observation.observed[FROM].hash, undefined, "a hash escaped from outside the sandbox");
});
