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

// ── PR #423 review: two P1s, found independently by Codex and Greptile ──

test("T30 a predicate outside the canonical-JSON domain is not an admissible contract", () => {
  // Such a value cannot be compared or hashed, so evaluate rejects EVERY
  // candidate — and uniform rejection satisfies all three invariants trivially,
  // producing a PASS over a contract that never compared anything.
  const cycle = {};
  cycle.self = cycle;
  const cases = {
    undefined: undefined,
    function: () => 1,
    symbol: Symbol("x"),
    bigint: 10n,
    infinity: Infinity,
    nan: NaN,
    date: new Date(0),
    map: new Map(),
    cycle,
    "nested undefined": { deep: { x: undefined } },
  };
  for (const [label, value] of Object.entries(cases)) {
    const contract = { expected: { answer: value } };
    assert.equal(validateAcceptanceContract(contract).valid, false, `${label}: must not be admitted`);
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
    assert.equal(run.ok, false, `${label}: must not produce a passing proof`);
    assert.equal(run.content_hash, null, `${label}: must fail closed, not crash or attest`);
  }
});

test("T31 a contract that cannot be hashed as a whole is refused", () => {
  // contract_hash travels in the attestation; a null there would move as though
  // it were bound to something.
  const v = validateAcceptanceContract({ required_output_keys: ["answer"], expected: { a: undefined } });
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("contract_noncanonical:expected.")));
});

test("T32 an ACCEPT row must carry a well-formed output hash", async () => {
  // An ACCEPT row with no usable hash inflates accept_count while contributing
  // nothing to accepted_output_hashes — and BOTH summaries still agree, so the
  // mismatch check alone cannot catch it. The builder can never emit this: an
  // output that fails to canonicalise is rejected, so it never reaches ACCEPT.
  const honest = buildNode0ModelSwapInvariancePayload(VALID);
  for (const bad of [null, "not-a-hash", "sha256:abc", `sha256:${"A".repeat(64)}`]) {
    const forged = await rehash({
      ...honest,
      candidate_count: 2,
      accept_count: 1,
      accepted_output_hashes: [],
      candidates: [
        { model_id: "a", output_hash: bad, verdict: "ACCEPT", failed_requirements: [] },
        { model_id: "b", output_hash: `sha256:${"c".repeat(64)}`, verdict: "REJECT", failed_requirements: ["missing_key:answer"] },
      ],
    });
    const v = verifyNode0ModelSwapInvariance(forged);
    assert.equal(v.hash_ok, true, "the forgery is internally hash-consistent");
    assert.equal(v.evidence_ok, false, `ACCEPT row with hash ${JSON.stringify(bad)} must be refused`);
    assert.equal(v.ok, false);
  }
});

test("T33 a REJECT row may carry a null hash, but never a malformed one", async () => {
  // Symmetry: null IS legitimate on a REJECT row — an output that fails to
  // canonicalise is rejected as output_not_canonicalizable and gets no hash.
  // Garbage never is. Without this, the ACCEPT-row guard could be written as a
  // blanket "hash must be well-formed" and silently break the legitimate case.
  const honest = buildNode0ModelSwapInvariancePayload(VALID);
  const good = honest.candidates.find((c) => c.verdict === "ACCEPT");

  const rows = (rejectHash) => [
    { model_id: "a", output_hash: good.output_hash, verdict: "ACCEPT", failed_requirements: [] },
    { model_id: "b", output_hash: rejectHash, verdict: "REJECT", failed_requirements: ["missing_key:evidence_ref"] },
  ];
  const build = async (rejectHash) =>
    rehash({ ...honest, candidate_count: 2, accept_count: 1, accepted_output_hashes: [good.output_hash], candidates: rows(rejectHash) });

  assert.equal(verifyNode0ModelSwapInvariance(await build(null)).evidence_ok, true, "null on a REJECT row is legitimate");
  for (const bad of ["not-a-hash", "sha256:abc", `sha256:${"Z".repeat(64)}`, 42]) {
    assert.equal(
      verifyNode0ModelSwapInvariance(await build(bad)).evidence_ok,
      false,
      `malformed REJECT-row hash ${JSON.stringify(bad)} must be refused`,
    );
  }
});

