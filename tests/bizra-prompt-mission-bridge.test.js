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
  assert.equal(a.context_snapshot.human_identity.display_name.status, "UNKNOWN");
  assert.deepEqual(
    verifyMissionProposal(a, {
      expected_compiler_code_hash: COMPILER_CODE_HASH,
      expected_context: CONTEXT,
    }),
    { ok: true, blocked_by: [], recomputed_bridge_hash: a.bridge_hash },
  );
});

test("BPMB-05: identity is explicit context, never inferred from arbitrary fields", () => {
  const proposal = compileMissionProposal({
    text: INTENT,
    context: {
      ...CONTEXT,
      human_identity: {
        display_name: {
          status: "DECLARED",
          value: "Momo",
          source: "human_input",
        },
      },
    },
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });

  assert.equal(proposal.context_snapshot.human_identity.display_name.status, "DECLARED");
  assert.equal(proposal.context_snapshot.human_identity.display_name.value, "Momo");
  assert.equal(proposal.authority.authority_delta, 0);
});

test("BPMB-06: normalized fact reasons remain stable across re-derivation", () => {
  const context = {
    ...CONTEXT,
    current_state: { status: "BOUND", reason: "current_state_not_measured" },
  };
  const proposal = compileMissionProposal({
    text: INTENT,
    context,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });
  assert.equal(proposal.context_snapshot.current_state.status, "UNKNOWN");
  assert.equal(proposal.context_snapshot.current_state.reason, "bound_status_requires_sha256_hash");
  const rebound = compileMissionProposal({
    text: INTENT,
    context: proposal.context_snapshot,
    now_iso: NOW,
    compiler_code_hash: COMPILER_CODE_HASH,
  });
  assert.deepEqual(rebound.context_snapshot.current_state, proposal.context_snapshot.current_state);
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

const REQUIREMENT_NOW = "2026-10-13T20:30:00.000Z";
function trustedRequirement() {
  return {
    schema: "bizra.dema.trusted_task_requirement.v1",
    task_id: "BIZRA-GENESIS-LOCAL-MISSION-0",
    owner: { identity: "/fixed/registered-mission", hash: ROOT_DNA_HASH, revision: ROOT_DNA_HASH },
    required_operation: "METADATA_INVENTORY_READ_ONLY",
    capability: {
      mission_id: "BIZRA-GENESIS-LOCAL-MISSION-0",
      version: "bizra.genesis.mission_contract.v0.1",
      operation: "METADATA_INVENTORY_READ_ONLY",
      owner_hash: COMPILER_CODE_HASH,
      registration_hash: ROOT_DNA_HASH,
    },
    policy: {
      id: "NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1",
      hash: COMPILER_CODE_HASH,
      scope: "ISOLATED_NONEXECUTING_TEST_ONLY",
      task_id: "BIZRA-GENESIS-LOCAL-MISSION-0",
      required_operation: "METADATA_INVENTORY_READ_ONLY",
      valid_from: "2026-10-13T20:26:59.532196Z",
      expires_at: "2026-10-13T21:56:59.532196Z",
      revoked: false,
      authority_ref: "GO NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1",
    },
    execution_allowed: false,
    authority_delta: 0,
  };
}
function compileRequirement(requirement = trustedRequirement()) {
  return compileMissionProposal({
    text: "Inventory BIZRA metadata.", context: CONTEXT,
    now_iso: REQUIREMENT_NOW, compiler_code_hash: COMPILER_CODE_HASH,
    task_requirement: requirement,
  });
}
function verifyRequirement(proposal, requirement = trustedRequirement(), time = REQUIREMENT_NOW) {
  return verifyMissionProposal(proposal, {
    expected_compiler_code_hash: COMPILER_CODE_HASH,
    expected_context: CONTEXT,
    expected_task_requirement: requirement,
    verification_now_iso: time,
  });
}

test("BPMB-R1: requirement identity changes same-text mission identity", () => {
  const first = trustedRequirement();
  const second = trustedRequirement();
  second.task_id = second.policy.task_id = "ANOTHER-INDEPENDENT-TASK";
  second.owner.identity = "/fixed/other-task";
  const a = compileRequirement(first);
  const b = compileRequirement(second);
  assert.notEqual(a.mission_id, b.mission_id);
  assert.notEqual(a.requirement_binding_hash, b.requirement_binding_hash);
  assert.equal(verifyRequirement(a, first).ok, true);
  assert.equal(verifyRequirement(a, second).ok, false);
});

test("BPMB-R2: approved fixture is preview-only and requires independent expectation and time", () => {
  const proposal = compileRequirement();
  const verification = verifyRequirement(proposal);
  assert.equal(verification.ok, true);
  assert.equal(verification.requirement_verdict, "OPERATION_MATCH_PREVIEW_ONLY");
  assert.equal(proposal.boundary.execution_allowed, false);
  assert.equal(proposal.authority.authority_delta, 0);
  assert.equal(verifyMissionProposal(proposal).ok, false);
  assert.equal(verifyMissionProposal(proposal, {
    expected_task_requirement: trustedRequirement(),
  }).ok, false);
  assert.equal(verifyMissionProposal(proposal, {
    expected_task_requirement: trustedRequirement(), verification_now_iso: REQUIREMENT_NOW,
  }).ok, false);
});

test("BPMB-R3: source-cited brief cannot be substituted with metadata inventory", () => {
  const requirement = trustedRequirement();
  requirement.task_id = "TASK-075.26";
  requirement.required_operation = "SOURCE_CONTENT_EVIDENCE_AND_SOURCE_CITED_STATUS_REPORT";
  requirement.policy = null;
  const result = verifyRequirement(compileRequirement(requirement), requirement);
  assert.equal(result.ok, false);
  assert.equal(result.requirement_verdict, "BLOCKED_UNSUPPORTED_OPERATION");
});

test("BPMB-R4: current owner, capability and approval cannot be spliced or self-verified", () => {
  const proposal = compileRequirement();
  const mutations = [
    r => { r.owner.hash = `sha256:${"c".repeat(64)}`; },
    r => { r.owner.identity = "/forged/task"; },
    r => { r.owner.revision = `sha256:${"d".repeat(64)}`; },
    r => { r.capability.owner_hash = `sha256:${"e".repeat(64)}`; },
    r => { r.capability.registration_hash = `sha256:${"f".repeat(64)}`; },
    r => { r.capability.mission_id = "OTHER-MISSION"; },
    r => { r.policy.hash = `sha256:${"c".repeat(64)}`; },
    r => { r.policy.task_id = "OTHER-TASK"; },
    r => { r.policy.required_operation = "WRITE_REPORT"; },
    r => { r.policy.scope = "PRODUCTION"; },
    r => { r.policy.authority_ref = ""; },
    r => { r.execution_allowed = true; },
    r => { r.authority_delta = 1; },
  ];
  for (const mutate of mutations) {
    const current = trustedRequirement();
    mutate(current);
    assert.equal(verifyRequirement(proposal, current).ok, false);
  }
});

test("BPMB-R5: expired, revoked, not-yet-valid and unbound policies refuse", () => {
  const proposal = compileRequirement();
  for (const mutate of [
    r => { r.policy.expires_at = REQUIREMENT_NOW; },
    r => { r.policy.valid_from = "2026-10-14T00:00:00Z"; },
    r => { r.policy.revoked = true; },
    r => { r.policy = null; },
    r => { r.policy.expires_at = "not-time"; },
  ]) {
    const requirement = trustedRequirement();
    mutate(requirement);
    assert.equal(verifyRequirement(proposal, requirement).ok, false);
  }
  assert.equal(verifyRequirement(proposal, trustedRequirement(), "untrusted-time").ok, false);
});

test("BPMB-R6: removing task identity or all requirement fields cannot fall back to legacy", () => {
  const legacy = compileMissionProposal({
    text: "Inventory BIZRA metadata.", context: CONTEXT,
    now_iso: REQUIREMENT_NOW, compiler_code_hash: COMPILER_CODE_HASH,
  });
  assert.equal(verifyRequirement(legacy).ok, false);
  assert.equal(verifyMissionProposal(compileRequirement(), {
    expected_task_requirement: null, verification_now_iso: REQUIREMENT_NOW,
  }).ok, false);
});
