// CAPSULE-PHASE-EVIDENCE-BINDING-1A — PE-01…PE-07.
//
// THE DEFECT THIS CLOSES, found by review of my own capsule kernel. The first
// version of `nextCapsulePhase` took a list of completed phase NAMES and checked
// they formed a legal prefix of the graph. That proves the reported order is
// legal. It proves nothing about whether those phases happened. A caller could
// hand over the four earlier names and be told the next legal mutation was the
// FINAL APPLY — on a real corpus file.
//
//   PHASE_NAME != PHASE_COMPLETION
//
// which is the same family as `ok:true != evidence exists` (measured earlier this
// season on loadSeasonHead) and `actor claim != authority` (ACTOR-AUTHORITY-
// NULLITY-1A). The kernel's own comment claimed "final happens because restoration
// was proven" — which was false as implemented, an overclaim inside a test suite
// written to prevent overclaims.
//
// The binary question this suite answers: can any caller reach FINAL_APPLY by
// supplying correct earlier phase names without proven receipts and state?
// Required answer: NO.
//
// PE-02 is the non-vacuity half. If forged history is refused but a REAL verified
// chain also never advances, the kernel is merely broken rather than safe.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  buildMissionEffectCapsule,
  nextCapsulePhase,
  deriveVerifiedCapsuleCompletion,
} from "../packages/core/src/dema-reversible-file-steward.js";
import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const roots = [];
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function liveCapsule() {
  const root = mkdtempSync(join(tmpdir(), "pe-"));
  roots.push(root);
  writeFileSync(join(root, "a.json"), "governed state\n");
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: root, atoms: [{ from: "a.json", to: "a-2026-08-12.json" }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize-to-dated-convention",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce: "gm001-attempt2-0001",
    expires_at: "2026-08-14T15:00:00Z",
  });
  assert.equal(built.ok, true, built.reason);
  return { root, capsule: built.capsule };
}

const applyPhase = (root, capsule, phase) =>
  executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: "a.json",
      newName: "a-2026-08-12.json",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: capsule.action_id,
      phase,
    }),
    fs,
    now: "2026-08-13T18:00:00Z",
  });

/** The real chain, up to and including proven restoration. */
function realEvidenceThroughRestoration() {
  const { root, capsule } = liveCapsule();
  const genesis = sha(readFileSync(join(root, "a.json")));
  const prov = applyPhase(root, capsule, "p1-provisional-apply");
  assert.equal(prov.executed, true, `provisional blocked: ${prov.blocked_by}`);
  const afterApply = sha(readFileSync(join(root, "a-2026-08-12.json")));
  const undo = undoReversibleRename({ receipt: prov, fs, actionId: capsule.action_id });
  assert.equal(undo.proven, true, `undo not proven: ${undo.reason}`);
  const afterUndo = sha(readFileSync(join(root, "a.json")));
  const evidence = [
    { phase: "p1-provisional-apply", receipt: prov },
    { phase: "p2-verify-apply", observed_hash: `sha256:${afterApply}` },
    { phase: "p3-exact-undo", undo },
    { phase: "p4-verify-restored", observed_hash: `sha256:${afterUndo}` },
  ];
  return { root, capsule, evidence, prov, genesis };
}

// ── PE-01 · THE CONTROL — fabricated history must not reach the final apply ──
test("PE-01: correct phase names with no evidence cannot advance to the final apply", () => {
  const { capsule } = liveCapsule();
  // Exactly what the old API accepted, and exactly what an attacker would send.
  const forged = [
    { phase: "p1-provisional-apply" },
    { phase: "p2-verify-apply" },
    { phase: "p3-exact-undo" },
    { phase: "p4-verify-restored" },
  ];
  const next = nextCapsulePhase(capsule, forged);
  assert.equal(next.ok, true);
  assert.notEqual(next.phase, "p5-final-apply", "FABRICATED HISTORY REACHED A REAL MUTATION");
  assert.equal(next.phase, "p1-provisional-apply", "a claim with no evidence completed nothing");
  assert.deepEqual(next.verified_completed, []);
});

