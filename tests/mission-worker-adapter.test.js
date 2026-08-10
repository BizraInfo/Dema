// MISSION-WORKER-ADAPTER-0A — red-first tests for TASK-026 spec phase 03.
//
// The seam between a disposable worker and the conductor, plus the ten
// demonstrations as one executable suite.
//
// IN-REPO WORKERS ARE SIMULATED IDENTITIES. Nothing here spawns a process,
// invokes a model, or opens a socket. A live-worker run is a separate
// operator-GO'd act outside this slice and is not claimed by it.

import test from "node:test";
import assert from "node:assert/strict";

import {
  WORKER_ADAPTER_CARD,
  FORBIDDEN_PROPOSAL_FIELDS,
  buildWorkerInput,
  validateProposal,
  WORKER_SIM_A,
  WORKER_SIM_B,
  runSwapProtocol,
  SWAP_DEMONSTRATIONS,
} from "../packages/core/src/mission-worker-adapter.js";
import { MISSION_CONTRACT_GO_PHRASE, createMissionContract } from "../packages/core/src/mission-contract-state.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const GO = MISSION_CONTRACT_GO_PHRASE;

const FIELDS = {
  mission_id: "MISSION-SWAP-001",
  purpose: "Swap a worker mid-mission without losing the mission",
  scope: "packages/core/src only",
  acceptance_contract: { required_output_keys: ["patch"], forbidden_substrings: ["TODO"] },
  acceptance_criteria: ["patch present", "no TODO"],
  prohibited_outcomes: ["push"],
  authority_ceiling: "local_reversible",
  iteration_budget: 4,
  completion_conditions: ["acceptance met"],
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-10T00:00:00.000Z",
};
const contract = () => createMissionContract({ fields: FIELDS, consent: GO });
const run = () => runSwapProtocol({ contract: contract().contract, contract_hash: contract().contract_hash });

// ── FR-1 / FR-2 · the seam ───────────────────────────────────────────────────
test("FR-1: the adapter card declares all ten fields and grants no authority", () => {
  for (const k of [
    "purpose",
    "input_contract",
    "output_contract",
    "authority",
    "allowed_effects",
    "forbidden_effects",
    "failure_codes",
    "verification_method",
    "receipt_fields",
    "recovery_behavior",
  ]) {
    assert.ok(k in WORKER_ADAPTER_CARD, `card is missing ${k}`);
  }
  assert.deepEqual([...WORKER_ADAPTER_CARD.allowed_effects], []);
  assert.equal(WORKER_ADAPTER_CARD.authority, "none");
});

test("FR-2: a worker receives EXACTLY {checkpoint, eligible_actions} and nothing else", () => {
  const input = buildWorkerInput({
    checkpoint: { snapshot: { state_seq: 1 }, state_hash: "sha256:x" },
    eligible_actions: ["plan_proposed"],
    // Everything below must be dropped at the seam, not carried and ignored.
    contract: FIELDS,
    receipt_signer: () => "nope",
    verdict: "ACCEPT",
  });
  assert.deepEqual(Object.keys(input).sort(), ["checkpoint", "eligible_actions"]);
});

// ── T-03 · forbidden fields never reach the reducer ──────────────────────────
test("T-03: every forbidden proposal field is rejected at the schema seam", () => {
  let rejected = 0;
  for (const field of FORBIDDEN_PROPOSAL_FIELDS) {
    const r = validateProposal({ kind: "plan_proposed", stage: "PLAN", hash: "sha256:p", [field]: "anything" });
    assert.equal(r.ok, false, `${field} must be rejected`);
    assert.equal(r.refusal, `forbidden_proposal_field:${field}`);
    rejected += 1;
  }
  assert.ok(rejected > 0, "the fuzz list is empty — this test would prove nothing");
  // Positive control: a clean proposal passes, so the rejections above are caused
  // by the forbidden fields and not by a validator that refuses everything.
  assert.equal(validateProposal({ kind: "plan_proposed", stage: "PLAN", hash: "sha256:p" }).ok, true);
});

test("EC-5: a proposal carrying a `contract` field is refused BEFORE any hash work", () => {
  const r = validateProposal({ kind: "plan_proposed", stage: "PLAN", hash: "sha256:p", contract: { scope: "everything" } });
  assert.equal(r.ok, false);
  assert.equal(r.refusal, "forbidden_proposal_field:contract");
  assert.equal(r.hash_computed, false, "the writer law: refuse the shape before touching the hash");
});

// ── FR-3 · deterministic simulated identities ────────────────────────────────
test("FR-3: two distinct simulated identities exist and are deterministic", () => {
  assert.notEqual(WORKER_SIM_A.worker_id, WORKER_SIM_B.worker_id);
  assert.deepEqual(WORKER_SIM_A.propose("EXECUTE"), WORKER_SIM_A.propose("EXECUTE"));
  // The prestigious identity deliberately emits a FAILING output.
  assert.match(JSON.stringify(WORKER_SIM_A.propose("EXECUTE").output), /TODO/);
  assert.doesNotMatch(JSON.stringify(WORKER_SIM_B.propose("EXECUTE").output), /TODO/);
});

