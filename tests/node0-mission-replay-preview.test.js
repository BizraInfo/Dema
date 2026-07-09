import test from "node:test";
import assert from "node:assert/strict";

import {
  runMissionLoop,
  reconstructMission,
  measureReplay,
  buildMissionReplayReport,
  verifyMissionReplayReport,
  MISSION_REPLAY_SCHEMA,
  MISSION_REPLAY_TRUTH_LABEL,
} from "../packages/core/src/node0-mission-replay-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

function fixture() {
  return {
    mission_id: "m-001",
    goal: "prove the mission survives the model",
    steps: [
      { id: "s1", description: "sanitize corpus" },
      { id: "s2", description: "run mission loop" },
      { id: "s3", description: "seal receipt" },
    ],
  };
}

test("loop persists mission_open + 1 receipt/turn, content-addressed + chained", () => {
  const loop = runMissionLoop({ mission: fixture() });
  assert.equal(loop.turns_run, 3);
  assert.equal(loop.receipts.length, 4); // 1 open + 3 turns
  assert.equal(loop.receipts[0].kind, "mission_open");
  assert.equal(loop.receipts[0].prev_state_hash, "sha256:genesis");
  for (let i = 1; i < loop.receipts.length; i += 1) {
    assert.equal(loop.receipts[i].kind, "turn");
    assert.equal(loop.receipts[i].prev_state_hash, loop.receipts[i - 1].state_hash);
    assert.match(loop.receipts[i].state_hash, /^sha256:[0-9a-f]{64}$/);
  }
});

test("reconstruct from receipts ALONE rebuilds final state exactly (no model, no original)", () => {
  const loop = runMissionLoop({ mission: fixture() });
  const rec = reconstructMission(loop.receipts);
  assert.equal(rec.ok, true);
  assert.equal(rec.chain_ok, true);
  assert.equal(rec.reconstructed_state_hash, loop.final_state_hash);
});

test("measure: clean run → accuracy 1, critical_state_loss 0, exact_match", () => {
  const mission = fixture();
  const loop = runMissionLoop({ mission });
  const rec = reconstructMission(loop.receipts);
  const m = measureReplay({
    mission,
    original_final_state_hash: loop.final_state_hash,
    reconstruction: rec,
  });
  assert.equal(m.reconstruction_accuracy, 1);
  assert.equal(m.critical_state_loss, 0);
  assert.equal(m.exact_match, true);
});

test("tampered act_result → reconstruction fails closed (state_hash mismatch)", () => {
  const loop = runMissionLoop({ mission: fixture() });
  const receipts = loop.receipts.map((r) => ({ ...r }));
  receipts[2] = { ...receipts[2], act_result: `sha256:${"0".repeat(64)}` };
  const rec = reconstructMission(receipts);
  assert.equal(rec.ok, false);
  assert.equal(rec.tamper_detected, true);
  assert.ok(rec.blocked_by.some((b) => b.startsWith("state_hash_mismatch")));
});

test("dropped receipt → chain break fails closed", () => {
  const loop = runMissionLoop({ mission: fixture() });
  const receipts = loop.receipts.filter((_, i) => i !== 2);
  const rec = reconstructMission(receipts);
  assert.equal(rec.ok, false);
  assert.ok(rec.blocked_by.some((b) => b.startsWith("chain_break")));
});

test("tampered mission_open state → open_state_hash_mismatch fails closed", () => {
  const loop = runMissionLoop({ mission: fixture() });
  const receipts = loop.receipts.map((r) => ({ ...r }));
  receipts[0] = { ...receipts[0], goal: "a different goal" };
  const rec = reconstructMission(receipts);
  assert.equal(rec.ok, false);
  assert.ok(rec.blocked_by.includes("open_state_hash_mismatch"));
});

test("empty + missing mission_open fail closed with explicit reasons", () => {
  assert.equal(reconstructMission([]).blocked_by[0], "empty_receipts");
  const loop = runMissionLoop({ mission: fixture() });
  const noOpen = loop.receipts.slice(1);
  assert.ok(reconstructMission(noOpen).blocked_by.includes("missing_mission_open"));
});

