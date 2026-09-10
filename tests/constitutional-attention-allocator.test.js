import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateAttention,
  reduceAttentionAllocation,
  verifyAttentionAllocationReceipt,
  CAA_POLICY_VERSION,
} from "../packages/core/src/constitutional-attention-allocator.js";

const human = (id, extra = {}) => ({
  candidate_id: id,
  mission_id: "MOMO-MISSION",
  source: { origin: "HUMAN", human_requested: true, source_refs: [`sha256:${id.padEnd(64, "0").slice(0, 64)}`] },
  claim: { evidence_class: "SOURCE_BOUND" },
  impact: { mission_relevance: 5, leverage: 3, human_burden_removed: 4, evidence_strength: 3 },
  ...extra,
});

test("CAA-01: selects one active human frontier and preserves proposal-only authority", () => {
  const allocation = allocateAttention({
    mission: { mission_id: "MOMO-MISSION", active_human_mission_id: "MOMO-MISSION" },
    candidates: [human("MOMO-MISSION"), {
      candidate_id: "novelty",
      source: { origin: "AGENT", source_refs: ["research"] },
      impact: { leverage: 5, urgency: 5, speculation: 5 },
    }],
  });
  assert.equal(allocation.schema, "bizra.dema.constitutional_attention_allocator.v0.1");
  assert.equal(allocation.policy_version, CAA_POLICY_VERSION);
  assert.equal(allocation.frontier, "MOMO-MISSION");
  assert.equal(allocation.frontier_decision, "FOCUS");
  assert.equal(allocation.authority.authority, "NONE");
  assert.equal(allocation.authority.authority_delta, 0);
  assert.equal(allocation.authority.execution_allowed, false);
  assert.equal(allocation.effects_started, 0);
  assert.equal(allocation.deferred[0].candidate_id, "novelty");
});

test("CAA-02: recovery gates outrank an active human mission and novelty", () => {
  const allocation = allocateAttention({
    mission: { mission_id: "MOMO-MISSION", active_human_mission_id: "MOMO-MISSION" },
    candidates: [
      human("MOMO-MISSION"),
      human("reconcile", { urgency: { recovery_blocking: true }, impact: { risk_reduction: 5 } }),
      { candidate_id: "novelty", source: { origin: "AGENT", source_refs: ["research"] }, impact: { leverage: 5, urgency: 5, speculation: 0 } },
    ],
  });
  assert.equal(allocation.frontier, "reconcile");
  assert.equal(allocation.frontier_decision, "FOCUS");
  assert.match(allocation.ranked_candidates.find((r) => r.selected).reason, /recovery_required/);
});

test("CAA-03: consequential ambiguity waits for the human without authorizing", () => {
  const allocation = allocateAttention({
    mission: { mission_id: "MOMO-MISSION", active_human_mission_id: "MOMO-MISSION" },
    candidates: [human("MOMO-MISSION", { human_decision_required: true, authority: { action_required: true, hard_gates: ["authority_missing"] } })],
  });
  assert.equal(allocation.frontier_decision, "WAIT_FOR_HUMAN");
  assert.equal(allocation.ranked_candidates[0].execution_blocked, true);
  assert.deepEqual(allocation.ranked_candidates[0].hard_gates.block_execution, ["authority_missing"]);
  assert.equal(allocation.authority.authority_delta, 0);
});

test("CAA-04: duplicates, superseded candidates, and invalid lineage suppress attention", () => {
  const allocation = allocateAttention({
    candidates: [
      human("same"),
      human("same"),
      human("old", { superseded: true }),
      { candidate_id: "unbound", source: { origin: "AGENT" } },
    ],
  });
  const same = allocation.ranked_candidates.filter((row) => row.candidate_id === "same");
  assert.equal(same.length, 2);
  assert.equal(same[0].decision, "FOCUS");
  assert.equal(same[1].decision, "SUPPRESS");
  assert.equal(allocation.ranked_candidates.find((row) => row.candidate_id === "old").decision, "SUPPRESS");
  assert.equal(allocation.ranked_candidates.find((row) => row.candidate_id === "unbound").decision, "SUPPRESS");
  assert.equal(allocation.frontier, "same");
});

test("CAA-05: low evidence becomes investigation, not false certainty", () => {
  const allocation = allocateAttention({
    candidates: [human("unknown", { impact: { evidence_strength: 1 } })],
  });
  assert.equal(allocation.frontier_decision, "INVESTIGATE");
  assert.equal(allocation.ranked_candidates[0].reason, "evidence_insufficient_for_default_focus");
});

test("CAA-06: identical current state rederives exactly and changed state changes the input binding", () => {
  const args = { mission: { mission_id: "MOMO-MISSION" }, current_state: { status: "CURRENT" }, candidates: [human("one")] };
  const first = allocateAttention(args);
  const second = allocateAttention(args);
  const changed = allocateAttention({ ...args, current_state: { status: "CHANGED" } });
  assert.equal(first.allocation_proposal_hash, second.allocation_proposal_hash);
  assert.equal(first.input_state_hash, second.input_state_hash);
  assert.notEqual(first.input_state_hash, changed.input_state_hash);
});

test("CAA-07: reducer creates a non-authorizing receipt and rejects proposal tamper", () => {
  const proposal = allocateAttention({
    mission: { mission_id: "MOMO-MISSION" },
    current_state: { status: "CURRENT" },
    candidates: [human("one")],
  });
  const reduced = reduceAttentionAllocation(proposal);
  assert.equal(reduced.ok, true);
  assert.equal(reduced.receipt.applied, false);
  assert.equal(reduced.receipt.authority.authority, "NONE");
  assert.equal(reduced.receipt.authority.authority_delta, 0);
  assert.equal(reduced.receipt.effects_started, 0);
  assert.deepEqual(verifyAttentionAllocationReceipt(reduced.receipt), { ok: true, blocked_by: [] });

  const tampered = { ...proposal, frontier: "forged" };
  assert.equal(reduceAttentionAllocation(tampered).ok, false);
});