// ── FR-4 · the ten demonstrations ────────────────────────────────────────────
test("FR-4: the demonstration table has exactly ten rows, each uniquely numbered", () => {
  assert.equal(SWAP_DEMONSTRATIONS.length, 10);
  assert.deepEqual(
    SWAP_DEMONSTRATIONS.map((d) => d.n),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

for (const demo of [
  { n: 1, name: "worker A performs the first attempt" },
  { n: 2, name: "state is saved outside the worker" },
  { n: 3, name: "worker A is intentionally stopped" },
  { n: 4, name: "worker B resumes from the checkpoint" },
  { n: 5, name: "worker B cannot alter the contract" },
  { n: 6, name: "external tests decide acceptance" },
  { n: 7, name: "the prestigious worker's failing output stays rejected" },
  { n: 8, name: "the smaller worker's valid output is accepted" },
  { n: 9, name: "a receipt exists per iteration" },
  { n: 10, name: "replay reproduces the walked state" },
]) {
  test(`DEMO ${demo.n}: ${demo.name}`, () => {
    const result = run();
    const row = result.demonstrations.find((d) => d.n === demo.n);
    assert.ok(row, `demonstration ${demo.n} missing from the result`);
    assert.equal(row.passed, true, `demonstration ${demo.n} failed: ${row.evidence}`);
    assert.ok(typeof row.evidence === "string" && row.evidence.length > 0, "every demo must carry evidence");
  });
}

// ── The swap is real, not cosmetic ───────────────────────────────────────────
test("the mission survives the swap: same mission_id and contract_hash across both workers", () => {
  const r = run();
  assert.equal(r.pre_swap.mission_id, r.post_swap.mission_id);
  assert.equal(r.pre_swap.contract_hash, r.post_swap.contract_hash);
  assert.notEqual(r.pre_swap.worker_id, r.post_swap.worker_id, "the worker must actually have changed");
});

test("demo 7 vs 8 is a real discrimination, not a constant", () => {
  const r = run();
  const seven = r.demonstrations.find((d) => d.n === 7);
  const eight = r.demonstrations.find((d) => d.n === 8);
  assert.notEqual(seven.verdict, eight.verdict, "prestige and rejection must not coincide by accident");
});

// ── EC-1..EC-4 ───────────────────────────────────────────────────────────────
test("EC-1: a proposal referencing a pre-swap state_seq is rejected and the rejection is receipted", () => {
  const r = run();
  assert.equal(r.edge_cases.EC1.rejected, "out_of_stage_event");
  assert.ok(r.edge_cases.EC1.receipted, "the rejection must leave a receipt");
});

test("EC-2: worker A returning from the dead after the swap cannot affect the chain", () => {
  const r = run();
  assert.ok(["duplicate_event", "out_of_stage_event"].includes(r.edge_cases.EC2.rejected));
  assert.equal(r.edge_cases.EC2.chain_head_unchanged, true);
});

test("EC-3: two workers proposing for the same action — first wins, second is stale", () => {
  const r = run();
  assert.equal(r.edge_cases.EC3.first_accepted, true);
  assert.ok(r.edge_cases.EC3.second_rejected !== null);
});

test("EC-4: swapping during a consent hold does not launder consent", () => {
  const r = run();
  assert.equal(r.edge_cases.EC4.stage, "HALTED");
  assert.equal(r.edge_cases.EC4.resume_without_consent_rejected, true);
  assert.equal(r.edge_cases.EC4.resume_with_consent_stage, "FATE");
});

// ── FR-5 / T-05 · the demonstration receipt ──────────────────────────────────
test("T-05: the demonstration receipt is byte-identical across two runs of the same fixture", () => {
  assert.equal(run().receipt_hash, run().receipt_hash);
});

test("FR-5: the receipt binds contract, both identities, verdicts, chain head and replay hash", () => {
  const r = run();
  for (const k of ["contract_hash", "worker_identities", "verdicts", "receipt_chain_head", "replay_hash", "boundary"]) {
    assert.ok(k in r.receipt, `receipt is missing ${k}`);
  }
  assert.equal(r.receipt.worker_identities.length, 2);
  assert.ok(isCanonicalBoundary(r.receipt.boundary));
  // Measured, not asserted: the protocol touched no network and no remote write.
  assert.equal(r.receipt.boundary.network_used, false);
  assert.equal(r.receipt.boundary.runtime_execution_performed, false);
});

test("FR-5: the receipt states plainly that the workers were simulated", () => {
  const r = run();
  assert.equal(r.receipt.workers_were_simulated, true);
  assert.match(r.receipt.what_this_does_not_prove, /simulated|live/i);
});

// ── all ten, together ────────────────────────────────────────────────────────
test("the full protocol reports 10/10 and settles no closure invariant", () => {
  const r = run();
  assert.equal(r.demonstrations.filter((d) => d.passed).length, 10);
  assert.equal(r.settles_closure_invariant, false);
});