// ── PR #423 review: uninspectable contracts (Greptile, reproduced on 78962c3) ──
//
// Every look at a caller-controlled contract is an exception-capable operation.
// `Object.keys(c)`, `"expected" in c`, `c.expected` and `Object.entries(c.expected)`
// all run attacker-supplied code when the contract carries an accessor or is a
// Proxy. On 78962c3 those exceptions escaped the public API: validate, plan,
// evaluate and run threw instead of failing closed, so a hostile contract took
// the caller down rather than being refused with a reason.

const boom = () => {
  throw new Error("hostile contract");
};

// An own ENUMERABLE accessor — the shape Object.keys and Object.entries walk into.
const getterOn = (prop, get = boom) => {
  const o = {};
  Object.defineProperty(o, prop, { enumerable: true, configurable: true, get });
  return o;
};

const hostileInput = (contract) => ({
  task: { task_id: "m", acceptance_contract: contract },
  candidates: [
    { model_id: "a", output: GOOD_OUTPUT },
    { model_id: "b", output: GOOD_OUTPUT },
  ],
});

// Each factory is called fresh per public path: a hostile contract is allowed to
// be single-use, and reusing one would let an earlier call disarm a later one.
const UNINSPECTABLE = {
  "throwing getter under expected": () => ({ required_output_keys: ["answer"], expected: getterOn("answer") }),
  "throwing getter on required_output_keys": () => getterOn("required_output_keys"),
  "throwing getter on forbidden_substrings": () => getterOn("forbidden_substrings"),
  "nested throwing getter under expected": () => ({ expected: { answer: { deep: getterOn("x") } } }),
  "proxy ownKeys trap throws": () => new Proxy({ required_output_keys: ["answer"] }, { ownKeys: boom }),
  "proxy get trap throws": () => new Proxy({ required_output_keys: ["answer"] }, { get: boom }),
  "proxy getOwnPropertyDescriptor trap throws": () =>
    new Proxy({ required_output_keys: ["answer"] }, { getOwnPropertyDescriptor: boom }),
};

test("T34 an uninspectable contract fails closed on every public path, never throws", () => {
  for (const [label, make] of Object.entries(UNINSPECTABLE)) {
    let v, plan, evaluated, run;
    assert.doesNotThrow(() => (v = validateAcceptanceContract(make())), `${label}: validate must not throw`);
    assert.doesNotThrow(() => (plan = planNode0ModelSwapInvariance({ consent: GO, input: hostileInput(make()) })), `${label}: plan must not throw`);
    assert.doesNotThrow(() => (evaluated = evaluateAgainstContract(GOOD_OUTPUT, make())), `${label}: evaluate must not throw`);
    assert.doesNotThrow(() => (run = runNode0ModelSwapInvariance({ consent: GO, input: hostileInput(make()) })), `${label}: run must not throw`);

    assert.equal(v.valid, false, `${label}: must not be admitted`);
    assert.deepEqual(v.blocked_by, ["contract_uninspectable"], `${label}: one deterministic reason`);
    assert.equal(plan.eligible, false, `${label}: plan must block`);
    assert.ok(plan.blocked_by.includes("contract_uninspectable"), `${label}: plan surfaces the same reason`);
    assert.equal(evaluated.verdict, "REJECT", `${label}: evaluate fails closed`);
    assert.deepEqual(evaluated.failed_requirements, ["contract_uninspectable"], `${label}: evaluate reports it verbatim`);
    assert.equal(run.ok, false, `${label}: no passing proof`);
    assert.equal(run.content_hash, null, `${label}: no PASS-shaped attestation`);
  }
});