test("bad receipt kind → fails closed", () => {
  const loop = runMissionLoop({ mission: fixture() });
  const receipts = loop.receipts.map((r) => ({ ...r }));
  receipts[1] = { ...receipts[1], kind: "not_a_turn" };
  const rec = reconstructMission(receipts);
  assert.equal(rec.ok, false);
  assert.ok(rec.blocked_by.some((b) => b.startsWith("bad_receipt_kind")));
});

test("measure on failed reconstruction → accuracy 0, all steps lost", () => {
  const mission = fixture();
  const loop = runMissionLoop({ mission });
  const receipts = loop.receipts.map((r) => ({ ...r }));
  receipts[2] = { ...receipts[2], act_result: "x" };
  const rec = reconstructMission(receipts);
  const m = measureReplay({
    mission,
    original_final_state_hash: loop.final_state_hash,
    reconstruction: rec,
  });
  assert.equal(m.reconstruction_accuracy, 0);
  assert.equal(m.critical_state_loss, 3);
});

test("boundary is exactly the canonical key set, all false", () => {
  const report = buildMissionReplayReport({ mission: fixture() });
  assert.deepEqual(
    Object.keys(report.boundary).sort(),
    [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort(),
  );
  for (const v of Object.values(report.boundary)) assert.equal(v, false);
});

test("report: schema, truth label, measured accuracy, mission_survives_model, non-claims", () => {
  const report = buildMissionReplayReport({ mission: fixture() });
  assert.equal(report.schema, MISSION_REPLAY_SCHEMA);
  assert.equal(report.truth_label, MISSION_REPLAY_TRUTH_LABEL);
  assert.equal(report.measurement.reconstruction_accuracy, 1);
  assert.equal(report.measurement.no_model_used, true);
  assert.equal(report.mission_survives_model, true);
  const nc = report.what_this_does_not_prove.join(" ");
  assert.match(nc, /real-session/);
  assert.match(nc, /live PoI/);
});

test("verify re-derives whole body; a mutated field without re-hash fails", () => {
  const report = buildMissionReplayReport({ mission: fixture() });
  assert.equal(verifyMissionReplayReport(report).ok, true);
  const mutated = { ...report, mission_survives_model: false };
  const v = verifyMissionReplayReport(mutated);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_mismatch"));
});

test("verify fails closed on non-object and non-canonical boundary", () => {
  assert.equal(verifyMissionReplayReport(null).blocked_by[0], "not_object");
  const report = buildMissionReplayReport({ mission: fixture() });
  const rogueBoundary = {
    ...report,
    boundary: { ...report.boundary, rogue_key: false },
  };
  assert.ok(
    verifyMissionReplayReport(rogueBoundary).blocked_by.includes(
      "boundary_not_canonical",
    ),
  );
});

test("measure with null reconstruction → accuracy 0, all steps lost", () => {
  const m = measureReplay({ mission: fixture(), reconstruction: null });
  assert.equal(m.reconstruction_accuracy, 0);
  assert.equal(m.critical_state_loss, 3);
  assert.equal(m.chain_ok, false);
});

test("deterministic: same mission → identical content_hash", () => {
  const a = buildMissionReplayReport({ mission: fixture() });
  const b = buildMissionReplayReport({ mission: fixture() });
  assert.equal(a.content_hash, b.content_hash);
});

test("maxTurns bounds the loop; non-array steps normalize to empty", () => {
  const loop = runMissionLoop({ mission: fixture(), maxTurns: 2 });
  assert.equal(loop.turns_run, 2);
  assert.equal(loop.receipts.length, 3); // open + 2 turns
  assert.equal(reconstructMission(loop.receipts).ok, true);
  const bad = buildMissionReplayReport({
    mission: { mission_id: "x", goal: "g", steps: "nope" },
  });
  assert.equal(bad.turns_run, 0);
});

test("step without description reconstructs (nullish default branch)", () => {
  const report = buildMissionReplayReport({
    mission: { mission_id: "d", goal: "g", steps: [{ id: "only-id" }] },
  });
  assert.equal(report.turns_run, 1);
  assert.equal(report.mission_survives_model, true);
});

test("empty mission (no steps) → 0 turns, accuracy 1, survives trivially", () => {
  const report = buildMissionReplayReport({
    mission: { mission_id: "e", goal: "g", steps: [] },
  });
  assert.equal(report.turns_run, 0);
  assert.equal(report.measurement.reconstruction_accuracy, 1);
  assert.equal(report.mission_survives_model, true);
});