// ── PE-02 · NON-VACUITY — a real verified chain DOES advance ────────────────
test("PE-02: a genuinely executed and proven chain advances to the final apply", () => {
  const { capsule, evidence } = realEvidenceThroughRestoration();
  const next = nextCapsulePhase(capsule, evidence);
  assert.equal(next.phase, "p5-final-apply", `stopped at ${JSON.stringify(next.stopped_at)}`);
  assert.equal(next.mutating, true);
  assert.equal(next.action_id, capsule.action_id);
  assert.equal(next.verified_completed.length, 4);
});

// ── PE-03 · a receipt from a different action does not count ────────────────
test("PE-03: a receipt whose action id is not this capsule's is rejected", () => {
  const { capsule, evidence, prov } = realEvidenceThroughRestoration();
  const foreign = { ...prov, action_id: "act-someone-elses" };
  const next = nextCapsulePhase(capsule, [{ ...evidence[0], receipt: foreign }, ...evidence.slice(1)]);
  assert.deepEqual(next.verified_completed, []);
  assert.equal(next.phase, "p1-provisional-apply");
});

// ── PE-04 · a receipt from the wrong phase does not count ───────────────────
test("PE-04: a receipt sealed for another phase is rejected", () => {
  const { capsule, evidence, prov } = realEvidenceThroughRestoration();
  const wrongPhase = { ...prov, phase: "p5-final-apply" };
  const next = nextCapsulePhase(capsule, [{ ...evidence[0], receipt: wrongPhase }, ...evidence.slice(1)]);
  assert.deepEqual(next.verified_completed, []);
});

// ── PE-05 · a tampered receipt does not count ───────────────────────────────
test("PE-05: editing a receipt without re-deriving its content hash is rejected", () => {
  const { capsule, evidence, prov } = realEvidenceThroughRestoration();
  const tampered = { ...prov, before_hash: `sha256:${"0".repeat(64)}` };
  const next = nextCapsulePhase(capsule, [{ ...evidence[0], receipt: tampered }, ...evidence.slice(1)]);
  assert.deepEqual(next.verified_completed, []);
});

// ── PE-06 · an unproven undo blocks the final apply ─────────────────────────
test("PE-06: restoration that did not prove cannot be followed by the final apply", () => {
  const { capsule, evidence } = realEvidenceThroughRestoration();
  const unproven = evidence.map((e) =>
    e.phase === "p3-exact-undo" ? { ...e, undo: { ...e.undo, proven: false } } : e,
  );
  const next = nextCapsulePhase(capsule, unproven);
  assert.notEqual(next.phase, "p5-final-apply");
  assert.equal(next.phase, "p3-exact-undo", "the graph advanced past an unproven restoration");
  assert.equal(next.stopped_at.phase, "p3-exact-undo");
});

// ── PE-07 · a restoration to the wrong bytes blocks the final apply ─────────
test("PE-07: an undo that restored different bytes than the receipt recorded is rejected", () => {
  const { capsule, evidence } = realEvidenceThroughRestoration();
  const wrongBytes = evidence.map((e) =>
    e.phase === "p3-exact-undo"
      ? { ...e, undo: { ...e.undo, restored_hash: `sha256:${"f".repeat(64)}` } }
      : e,
  );
  assert.equal(nextCapsulePhase(capsule, wrongBytes).phase, "p3-exact-undo");
  // and a gap cannot be stepped over: p4 evidence alone completes nothing
  const gapOnly = deriveVerifiedCapsuleCompletion({
    capsule,
    evidence: [{ phase: "p4-verify-restored", observed_hash: `sha256:${"a".repeat(64)}` }],
  });
  assert.deepEqual(gapOnly.completed, []);
});
