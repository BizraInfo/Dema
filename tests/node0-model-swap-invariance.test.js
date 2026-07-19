import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0ModelSwapInvariance,
  buildNode0ModelSwapInvariancePayload,
  verifyNode0ModelSwapInvariance,
  runNode0ModelSwapInvariance,
  evaluateAgainstContract,
  node0ModelSwapInvarianceBoundary,
  NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
  NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL,
  NODE0_MODEL_SWAP_INVARIANCE_GO_PHRASE,
} from "../packages/core/src/node0-model-swap-invariance.js";
import { runNode0ModelSwapInvarianceCheck } from "../scripts/review/node0-model-swap-invariance-check.mjs";

// NODE0-MODEL-SWAP-INVARIANCE-1A proof contract.
//
// The thesis, made measurable: the system's verdict on a mission-task is a pure
// function of (output, acceptance_contract). Model identity has ZERO authority —
// it can neither launder a failing output into acceptance nor change a passing
// one. Swap the model, the system's verdict (the authoritative state) is unchanged.

const GO = NODE0_MODEL_SWAP_INVARIANCE_GO_PHRASE;

// A mission-task whose acceptance contract is deterministic and model-independent.
const CONTRACT = {
  required_output_keys: ["answer", "evidence_ref"],
  forbidden_substrings: ["world's first", "guaranteed", "100% proven"],
  expected: { answer: "42" },
};
const GOOD_OUTPUT = { answer: "42", evidence_ref: "receipt:abc123" };
const BAD_MISSING = { answer: "42" }; // missing evidence_ref
const BAD_OVERCLAIM = { answer: "42", evidence_ref: "r", note: "world's first proof" };
const BAD_WRONG = { answer: "41", evidence_ref: "r" };

const VALID = Object.freeze({
  task: { task_id: "mission-001", acceptance_contract: CONTRACT },
  candidates: [
    { model_id: "whiterabbitneo-v3:7b", output: GOOD_OUTPUT },
    { model_id: "deepseek-r1:8b", output: GOOD_OUTPUT },
    { model_id: "gpt-anything", output: BAD_MISSING },
  ],
});