test("T34b a trap the kernel never invokes cannot change the verdict", () => {
  // The other half of "inspect once": a contract is snapshotted through Object.keys
  // and a single property read, so a `has` trap is never reached. It must therefore
  // behave EXACTLY like the inert contract it wraps — not throw, and not be refused
  // for carrying a trap nothing calls.
  const plain = { required_output_keys: ["answer"] };
  let hostile;
  assert.doesNotThrow(() => (hostile = validateAcceptanceContract(new Proxy({ ...plain }, { has: boom }))), "has-trap must not escape");
  assert.deepEqual(hostile, validateAcceptanceContract(plain), "an uninvoked trap changes nothing");
});

test("T35 caller-controlled contract state is read exactly once per public call", () => {
  // Containment alone is not enough. On 78962c3 the contract was re-read by the
  // validator, again by evaluate for every candidate, and again by every
  // invariant — so a stateful accessor could show an admissible contract to the
  // planner and a different one to the builder, and the attestation would bind
  // neither. One read, one inert snapshot, is what closes it.
  let reads = 0;
  const contract = { required_output_keys: ["answer"] };
  Object.defineProperty(contract, "expected", {
    enumerable: true,
    get() {
      reads += 1;
      return { answer: reads === 1 ? "42" : "99" };
    },
  });

  const run = runNode0ModelSwapInvariance({ consent: GO, input: hostileInput(contract) });
  assert.equal(reads, 1, `the contract must be inspected once, not ${reads} times`);
  assert.equal(run.ok, true, "the proof is built on the one inert snapshot that was admitted");
});

test("T36 an own __proto__ key is an unknown field, not a silent prototype swap", () => {
  // JSON.parse produces an OWN enumerable `__proto__`. Copying it into a normal
  // object literal sets that object's PROTOTYPE instead of keeping the key, so
  // the unknown-field check sees nothing while predicate counting and evaluation
  // consume the INHERITED predicate — a malformed contract admitted as a proof
  // subject. The snapshot is therefore built prototype-less.
  const contract = JSON.parse('{"__proto__":{"required_output_keys":["answer"]}}');
  assert.ok(Object.keys(contract).includes("__proto__"), "fixture must carry an own __proto__ key");

  const v = validateAcceptanceContract(contract);
  assert.equal(v.valid, false, "a __proto__ field is not a known contract key");
  assert.ok(v.blocked_by.includes("contract_unknown_field:__proto__"), v.blocked_by.join(", "));
  assert.equal(v.effective_predicate_count, 0, "an inherited predicate must never be counted");
  assert.equal(evaluateAgainstContract({ answer: "42" }, contract).verdict, "REJECT");
});

// ── PR #423 audit: the candidate side of the same time-of-check/time-of-use gap ──
//
// The contract is now read once into an inert snapshot. Candidates were not.
// `classifyCandidates` evaluated `cand.output` and then hashed `cand.output`
// through a SECOND read, and every invariant read it again — seven reads per
// build on c6906d0. A stateful candidate could therefore be judged as one value
// and hashed as another, so an ACCEPT row bound bytes that were never accepted.
// That is the attestation's central claim, so it is the load-bearing one.

const SWAP_CONTRACT = { required_output_keys: ["answer"], expected: { answer: "42" } };
const SWAP_GOOD = { answer: "42" };
const SWAP_EVIL = { answer: "99" };

// A candidate whose `output` yields SWAP_GOOD on the first read and SWAP_EVIL
// after — the shape that separates the judged value from the hashed one.
const flippingCandidate = () => {
  const state = { reads: 0 };
  const cand = { model_id: "a" };
  Object.defineProperty(cand, "output", {
    enumerable: true,
    get() {
      state.reads += 1;
      return state.reads === 1 ? SWAP_GOOD : SWAP_EVIL;
    },
  });
  return { cand, state };
};

