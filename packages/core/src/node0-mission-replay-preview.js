// NODE0-MISSION-STATE-REPLAY-HARNESS-0A — "the mission survives the model".
//
// PREVIEW_ONLY · NOT ML · NOT live runtime. Pure, deterministic kernel: no fs,
// no net, no clock, no random, no model invocation (sha256 digest only). It
// proves ONE thing, measurably: a mission run as an agent loop
// (Think -> Act -> Observe) persists its state to a content-addressed receipt
// chain each turn, and the FINAL state can be rebuilt from the receipts ALONE —
// no model, no chat context, no original in-memory state. reconstruction_accuracy
// is a real measured number over deterministic fixtures.
//
// The "agent" is a deterministic stand-in (act = sha256 of the step): the claim
// under test is NOT that the agent is smart, it is that WHATEVER the loop did is
// recoverable from receipts. Swap the model out — the mission remains. What this
// does NOT prove: real-session/semantic continuity, model correctness, live PoI.

import { sha256Hex } from "../../receipts/src/hash-util.js";
import { stableStringify } from "../../consent/src/consent-common.js";
import {
  buildPreviewBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "./preview-boundary.js";

export const MISSION_REPLAY_SCHEMA = "bizra.dema.node0_mission_replay.v0.1";
export const MISSION_REPLAY_TRUTH_LABEL = "NODE0_LOCAL_SEED";
export const MISSION_REPLAY_BOUNDARY_KEYS = PREVIEW_BOUNDARY_CANONICAL_KEYS;

const GENESIS = "sha256:genesis";

function hashOf(value) {
  return `sha256:${sha256Hex(stableStringify(value))}`;
}

// The deterministic "act": a stand-in for a model turn — pure fn of (step, goal).
// No model, no randomness: the point is recoverability, not intelligence.
function actOnStep(step, goal) {
  return hashOf({ act_on: step.id, description: step.description ?? null, goal });
}

function normalizeMission(mission) {
  const steps = Array.isArray(mission?.steps) ? mission.steps : [];
  return {
    mission_id: String(mission?.mission_id ?? ""),
    goal: String(mission?.goal ?? ""),
    steps: steps.map((s) => ({
      id: String(s?.id ?? ""),
      description: s?.description ?? null,
    })),
  };
}

// Canonical state snapshot after k turns. stableStringify sorts keys, so the
// hash is order-independent and reproducible.
function stateSnapshot(mission, completed) {
  return {
    mission_id: mission.mission_id,
    goal: mission.goal,
    steps_total: mission.steps.length,
    completed,
  };
}

function freezeReceipt(body) {
  const frozen = { ...body };
  if (Array.isArray(frozen.steps)) {
    frozen.steps = Object.freeze(frozen.steps.map((s) => Object.freeze({ ...s })));
  }
  return Object.freeze(frozen);
}

// Run the agent loop. Emits receipt[0] = mission_open (binds the full mission +
// genesis state) and one "turn" receipt per completed step, each chained via
// prev_state_hash === previous receipt's state_hash. state_hash is the content
// address of the mission state AFTER that turn.
export function runMissionLoop({ mission, maxTurns = Infinity } = {}) {
  const m = normalizeMission(mission);
  const receipts = [];
  const completed = {};

  const openHash = hashOf(stateSnapshot(m, {}));
  receipts.push(
    freezeReceipt({
      kind: "mission_open",
      mission_id: m.mission_id,
      goal: m.goal,
      steps: m.steps,
      turn_index: 0,
      step_id: null,
      act_result: null,
      prev_state_hash: GENESIS,
      state_hash: openHash,
    }),
  );

  let turn = 0;
  for (const step of m.steps) {
    if (turn >= maxTurns) break;
    turn += 1;
    // Think: next open step (deterministic order). Act: deterministic result.
    const act_result = actOnStep(step, m.goal);
    // Observe: record + advance state, then persist the receipt.
    completed[step.id] = act_result;
    receipts.push(
      freezeReceipt({
        kind: "turn",
        mission_id: m.mission_id,
        goal: null,
        steps: null,
        turn_index: turn,
        step_id: step.id,
        act_result,
        prev_state_hash: receipts[receipts.length - 1].state_hash,
        state_hash: hashOf(stateSnapshot(m, { ...completed })),
      }),
    );
  }

  const final_state = stateSnapshot(m, { ...completed });
  return Object.freeze({
    receipts: Object.freeze(receipts),
    final_state: Object.freeze(final_state),
    final_state_hash: hashOf(final_state),
    turns_run: turn,
  });
}

function failReconstruct(blocked_by) {
  return Object.freeze({
    ok: false,
    chain_ok: false,
    tamper_detected: true,
    reconstructed_state: null,
    reconstructed_state_hash: null,
    reconstructed_completed: null,
    mission: null,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Rebuild the final mission state from receipts ALONE — no mission input, no
// model, no original state. Fails closed on empty input, missing mission_open,
// chain break, or any state_hash that does not re-derive (tamper).
export function reconstructMission(receipts) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return failReconstruct(["empty_receipts"]);
  }
  const open = receipts[0];
  if (open?.kind !== "mission_open" || open.prev_state_hash !== GENESIS) {
    return failReconstruct(["missing_mission_open"]);
  }
  for (let i = 1; i < receipts.length; i += 1) {
    if (receipts[i].prev_state_hash !== receipts[i - 1].state_hash) {
      return failReconstruct([`chain_break@${i}`]);
    }
  }
  const mission = normalizeMission({
    mission_id: open.mission_id,
    goal: open.goal,
    steps: open.steps,
  });
  if (hashOf(stateSnapshot(mission, {})) !== open.state_hash) {
    return failReconstruct(["open_state_hash_mismatch"]);
  }
  const completed = {};
  for (let i = 1; i < receipts.length; i += 1) {
    const r = receipts[i];
    if (r.kind !== "turn") return failReconstruct([`bad_receipt_kind@${i}`]);
    completed[r.step_id] = r.act_result;
    if (hashOf(stateSnapshot(mission, { ...completed })) !== r.state_hash) {
      return failReconstruct([`state_hash_mismatch@${i}`]);
    }
  }
  const reconstructed_state = stateSnapshot(mission, { ...completed });
  return Object.freeze({
    ok: true,
    chain_ok: true,
    tamper_detected: false,
    reconstructed_state: Object.freeze(reconstructed_state),
    reconstructed_state_hash: hashOf(reconstructed_state),
    reconstructed_completed: Object.freeze({ ...completed }),
    mission: Object.freeze(mission),
    blocked_by: Object.freeze([]),
  });
}

// Measure the replay: how much of the mission was recovered from receipts alone.
// reconstruction_accuracy = correctly-recovered steps / total; critical_state_loss
// = steps missing or wrong; exact_match = reconstructed hash === original final.
export function measureReplay({ mission, original_final_state_hash, reconstruction } = {}) {
  const m = normalizeMission(mission);
  const total = m.steps.length;
  if (!reconstruction || !reconstruction.ok) {
    return Object.freeze({
      reconstruction_accuracy: 0,
      critical_state_loss: total,
      exact_match: false,
      chain_ok: Boolean(reconstruction && reconstruction.chain_ok),
    });
  }
  const rebuilt = reconstruction.reconstructed_completed ?? {};
  let correct = 0;
  for (const step of m.steps) {
    if (rebuilt[step.id] === actOnStep(step, m.goal)) correct += 1;
  }
  return Object.freeze({
    reconstruction_accuracy: total === 0 ? 1 : correct / total,
    critical_state_loss: total - correct,
    exact_match:
      reconstruction.reconstructed_state_hash === original_final_state_hash,
    chain_ok: true,
  });
}

// Full report (CLI entry): run the loop, reconstruct from receipts alone, measure.
export function buildMissionReplayReport({ mission, maxTurns } = {}) {
  const loop = runMissionLoop({ mission, maxTurns });
  const reconstruction = reconstructMission(loop.receipts);
  const measurement = measureReplay({
    mission,
    original_final_state_hash: loop.final_state_hash,
    reconstruction,
  });
  const body = {
    schema: MISSION_REPLAY_SCHEMA,
    truth_label: MISSION_REPLAY_TRUTH_LABEL,
    mode: "preview_only",
    mission_id: normalizeMission(mission).mission_id,
    turns_run: loop.turns_run,
    receipt_count: loop.receipts.length,
    original_final_state_hash: loop.final_state_hash,
    reconstructed_state_hash: reconstruction.reconstructed_state_hash,
    mission_survives_model: reconstruction.ok && measurement.exact_match,
    measurement: {
      measurement_class: "LOCAL_FIXTURE_MEASURED",
      reconstruction_accuracy: measurement.reconstruction_accuracy,
      critical_state_loss: measurement.critical_state_loss,
      exact_match: measurement.exact_match,
      no_model_used: true,
      no_original_state_used: true,
    },
    boundary: buildPreviewBoundary(),
    what_this_does_not_prove: Object.freeze([
      "real-session mission continuity across live LLM context resets",
      "semantic reconstruction (deterministic fixture agent, not a model)",
      "model correctness, reasoning quality, or output usefulness",
      "live PoI, verified impact, mint, federation, or PAT/SAT runtime",
    ]),
  };
  return Object.freeze({ ...body, content_hash: hashOf(body) });
}

// Re-derivation path: verify the whole body binds to content_hash and the
// boundary is exactly the canonical all-false key set.
export function verifyMissionReplayReport(report) {
  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["not_object"] };
  }
  const keys = Object.keys(report.boundary ?? {}).sort();
  if (
    stableStringify(keys) !==
    stableStringify([...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort())
  ) {
    return { ok: false, blocked_by: ["boundary_not_canonical"] };
  }
  const { content_hash, ...rest } = report;
  if (content_hash !== hashOf(rest)) {
    return { ok: false, blocked_by: ["content_hash_mismatch"] };
  }
  return { ok: true, blocked_by: [] };
}