// ── generated skeleton contract (fixtures filled) ──

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0ModelSwapInvariance({ consent: "wrong", input: VALID });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0ModelSwapInvariance({ consent: GO, input: VALID });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  assert.equal(payload.schema, NODE0_MODEL_SWAP_INVARIANCE_SCHEMA);
  assert.equal(payload.truth_label, NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  for (const v of Object.values(payload.boundary)) assert.equal(v, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  assert.equal(verifyNode0ModelSwapInvariance(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0ModelSwapInvariance(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0ModelSwapInvariance(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0ModelSwapInvarianceCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_MODEL_SWAP_INVARIANCE_SCHEMA);
  assert.equal(result.truth_label, NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0ModelSwapInvariance({ consent: GO, input: VALID });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  for (const v of Object.values(result.boundary)) assert.equal(v, false);
});

// ── the thesis: model-swap-invariance proof contract ──

test("T1 verdict is a pure function of (output, contract) — model_id is not a parameter", () => {
  // evaluateAgainstContract's signature admits no identity; the same output yields
  // the same verdict no matter what model 'produced' it.
  const a = evaluateAgainstContract(GOOD_OUTPUT, CONTRACT);
  const b = evaluateAgainstContract(GOOD_OUTPUT, CONTRACT);
  assert.equal(a.verdict, "ACCEPT");
  assert.deepEqual(a, b);
  assert.equal(evaluateAgainstContract(BAD_MISSING, CONTRACT).verdict, "REJECT");
  assert.equal(evaluateAgainstContract(BAD_OVERCLAIM, CONTRACT).verdict, "REJECT");
  assert.equal(evaluateAgainstContract(BAD_WRONG, CONTRACT).verdict, "REJECT");
});

test("T2 identical output from two DIFFERENT models gets the identical verdict + output_hash", () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const good = payload.candidates.filter((c) => c.verdict === "ACCEPT");
  assert.equal(good.length, 2, "both good-output candidates accepted");
  assert.equal(good[0].output_hash, good[1].output_hash, "same output → same hash");
  assert.notEqual(good[0].model_id, good[1].model_id, "different models");
  assert.equal(payload.invariants.verdict_is_model_blind, true);
});

test("T3 no identity laundering: a 'trusted' model cannot flip a failing output to ACCEPT", () => {
  // The best model in the fleet produces a contract-violating output.
  const input = {
    task: { task_id: "m", acceptance_contract: CONTRACT },
    candidates: [
      { model_id: "whiterabbitneo-v3:7b", output: BAD_OVERCLAIM }, // "best" model, bad output
      { model_id: "tiny-model", output: GOOD_OUTPUT }, // "weak" model, good output
    ],
  };
  const payload = buildNode0ModelSwapInvariancePayload(input);
  const best = payload.candidates.find((c) => c.model_id === "whiterabbitneo-v3:7b");
  const weak = payload.candidates.find((c) => c.model_id === "tiny-model");
  assert.equal(best.verdict, "REJECT", "trusted model's bad output is rejected");
  assert.equal(weak.verdict, "ACCEPT", "weak model's good output is accepted");
  assert.equal(payload.invariants.no_identity_laundering, true);
  // Accepted state is the GOOD output's hash — produced by the 'weak' model. The
  // system took the correct answer regardless of who produced it.
  assert.deepEqual(payload.accepted_output_hashes, [weak.output_hash]);
});

test("T4 relabel invariance: permuting model_ids does not change the accepted-state set", () => {
  const base = buildNode0ModelSwapInvariancePayload(VALID);
  const swapped = buildNode0ModelSwapInvariancePayload({
    ...VALID,
    candidates: [
      { model_id: "deepseek-r1:8b", output: GOOD_OUTPUT }, // labels swapped vs VALID
      { model_id: "gpt-anything", output: GOOD_OUTPUT },
      { model_id: "whiterabbitneo-v3:7b", output: BAD_MISSING },
    ],
  });
  assert.deepEqual(base.accepted_output_hashes, swapped.accepted_output_hashes);
  assert.equal(base.invariants.relabel_invariant, true);
});

test("T5 attestation is order-independent: the same candidate SET yields the same content_hash", () => {
  const reordered = { ...VALID, candidates: [...VALID.candidates].reverse() };
  assert.equal(
    buildNode0ModelSwapInvariancePayload(VALID).content_hash,
    buildNode0ModelSwapInvariancePayload(reordered).content_hash,
    "candidate order must not change the attestation",
  );
});

test("T6 verify fails closed if any invariant flag is forged false", async () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const forged = {
    ...payload,
    invariants: { ...payload.invariants, no_identity_laundering: false, all_hold: false },
  };
  // recompute the hash so the body is internally consistent — verify must STILL
  // reject because the invariants-hold check is independent of hash consistency.
  const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
  const { content_hash: _drop, ...body } = forged;
  const rehashed = { ...body, content_hash: sha256CanonicalJsonV1(body) };
  const v = verifyNode0ModelSwapInvariance(rehashed);
  assert.equal(v.hash_ok, true, "body is internally consistent");
  assert.equal(v.invariants_ok, false, "but a false invariant flag is rejected");
  assert.equal(v.ok, false);
});

test("T7 boundary rejects a forged extra key even when rehashed (deep-equal key set)", async () => {
  const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const { content_hash: _d, ...body } = payload;
  const tampered = { ...body, boundary: { ...payload.boundary, model_invocation_performed_secretly: true } };
  const rehashed = { ...tampered, content_hash: sha256CanonicalJsonV1(tampered) };
  assert.equal(verifyNode0ModelSwapInvariance(rehashed).boundary_ok, false);
});

test("T8 boundary set is exactly the frozen all-false 8-key set", () => {
  const b = node0ModelSwapInvarianceBoundary();
  assert.equal(Object.isFrozen(b), true);
  assert.ok(Object.values(b).every((v) => v === false));
  assert.equal(Object.keys(b).length, 8);
});