const swapInput = (candidates) => ({ task: { task_id: "m", acceptance_contract: SWAP_CONTRACT }, candidates });

test("T37 a candidate verdict and its output_hash bind the SAME bytes", async () => {
  const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
  const { cand, state } = flippingCandidate();
  const payload = buildNode0ModelSwapInvariancePayload(swapInput([cand, { model_id: "b", output: SWAP_GOOD }]));

  assert.equal(state.reads, 1, `the candidate output must be read once, not ${state.reads} times`);
  const row = payload.candidates.find((c) => c.model_id === "a");
  assert.equal(row.verdict, "ACCEPT", "the first observed value satisfies the contract");
  assert.equal(row.output_hash, sha256CanonicalJsonV1(SWAP_GOOD), "the row must hash the bytes it judged");
  assert.notEqual(row.output_hash, sha256CanonicalJsonV1(SWAP_EVIL), "never the bytes a later read produced");
  assert.ok(payload.accepted_output_hashes.includes(row.output_hash), "the accepted set carries the judged bytes");
});

test("T38 the reverse order binds too — rejected bytes are the bytes hashed", async () => {
  const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
  let reads = 0;
  const cand = { model_id: "a" };
  Object.defineProperty(cand, "output", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? SWAP_EVIL : SWAP_GOOD;
    },
  });
  const payload = buildNode0ModelSwapInvariancePayload(swapInput([cand, { model_id: "b", output: SWAP_GOOD }]));
  const row = payload.candidates.find((c) => c.model_id === "a");
  assert.equal(row.verdict, "REJECT", "the first observed value fails the contract");
  assert.equal(row.output_hash, sha256CanonicalJsonV1(SWAP_EVIL), "and that is what is hashed");
  assert.ok(!payload.accepted_output_hashes.includes(row.output_hash), "a rejected hash never enters the accepted set");
});

test("T39 an uninspectable candidate fails closed on every public path, never throws", () => {
  const candBoom = () => {
    throw new Error("hostile candidate");
  };
  const shapes = {
    "output getter throws": () => {
      const c = { model_id: "a" };
      Object.defineProperty(c, "output", { enumerable: true, get: candBoom });
      return c;
    },
    "candidate proxy get trap throws": () => new Proxy({ model_id: "a", output: SWAP_GOOD }, { get: candBoom }),
    "candidate proxy descriptor trap throws": () =>
      new Proxy({ model_id: "a", output: SWAP_GOOD }, { getOwnPropertyDescriptor: candBoom }),
    "model_id getter throws": () => {
      const c = { output: SWAP_GOOD };
      Object.defineProperty(c, "model_id", { enumerable: true, get: candBoom });
      return c;
    },
  };
  for (const [label, make] of Object.entries(shapes)) {
    let plan, run;
    assert.doesNotThrow(() => (plan = planNode0ModelSwapInvariance({ consent: GO, input: swapInput([make(), { model_id: "b", output: SWAP_GOOD }]) })), `${label}: plan must not throw`);
    assert.doesNotThrow(() => (run = runNode0ModelSwapInvariance({ consent: GO, input: swapInput([make(), { model_id: "b", output: SWAP_GOOD }]) })), `${label}: run must not throw`);
    assert.equal(plan.eligible, false, `${label}: plan must block`);
    assert.ok(plan.blocked_by.includes("candidate_uninspectable:0"), `${label}: indexed reason — got ${plan.blocked_by.join(", ")}`);
    assert.equal(run.ok, false, `${label}: no passing proof`);
    assert.equal(run.content_hash, null, `${label}: no PASS-shaped attestation`);
  }
});

