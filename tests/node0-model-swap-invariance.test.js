import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0ModelSwapInvariance,
  buildNode0ModelSwapInvariancePayload,
  verifyNode0ModelSwapInvariance,
  runNode0ModelSwapInvariance,
  evaluateAgainstContract,
  validateAcceptanceContract,
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

// ── PROOF-CONTRACT-HOTFIX-1A: the ways a FALSE PASS was reachable ──
//
// T6 above forges an invariant flag to `false` and checks it is refused. The
// dangerous direction is the opposite one: forging a flag to `true`. The three
// attacks below all produced `ok: true` on c64fedb, so a fabricated attestation,
// a proof with no swap in it, and a malformed contract each read as PASS.

const rehash = async (body) => {
  const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
  const { content_hash: _drop, ...rest } = body;
  return { ...rest, content_hash: sha256CanonicalJsonV1(rest) };
};

test("T9 verify refuses a body whose own candidate rows contradict its asserted invariants", async () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const hash = `sha256:${"a".repeat(64)}`;
  // One output hash carrying BOTH verdicts is the literal negation of
  // verdict_is_model_blind — yet the body asserts every invariant holds.
  const forged = await rehash({
    ...payload,
    candidate_count: 2,
    accept_count: 1,
    accepted_output_hashes: [hash],
    candidates: [
      { model_id: "m-a", output_hash: hash, verdict: "ACCEPT", failed_requirements: [] },
      { model_id: "m-b", output_hash: hash, verdict: "REJECT", failed_requirements: ["missing_key:answer"] },
    ],
    invariants: { verdict_is_model_blind: true, no_identity_laundering: true, relabel_invariant: true, all_hold: true },
  });
  const v = verifyNode0ModelSwapInvariance(forged);
  assert.equal(v.hash_ok, true, "the forged body is internally hash-consistent");
  assert.equal(v.invariants_ok, true, "and its asserted flags all read true");
  assert.equal(v.evidence_ok, false, "but the rows themselves refute the claim");
  assert.equal(v.ok, false, "a rehashed fabrication must not verify");
});

test("T10 verify refuses a forged summary that its own rows do not support", async () => {
  const payload = buildNode0ModelSwapInvariancePayload(VALID);
  const inflated = await rehash({ ...payload, accept_count: payload.accept_count + 1 });
  assert.equal(verifyNode0ModelSwapInvariance(inflated).evidence_ok, false);
  const widened = await rehash({ ...payload, accepted_output_hashes: [...payload.accepted_output_hashes, `sha256:${"b".repeat(64)}`] });
  assert.equal(verifyNode0ModelSwapInvariance(widened).evidence_ok, false);
});

test("T11 a single candidate is not a swap — plan refuses it", () => {
  const plan = planNode0ModelSwapInvariance({
    consent: GO,
    input: { task: { task_id: "m", acceptance_contract: CONTRACT }, candidates: [{ model_id: "only-one", output: GOOD_OUTPUT }] },
  });
  assert.equal(plan.eligible, false, "one model cannot prove invariance under model swap");
  assert.ok(plan.blocked_by.includes("model_swap_absent"));
});

