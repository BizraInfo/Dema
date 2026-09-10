import test from "node:test";
import assert from "node:assert/strict";

import {
  compileMissionProposal,
  verifyMissionProposal,
} from "../packages/core/src/bizra-prompt-mission-bridge.js";

const COMPILER_CODE_HASH = `sha256:${"a".repeat(64)}`;
const ROOT_DNA_HASH = `sha256:${"b".repeat(64)}`;
const CONTEXT = {
  root_dna: { status: "BOUND", hash: ROOT_DNA_HASH },
  node_story: { status: "UNKNOWN" },
  current_state: { status: "UNKNOWN" },
  human_compass: {
    financial_freedom: "UNKNOWN",
    mind_clarity: "UNKNOWN",
    peace_of_heart: "UNKNOWN",
  },
};
const NOW = "2026-09-10T00:00:00.000Z";
const INTENT = "Understand my current situation and propose the safest useful next action.";

test("BPMB-01: deterministic intent-to-MissionContract proposal is hash-bound", () => {
  const a = compileMissionProposal({
    text: INTENT,
    context: CONTEXT,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });
  const b = compileMissionProposal({
    text: INTENT,
    context: CONTEXT,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });

  assert.equal(a.bridge_hash, b.bridge_hash);
  assert.equal(a.mission_contract.contract_hash, b.mission_contract.contract_hash);
  assert.equal(a.authority.authority, "NONE");
  assert.equal(a.authority.authority_delta, 0);
  assert.equal(a.boundary.execution_allowed, false);
  assert.equal(a.boundary.model_invocation_performed, false);
  assert.equal(a.boundary.effect_started, false);
  assert.equal(a.attention.frontier, a.mission_id);
  assert.equal(a.attention.frontier_decision, "FOCUS");
  assert.equal(a.attention.authority.authority_delta, 0);
  assert.equal(a.attention.effects_started, 0);
  assert.equal(a.context_snapshot.node_story.status, "UNKNOWN");
  assert.equal(a.context_snapshot.current_state.status, "UNKNOWN");
  assert.deepEqual(
    verifyMissionProposal(a, {
      expected_compiler_code_hash: COMPILER_CODE_HASH,
      expected_context: CONTEXT,
    }),
    { ok: true, blocked_by: [], recomputed_bridge_hash: a.bridge_hash },
  );
});

test("BPMB-02: understanding a consequential request holds for exact consent", () => {
  const proposal = compileMissionProposal({
    text: "Transfer 500 USDT to the supplied wallet and publish the result.",
    context: CONTEXT,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });

  assert.equal(proposal.authority.authority, "NONE");
  assert.equal(proposal.authority.consent_required, true);
  assert.equal(proposal.authority.authority_delta, 0);
  assert.equal(proposal.decision, "WAIT_FOR_HUMAN");
  assert.equal(proposal.attention.frontier, proposal.mission_id);
  assert.equal(proposal.attention.frontier_decision, "WAIT_FOR_HUMAN");
  assert.ok(proposal.requested_actions.some((a) => a.action === "transfer"));
  assert.ok(proposal.requested_actions.some((a) => a.action === "publish"));
  assert.ok(proposal.blocked_by.includes("exact_consequential_consent_required"));
  assert.equal(proposal.boundary.effect_started, false);
});

test("BPMB-03: source, context, compiler, and contract tampering fail closed", () => {
  const proposal = compileMissionProposal({
    text: INTENT,
    context: CONTEXT,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });

  const cases = [
    {
      name: "source",
      value: { ...proposal, source_text: `${proposal.source_text} altered` },
      options: { expected_compiler_code_hash: COMPILER_CODE_HASH, expected_context: CONTEXT },
    },
    {
      name: "compiler",
      value: {
        ...proposal,
        compiler: { ...proposal.compiler, code_hash: `sha256:${"c".repeat(64)}` },
      },
      options: { expected_compiler_code_hash: COMPILER_CODE_HASH, expected_context: CONTEXT },
    },
    {
      name: "context",
      value: {
        ...proposal,
        context_snapshot: { ...proposal.context_snapshot, node_story: { status: "BOUND" } },
      },
      options: { expected_compiler_code_hash: COMPILER_CODE_HASH, expected_context: CONTEXT },
    },
    {
      name: "contract",
      value: {
        ...proposal,
        mission_contract: {
          ...proposal.mission_contract,
          contract: { ...proposal.mission_contract.contract, purpose: "forged" },
        },
      },
      options: { expected_compiler_code_hash: COMPILER_CODE_HASH, expected_context: CONTEXT },
    },
  ];

  for (const c of cases) {
    const result = verifyMissionProposal(c.value, c.options);
    assert.equal(result.ok, false, `${c.name} tamper must refuse`);
    assert.ok(result.blocked_by.length > 0, `${c.name} tamper needs a reason`);
  }
});

test("BPMB-04: no compiler call can mint authority or an effect", () => {
  const proposal = compileMissionProposal({
    text: INTENT,
    context: CONTEXT,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });

  assert.equal(proposal.compiler.boundary.execution_allowed, false);
  assert.equal(proposal.compiler.boundary.llm_called, false);
  assert.equal(proposal.compiler.boundary.network_used, false);
  assert.equal(proposal.compiler.boundary.authority_delta, 0);
  assert.equal(proposal.authority.requested_effects.length, 0);
  assert.equal(proposal.effects_started, 0);
});