test("T39b a candidate trap the kernel never invokes cannot change the verdict", () => {
  // The snapshot reads a candidate's two known fields BY NAME — `Object.hasOwn`
  // plus a direct read — and never enumerates the wrapper, so an `ownKeys` trap
  // is outside the read path by construction. It must therefore behave exactly
  // like the inert candidate it wraps: not throw, and not be refused for
  // carrying a trap nothing calls.
  const plain = { model_id: "a", output: SWAP_GOOD };
  const boomTrap = () => {
    throw new Error("hostile candidate");
  };
  let hostile;
  assert.doesNotThrow(
    () => (hostile = runNode0ModelSwapInvariance({ consent: GO, input: swapInput([new Proxy({ ...plain }, { ownKeys: boomTrap }), { model_id: "b", output: SWAP_GOOD }]) })),
    "an uninvoked ownKeys trap must not escape",
  );
  const honest = runNode0ModelSwapInvariance({ consent: GO, input: swapInput([plain, { model_id: "b", output: SWAP_GOOD }]) });
  assert.equal(hostile.ok, honest.ok, "same verdict as the inert candidate");
  assert.equal(hostile.content_hash, honest.content_hash, "and the same attestation bytes");
});

test("T40 a stateful model_id cannot differ between plan and build", () => {
  let reads = 0;
  const cand = { output: SWAP_GOOD };
  Object.defineProperty(cand, "model_id", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? "a" : "b";
    },
  });
  // "b" is also the honest candidate's id: a second read would forge a duplicate
  // model_id into the attestation that the admission gate never saw.
  const run = runNode0ModelSwapInvariance({ consent: GO, input: swapInput([cand, { model_id: "b", output: SWAP_GOOD }]) });
  assert.equal(reads, 1, `model_id must be read once, not ${reads} times`);
  assert.equal(run.ok, true, "one read, one identity, admitted as a real swap");
});

test("T41 field presence is own-property, not inherited", () => {
  // An own `__proto__` DATA property — which JSON.parse produces — is a real
  // canonical field and must satisfy an equivalent predicate. Inherited members
  // are not fields and must never satisfy one.
  const output = JSON.parse('{"__proto__":"value","answer":"42"}');
  assert.deepEqual(Object.keys(output).sort(), ["__proto__", "answer"], "own data properties, not a prototype swap");
  assert.equal(
    evaluateAgainstContract(output, { required_output_keys: ["__proto__"], expected: JSON.parse('{"__proto__":"value"}') }).verdict,
    "ACCEPT",
    "an honest own __proto__ field satisfies its predicate",
  );
  assert.equal(
    evaluateAgainstContract({ answer: "42" }, { required_output_keys: ["toString"] }).verdict,
    "REJECT",
    "an inherited member is not a declared field",
  );
});

// ── PR #423 review: normalisation must not manufacture meaning ──
//
// `raw ?? null` turned an own `output: undefined` — a value OUTSIDE the
// canonical-JSON domain — into canonical `null`, which is inside it. Evaluation
// and hashing then certified a value the candidate never supplied: measured on
// 3fc4739, a candidate with `output: undefined` produced an ACCEPT row carrying
// the canonical hash of null and a verifying attestation. Three states must stay
// distinct: field absent, field present but unrepresentable, field present and
// canonically null.

const NULL_TOLERANT = { forbidden_substrings: ["zzz"] };