test("T12 two candidates from the SAME model are not a swap — plan refuses them", () => {
  const plan = planNode0ModelSwapInvariance({
    consent: GO,
    input: {
      task: { task_id: "m", acceptance_contract: CONTRACT },
      candidates: [
        { model_id: "same-model", output: GOOD_OUTPUT },
        { model_id: "same-model", output: BAD_MISSING },
      ],
    },
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("duplicate_model_id"));
  assert.ok(plan.blocked_by.includes("model_swap_absent"));
});

test("T13 a malformed contract field is REFUSED, never silently skipped", () => {
  // Each of these is the same failure shape: a mistyped field disables its own
  // check, and acceptance quietly widens to accept-everything.
  assert.equal(evaluateAgainstContract({}, { required_output_keys: "answer" }).verdict, "REJECT");
  assert.equal(evaluateAgainstContract({ answer: "42", evidence_ref: "r", note: "guaranteed" }, { forbidden_substrings: "guaranteed" }).verdict, "REJECT");
  assert.equal(evaluateAgainstContract({ answer: "41" }, { expected: "answer=42" }).verdict, "REJECT");
  assert.equal(evaluateAgainstContract({ answer: "42" }, "not-an-object").verdict, "REJECT");
  assert.deepEqual(evaluateAgainstContract({}, { required_output_keys: "answer" }).failed_requirements, ["contract_malformed:required_output_keys"]);
});

test("T14 a non-string element inside a contract array is refused", () => {
  assert.equal(evaluateAgainstContract({ answer: "42" }, { required_output_keys: ["answer", 7] }).verdict, "REJECT");
  assert.equal(evaluateAgainstContract({ answer: "42" }, { forbidden_substrings: ["ok", null] }).verdict, "REJECT");
});

test("T15 an unknown contract field is refused rather than ignored", () => {
  const r = evaluateAgainstContract({ answer: "42" }, { required_output_keys: ["answer"], reqired_output_keys: ["typo"] });
  assert.equal(r.verdict, "REJECT", "a typo'd field name must not pass as no-requirement");
  assert.ok(r.failed_requirements.includes("contract_unknown_field:reqired_output_keys"));
});

test("T17 a standalone one-model attestation does not verify as swap-invariance proof", () => {
  // An attestation travels on its own. Blocking the vacuous case only at plan
  // time still leaves a receiver accepting a body that proves nothing.
  const single = buildNode0ModelSwapInvariancePayload({
    task: { task_id: "m", acceptance_contract: CONTRACT },
    candidates: [{ model_id: "only-one", output: GOOD_OUTPUT }],
  });
  const v = verifyNode0ModelSwapInvariance(single);
  assert.equal(v.hash_ok, true, "the body is honestly built and hash-consistent");
  assert.equal(v.evidence_ok, false, "but it carries no swap to be invariant under");
  assert.equal(v.ok, false);

  const dup = buildNode0ModelSwapInvariancePayload({
    task: { task_id: "m", acceptance_contract: CONTRACT },
    candidates: [
      { model_id: "same", output: GOOD_OUTPUT },
      { model_id: "same", output: BAD_MISSING },
    ],
  });
  assert.equal(verifyNode0ModelSwapInvariance(dup).ok, false, "two rows, one model, still no swap");
});

// ── EFFECTIVE-CONTRACT-GUARD-1B: well-typed but semantically empty ──
//
// Every contract below passes type validation and imposes ZERO predicates, so it
// accepts every output. Invariance measured over it is vacuously true — the same
// failure shape as T11/T12's one-model candidate set, and it survived the first
// hotfix because `[].every()` is vacuously true and the helper was named as if it
// checked the array was non-empty.

test("T18 an empty contract is refused, not treated as no-requirements", () => {
  assert.equal(evaluateAgainstContract({ literally: "anything" }, {}).verdict, "REJECT");
  assert.deepEqual(evaluateAgainstContract({ x: 1 }, {}).failed_requirements, ["contract_vacuous:no_effective_predicate"]);
});

test("T19 required_output_keys: [] is refused", () => {
  assert.equal(evaluateAgainstContract({ x: 1 }, { required_output_keys: [] }).verdict, "REJECT");
});

test("T20 forbidden_substrings: [] is refused", () => {
  assert.equal(evaluateAgainstContract({ x: 1 }, { forbidden_substrings: [] }).verdict, "REJECT");
});

test("T21 expected: {} is refused when it is the only predicate", () => {
  assert.equal(evaluateAgainstContract({ x: 1 }, { expected: {} }).verdict, "REJECT");
  assert.equal(evaluateAgainstContract({ x: 1 }, { required_output_keys: [], forbidden_substrings: [], expected: {} }).verdict, "REJECT");
});

test("T22 one effective predicate is enough — the guard counts, it does not forbid", () => {
  assert.equal(evaluateAgainstContract({ answer: "42" }, { required_output_keys: ["answer"] }).verdict, "ACCEPT");
  assert.equal(evaluateAgainstContract({ answer: "42" }, { required_output_keys: [], expected: { answer: "42" } }).verdict, "ACCEPT");
  assert.equal(evaluateAgainstContract({ answer: "42" }, { forbidden_substrings: ["nope"] }).verdict, "ACCEPT");
});

test("T23 malformed still reports malformed, not vacuous — the specific diagnosis wins", () => {
  // A mistyped field is malformed, NOT vacuous; conflating them would lose the
  // reason the contract is being refused.
  assert.deepEqual(evaluateAgainstContract({}, { required_output_keys: "answer" }).failed_requirements, ["contract_malformed:required_output_keys"]);
  assert.ok(evaluateAgainstContract({ answer: "42" }, { required_output_keys: ["answer"], reqired_output_keys: [] }).failed_requirements.includes("contract_unknown_field:reqired_output_keys"));
});

test("T24 a vacuous contract cannot even be planned or run into a proof", () => {
  const input = {
    task: { task_id: "m", acceptance_contract: {} },
    candidates: [
      { model_id: "a", output: { junk: 1 } },
      { model_id: "b", output: { other: 2 } },
    ],
  };
  const plan = planNode0ModelSwapInvariance({ consent: GO, input });
  assert.equal(plan.eligible, false, "a proof over no requirement must not be buildable");
  assert.ok(plan.blocked_by.includes("contract_vacuous:no_effective_predicate"));
  const run = runNode0ModelSwapInvariance({ consent: GO, input });
  assert.equal(run.ok, false);
  assert.equal(run.content_hash, null);
});

// ── CONTRACT-ADMISSION-GUARD-1C: malformed but NOT vacuous ──
//
// The 1B guard counts predicates; it does not check shape. A contract with one
// good predicate AND a typo'd field passes that count, so the mission is admitted
// — and then every candidate is rejected for the malformation. Uniform rejection
// makes all three invariants hold trivially, so the run reports a PASS-shaped
// attestation over a broken contract. Note this shape is a CONSEQUENCE of the 1A
// fix: before it, a malformed contract accepted everything (loudly wrong);
// after it, it rejects everything, which looks like an honest "nothing met the bar".

const MALFORMED_NOT_VACUOUS = {
  "unknown field beside a valid one": { required_output_keys: ["answer"], reqired_output_keys: ["misspelled"] },
  "valid field beside a malformed one": { required_output_keys: ["answer"], forbidden_substrings: "guaranteed" },
  "valid field beside a malformed expected": { required_output_keys: ["answer"], expected: "answer=42" },
};

test("T25 a malformed-but-non-vacuous contract is not an admissible proof subject", () => {
  for (const [label, contract] of Object.entries(MALFORMED_NOT_VACUOUS)) {
    const plan = planNode0ModelSwapInvariance({
      consent: GO,
      input: {
        task: { task_id: "m", acceptance_contract: contract },
        candidates: [
          { model_id: "a", output: GOOD_OUTPUT },
          { model_id: "b", output: GOOD_OUTPUT },
        ],
      },
    });
    assert.equal(plan.eligible, false, `${label}: must be refused at admission`);
  }
});

test("T26 run() builds no success-shaped attestation over a malformed contract", () => {
  for (const [label, contract] of Object.entries(MALFORMED_NOT_VACUOUS)) {
    const run = runNode0ModelSwapInvariance({
      consent: GO,
      input: {
        task: { task_id: "m", acceptance_contract: contract },
        candidates: [
          { model_id: "a", output: GOOD_OUTPUT },
          { model_id: "b", output: GOOD_OUTPUT },
        ],
      },
    });
    assert.equal(run.ok, false, `${label}: uniform rejection must not read as a passing proof`);
    assert.equal(run.content_hash, null, `${label}: no content hash for an inadmissible mission`);
  }
});

test("T27 plan and evaluate share ONE definition of a valid contract — no drift", () => {
  // Two independent notions of "valid contract" is how the 1B gap opened. The
  // shared validator is the single source; both callers must report its codes.
  const probes = [
    {},
    { required_output_keys: [] },
    { required_output_keys: ["answer"], reqired_output_keys: ["x"] },
    { required_output_keys: ["answer"], forbidden_substrings: "guaranteed" },
    { required_output_keys: ["answer"] },
    { expected: { answer: "42" } },
  ];
  for (const contract of probes) {
    const v = validateAcceptanceContract(contract);
    const plan = planNode0ModelSwapInvariance({
      consent: GO,
      input: {
        task: { task_id: "m", acceptance_contract: contract },
        candidates: [
          { model_id: "a", output: GOOD_OUTPUT },
          { model_id: "b", output: GOOD_OUTPUT },
        ],
      },
    });
    assert.equal(plan.eligible, v.valid, `plan eligibility must track the shared validator for ${JSON.stringify(contract)}`);
    for (const code of v.blocked_by) assert.ok(plan.blocked_by.includes(code), `plan must surface ${code}`);
    if (!v.valid) {
      assert.deepEqual(
        evaluateAgainstContract(GOOD_OUTPUT, contract).failed_requirements,
        v.blocked_by,
        "evaluate must report the same codes as the shared validator",
      );
    }
  }
});

test("T28 the validator reports an honest effective-predicate count", () => {
  assert.equal(validateAcceptanceContract({}).effective_predicate_count, 0);
  assert.equal(validateAcceptanceContract({ required_output_keys: [] }).effective_predicate_count, 0);
  assert.equal(validateAcceptanceContract({ required_output_keys: ["a", "b"] }).effective_predicate_count, 2);
  assert.equal(validateAcceptanceContract(CONTRACT).effective_predicate_count, 2 + 3 + 1);
  assert.equal(validateAcceptanceContract(CONTRACT).valid, true);
});

test("T29 a well-formed non-empty contract is still admitted and still proves", () => {
  assert.equal(planNode0ModelSwapInvariance({ consent: GO, input: VALID }).eligible, true);
  assert.equal(runNode0ModelSwapInvariance({ consent: GO, input: VALID }).ok, true);
  assert.equal(evaluateAgainstContract(GOOD_OUTPUT, CONTRACT).verdict, "ACCEPT");
  assert.equal(runNode0ModelSwapInvarianceCheck().ok, true);
});

test("T16 the honest fixtures stay green after hardening", () => {
  assert.equal(evaluateAgainstContract(GOOD_OUTPUT, CONTRACT).verdict, "ACCEPT");
  assert.equal(planNode0ModelSwapInvariance({ consent: GO, input: VALID }).eligible, true);
  assert.equal(runNode0ModelSwapInvariance({ consent: GO, input: VALID }).ok, true);
  assert.equal(runNode0ModelSwapInvarianceCheck().ok, true);
});
