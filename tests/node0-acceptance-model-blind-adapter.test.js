// ACCEPTANCE-MODEL-BLIND-ADAPTER-1A — the first closure invariant with a real
// evidence adapter. Every test here exists to keep it from becoming the second
// NODE0-SOURCE-LISTENER-SCAN-1A: an instrument that looked narrow and settled
// something broad.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  acceptanceModelBlindObservation,
  ACCEPTANCE_MODEL_BLIND_INVARIANT_ID,
  ACCEPTANCE_MODEL_BLIND_SCOPE,
} from "../packages/core/src/node0-acceptance-model-blind-adapter.js";
import {
  buildNode0ModelSwapInvariancePayload,
  NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
} from "../packages/core/src/node0-model-swap-invariance.js";
import {
  evaluateNode0ClosureInvariants,
  CLOSURE_INVARIANTS,
  INVARIANT_STATUS,
} from "../packages/core/src/node0-closure-invariants.js";

const CONTRACT = Object.freeze({
  required_output_keys: ["answer"],
  forbidden_substrings: ["I cannot"],
  expected: { answer: 42 },
});

/// Two DIFFERENT models, one producing a passing output and one a failing one.
/// A swap must actually occur or invariance is vacuously true.
function swapInput({ carry_contract = true, carry_outputs = true } = {}) {
  return {
    task: { task_id: "amb-fixture", acceptance_contract: CONTRACT },
    candidates: [
      { model_id: "model-a", output: { answer: 42 } },
      { model_id: "model-b", output: { answer: 41 } },
    ],
    transport: { carry_contract, carry_outputs },
  };
}

test("AMB-01 a verdict-reproduced attestation settles the invariant, scoped", () => {
  const payload = buildNode0ModelSwapInvariancePayload(swapInput());
  const observation = acceptanceModelBlindObservation(payload);

  assert.ok(observation, "the strongest tier must produce evidence");
  assert.equal(observation.observed, true);
  assert.equal(observation.scope, ACCEPTANCE_MODEL_BLIND_SCOPE);
  // The source must bind to the exact attestation, not merely name the kernel.
  assert.match(observation.source, /NODE0-MODEL-SWAP-INVARIANCE-1A/);
  assert.match(observation.source, new RegExp(payload.content_hash));

  // And it must actually satisfy the row in the ledger.
  const report = evaluateNode0ClosureInvariants({
    [ACCEPTANCE_MODEL_BLIND_INVARIANT_ID]: observation,
  });
  const row = report.invariants.find((r) => r.id === ACCEPTANCE_MODEL_BLIND_INVARIANT_ID);
  assert.equal(row.status, INVARIANT_STATUS.SATISFIED);
  // One of ten is not closure.
  assert.equal(report.satisfied_count, 1);
  assert.equal(report.verdict, "OPEN");
});

test("AMB-02 a weaker tier returns null — evidence omitted is evidence absent", () => {
  // THE TASK-060 RULE, applied here. If the envelope does not carry the contract
  // and the outputs, the verifier cannot re-run the acceptance decision; it can
  // only confirm the rows are self-consistent. That is not model-blindness, and
  // a builder must not be able to reach SATISFIED by carrying LESS.
  for (const transport of [
    { carry_contract: false, carry_outputs: false },
    { carry_contract: true, carry_outputs: false },
    { carry_contract: false, carry_outputs: true },
  ]) {
    const payload = buildNode0ModelSwapInvariancePayload(swapInput(transport));
    assert.equal(
      acceptanceModelBlindObservation(payload),
      null,
      `transport ${JSON.stringify(transport)} must not settle the invariant`,
    );
  }
});

test("AMB-03 NEGATIVE CONTROL — tampering, failure, and a missing swap all return null", () => {
  const payload = buildNode0ModelSwapInvariancePayload(swapInput());

  // Rehashing a forged body keeps it internally consistent; the verifier's own
  // re-derivation is what catches it, and the adapter must honour that.
  assert.equal(
    acceptanceModelBlindObservation({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }),
    null,
  );
  assert.equal(acceptanceModelBlindObservation({ ...payload, schema: "other.v0.1" }), null);
  assert.equal(
    acceptanceModelBlindObservation({
      ...payload,
      invariants: { ...payload.invariants, no_identity_laundering: false, all_hold: false },
    }),
    null,
  );

  // One model is not a swap. The attestation is structurally valid and every
  // invariance flag holds vacuously — exactly the shape that reads as proof.
  const oneModel = buildNode0ModelSwapInvariancePayload({
    task: { task_id: "amb-one", acceptance_contract: CONTRACT },
    candidates: [{ model_id: "only-one", output: { answer: 42 } }],
    transport: { carry_contract: true, carry_outputs: true },
  });
  assert.equal(acceptanceModelBlindObservation(oneModel), null, "no swap, no proof");

  for (const bad of [null, undefined, {}, [], "attestation", 7]) {
    assert.equal(acceptanceModelBlindObservation(bad), null);
  }
});

test("AMB-04 a vacuous contract cannot settle the invariant", () => {
  // An empty contract accepts every output, so the verdict is uniform and
  // model-independence holds without anything having been judged.
  const vacuous = buildNode0ModelSwapInvariancePayload({
    task: { task_id: "amb-vacuous", acceptance_contract: {} },
    candidates: [
      { model_id: "model-a", output: { answer: 42 } },
      { model_id: "model-b", output: { answer: 41 } },
    ],
    transport: { carry_contract: true, carry_outputs: true },
  });
  assert.equal(acceptanceModelBlindObservation(vacuous), null);
});

test("AMB-05 the adapter cannot address any other invariant or scope", () => {
  // Scope discipline at the source. An adapter that could choose its own target
  // would reintroduce exactly the routing failure TASK-060 closed.
  assert.equal(ACCEPTANCE_MODEL_BLIND_INVARIANT_ID, "acceptance_is_model_blind");
  const canon = CLOSURE_INVARIANTS.find((i) => i.id === ACCEPTANCE_MODEL_BLIND_INVARIANT_ID);
  assert.equal(ACCEPTANCE_MODEL_BLIND_SCOPE, canon.required_scope);

  const observation = acceptanceModelBlindObservation(
    buildNode0ModelSwapInvariancePayload(swapInput()),
  );
  // The observation is frozen, so a caller cannot re-point it at another row.
  assert.ok(Object.isFrozen(observation));
  assert.throws(() => {
    "use strict";
    observation.scope = "node0_deployment_remote_write";
  });

  // And it settles nothing else if a caller files it under the wrong id.
  const misfiled = evaluateNode0ClosureInvariants({ remote_write: observation });
  const row = misfiled.invariants.find((r) => r.id === "remote_write");
  assert.equal(row.status, INVARIANT_STATUS.UNKNOWN);
  assert.equal(row.reason, "observation_scope_mismatch");
});

test("AMB-06 the attestation schema is pinned, so a lookalike envelope is refused", () => {
  assert.equal(
    buildNode0ModelSwapInvariancePayload(swapInput()).schema,
    NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
  );
});