test("T42 undefined output is never coerced into canonical null", async () => {
  const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
  const nullHash = sha256CanonicalJsonV1(null);
  const build = (first) =>
    buildNode0ModelSwapInvariancePayload({
      task: { task_id: "m", acceptance_contract: NULL_TOLERANT },
      candidates: [first, { model_id: "b", output: { answer: "42" } }],
    });

  // 1-3. Present but unrepresentable: refused, and never wearing null's hash.
  const undef = build({ model_id: "a", output: undefined }).candidates.find((c) => c.model_id === "a");
  assert.equal(undef.verdict, "REJECT", "undefined is outside the canonical domain");
  assert.deepEqual(undef.failed_requirements, ["output_not_canonicalizable"]);
  assert.equal(undef.output_hash, null, "no hash for a value that cannot be represented");
  assert.notEqual(undef.output_hash, nullHash, "and never the canonical hash of null");

  // 4. Explicit canonical null stays a valid, evaluable value.
  const explicitNull = build({ model_id: "a", output: null }).candidates.find((c) => c.model_id === "a");
  assert.equal(explicitNull.verdict, "ACCEPT", "null IS inside the canonical domain");
  assert.equal(explicitNull.output_hash, nullHash, "and hashes as null");

  // 5. Absent field is not a supplied output.
  const missing = build({ model_id: "a" }).candidates.find((c) => c.model_id === "a");
  assert.equal(missing.verdict, "REJECT", "no output was supplied");
  assert.equal(missing.output_hash, null);
  const plan = planNode0ModelSwapInvariance({
    consent: GO,
    input: { task: { task_id: "m", acceptance_contract: NULL_TOLERANT }, candidates: [{ model_id: "a" }, { model_id: "b", output: { answer: "42" } }] },
  });
  assert.ok(plan.blocked_by.includes("candidate_output_missing:0"), plan.blocked_by.join(", "));

  // The three states must be mutually distinguishable, not merely all-refused.
  assert.notDeepEqual([undef.verdict, undef.output_hash], [explicitNull.verdict, explicitNull.output_hash]);
});

test("T43 an undefined-yielding accessor is read once per call and escapes nothing", () => {
  // A hostile accessor is single-use, so each public entry point gets its own
  // candidate: reusing one would let an earlier call disarm a later one, and the
  // invariant is ONE read per public call, not one read for all time.
  const counting = () => {
    const state = { reads: 0 };
    const cand = { model_id: "a" };
    Object.defineProperty(cand, "output", {
      enumerable: true,
      get() {
        state.reads += 1;
        return undefined;
      },
    });
    return { state, input: { task: { task_id: "m", acceptance_contract: NULL_TOLERANT }, candidates: [cand, { model_id: "b", output: { answer: "42" } }] } };
  };

  const b = counting();
  let payload;
  assert.doesNotThrow(() => (payload = buildNode0ModelSwapInvariancePayload(b.input)), "build must not throw");
  assert.equal(b.state.reads, 1, `build must read once, not ${b.state.reads} times`);
  assert.doesNotThrow(() => verifyNode0ModelSwapInvariance(payload), "verify must not throw");

  const r = counting();
  let run, plan;
  assert.doesNotThrow(() => (plan = planNode0ModelSwapInvariance({ consent: GO, input: counting().input })), "plan must not throw");
  assert.doesNotThrow(() => (run = runNode0ModelSwapInvariance({ consent: GO, input: r.input })), "run must not throw");
  assert.equal(r.state.reads, 1, `run must read once, not ${r.state.reads} times`);

  assert.equal(plan.eligible, true, "an unrepresentable output is a build-time verdict, not an admission defect");
  // run.ok stays TRUE, and that is the honest outcome: a candidate whose output
  // cannot be represented is REJECTED and recorded as such, which is a valid
  // invariance measurement — not a broken proof. What must never happen is the
  // row reading ACCEPT while carrying null's hash; T42 pins that.
  assert.equal(run.ok, true, "a refused candidate is a real measurement, not a failed proof");
  const row = payload.candidates.find((c) => c.model_id === "a");
  assert.equal(row.verdict, "REJECT");
  assert.equal(row.output_hash, null, "refused, and carrying no hash at all");
  assert.ok(!payload.accepted_output_hashes.includes(null), "the accepted set never admits a null hash");
});

test("T16 the honest fixtures stay green after hardening", () => {
  assert.equal(evaluateAgainstContract(GOOD_OUTPUT, CONTRACT).verdict, "ACCEPT");
  assert.equal(planNode0ModelSwapInvariance({ consent: GO, input: VALID }).eligible, true);
  assert.equal(runNode0ModelSwapInvariance({ consent: GO, input: VALID }).ok, true);
  assert.equal(runNode0ModelSwapInvarianceCheck().ok, true);
});
