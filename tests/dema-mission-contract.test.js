import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaMissionContract,
  buildDemaMissionContractPayload,
  verifyDemaMissionContract,
  runDemaMissionContract,
  DEMA_MISSION_CONTRACT_SCHEMA,
  DEMA_MISSION_CONTRACT_TRUTH_LABEL,
  DEMA_MISSION_CONTRACT_GO_PHRASE,
} from "../packages/core/src/dema-mission-contract.js";
import {
  proposeDemaMissionContractAmendment,
  DEMA_MISSION_CONTRACT_OPERATOR_CHANNEL,
} from "../packages/core/src/dema-mission-contract.js";
import {
  runDemaMissionContractCheck,
  demaMissionContractFixture,
} from "../scripts/review/dema-mission-contract-check.mjs";

const fixture = demaMissionContractFixture;

// RED-FIRST: each test encodes part of the DEMA-MISSION-CONTRACT-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.
// Replace every `/* TODO */` with the slice's real fixture input.

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaMissionContract({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaMissionContract({ consent: DEMA_MISSION_CONTRACT_GO_PHRASE, input: fixture() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaMissionContractPayload(fixture());
  assert.equal(payload.schema, DEMA_MISSION_CONTRACT_SCHEMA);
  assert.equal(payload.truth_label, DEMA_MISSION_CONTRACT_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaMissionContractPayload(fixture());
  assert.equal(verifyDemaMissionContract(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaMissionContractPayload(fixture());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaMissionContract(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildDemaMissionContractPayload(fixture());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaMissionContract(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaMissionContractCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_MISSION_CONTRACT_SCHEMA);
  assert.equal(result.truth_label, DEMA_MISSION_CONTRACT_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaMissionContract({ consent: DEMA_MISSION_CONTRACT_GO_PHRASE, input: fixture() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- CONTRACT-KERNEL-CUT-0 (MISSION_RUNTIME_0A_SPEC_v0_1 phase_01) ---

test("T-01: unjudgeable or unterminable contracts are invalid at creation", () => {
  const noAcs = planDemaMissionContract({
    consent: DEMA_MISSION_CONTRACT_GO_PHRASE,
    input: { ...fixture(), acceptance_criteria: [] },
  });
  assert.equal(noAcs.eligible, false);
  assert.ok(noAcs.blocked_by.includes("acceptance_criteria_empty"));

  const zeroBudget = planDemaMissionContract({
    consent: DEMA_MISSION_CONTRACT_GO_PHRASE,
    input: { ...fixture(), iteration_budget: 0 },
  });
  assert.equal(zeroBudget.eligible, false);
  assert.ok(zeroBudget.blocked_by.includes("iteration_budget_not_positive_integer"));
});

test("T-02: contract_hash is deterministic and key-order independent", () => {
  const a = buildDemaMissionContractPayload(fixture());
  const b = buildDemaMissionContractPayload(fixture());
  assert.equal(a.content_hash, b.content_hash);

  const shuffled = Object.fromEntries(Object.entries(fixture()).reverse());
  const c = buildDemaMissionContractPayload(shuffled);
  assert.equal(c.content_hash, a.content_hash);
});

test("T-03: worker-channel amendment is rejected; prior contract unchanged", () => {
  const contract = buildDemaMissionContractPayload(fixture());
  const before = JSON.stringify(contract);
  const rejected = proposeDemaMissionContractAmendment({
    contract,
    changes: { scope: "widened scope" },
    channel: "worker_proposal",
    consent: DEMA_MISSION_CONTRACT_GO_PHRASE,
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.blocked_by.includes("contract_mutation_rejected"));
  assert.equal(JSON.stringify(contract), before);
});

test("T-03b: operator-consented amendment yields a NEW hash; old contract survives", () => {
  const contract = buildDemaMissionContractPayload(fixture());
  const amended = proposeDemaMissionContractAmendment({
    contract,
    changes: { iteration_budget: 5 },
    channel: DEMA_MISSION_CONTRACT_OPERATOR_CHANNEL,
    consent: DEMA_MISSION_CONTRACT_GO_PHRASE,
  });
  assert.equal(amended.ok, true, amended.blocked_by?.join(", "));
  assert.notEqual(amended.contract.content_hash, contract.content_hash);
  assert.equal(amended.superseded_content_hash, contract.content_hash);
  assert.equal(verifyDemaMissionContract(contract).ok, true);
  assert.equal(verifyDemaMissionContract(amended.contract).ok, true);
  assert.equal(amended.contract.input.iteration_budget, 5);
});

test("T-03c: amendment producing an invalid contract is rejected with field blocks", () => {
  const contract = buildDemaMissionContractPayload(fixture());
  const bad = proposeDemaMissionContractAmendment({
    contract,
    changes: { acceptance_criteria: [] },
    channel: DEMA_MISSION_CONTRACT_OPERATOR_CHANNEL,
    consent: DEMA_MISSION_CONTRACT_GO_PHRASE,
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("acceptance_criteria_empty"));
});
