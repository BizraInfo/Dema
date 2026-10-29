import test from "node:test";
import assert from "node:assert/strict";

import {
  freezeAcceptanceContract,
  verifyFrozenContractConsent,
  evaluateUnknownBudget,
  FROZEN_ACCEPTANCE_CONTRACT_SCHEMA,
  FROZEN_ACCEPTANCE_CONTRACT_TRUTH_LABEL,
} from "../packages/core/src/frozen-acceptance-contract.js";

// A representative multi-step slice plan. The whole object is what gets
// canonicalized and hash-bound, so a single-byte mutation anywhere in it must
// change the contract hash.
function samplePlan() {
  return {
    sliceId: "SLICE-META-GATE-1C",
    parentClosureGoalId: "CLOSURE-NODE0-META-GATE",
    acceptanceCommands: [
      "node --test tests/meta-gate-inventory.test.js",
      "node scripts/review/meta-gate-check.mjs",
    ],
    refusalConditions: [
      "any executableGatePath missing on disk",
      "any negativeControlTestPath missing on disk",
    ],
    steps: [
      { id: "s1", action: "write red-first test for meta-gate inventory" },
      { id: "s2", action: "implement pure meta-gate kernel to green" },
      { id: "s3", action: "add executable rule-to-gate review check" },
    ],
    budgetLimits: { maxModelCalls: 0, maxServiceTransitions: 0, maxUnknowns: 0 },
  };
}

test("positive control: freezes a multi-step plan and verifies exact consent phrase", () => {
  const plan = samplePlan();
  const contract = freezeAcceptanceContract(plan);

  assert.equal(contract.schema, FROZEN_ACCEPTANCE_CONTRACT_SCHEMA);
  assert.equal(contract.truth_label, FROZEN_ACCEPTANCE_CONTRACT_TRUTH_LABEL);
  assert.equal(contract.sliceId, plan.sliceId);
  assert.match(contract.contractHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(
    contract.consentPhrase,
    `APPROVE_CONTRACT ${plan.sliceId} ${contract.contractHash}`,
  );

  // Deterministic: freezing the same plan twice yields the same hash.
  const again = freezeAcceptanceContract(samplePlan());
  assert.equal(again.contractHash, contract.contractHash);

  const verified = verifyFrozenContractConsent({
    contract,
    consentPhrase: contract.consentPhrase,
    rawPlanToVerify: samplePlan(),
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.reason, "CONTRACT_CONSENT_VERIFIED");
  assert.equal(verified.boundary.runtimeActivated, false);
  assert.equal(verified.boundary.networkCalled, false);
  assert.equal(verified.boundary.authorityDelta, 0);
});

test("negative control 1: a one-byte plan mutation fails closed REFUSED_CONTRACT_HASH_MISMATCH", () => {
  const plan = samplePlan();
  const contract = freezeAcceptanceContract(plan);

  const tamperedStep = samplePlan();
  tamperedStep.steps[1].action = "implement pure meta-gate kernel to greeN"; // one byte flipped
  const r1 = verifyFrozenContractConsent({
    contract,
    consentPhrase: contract.consentPhrase,
    rawPlanToVerify: tamperedStep,
  });
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, "REFUSED_CONTRACT_HASH_MISMATCH");

  const tamperedCommand = samplePlan();
  tamperedCommand.acceptanceCommands[0] =
    "node --test tests/meta-gate-inventory.test.j"; // dropped one byte
  const r2 = verifyFrozenContractConsent({
    contract,
    consentPhrase: contract.consentPhrase,
    rawPlanToVerify: tamperedCommand,
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "REFUSED_CONTRACT_HASH_MISMATCH");
});

test("negative control 2: wrong or missing consent phrase fails closed REFUSED_EXACT_CONSENT_MISMATCH", () => {
  const plan = samplePlan();
  const contract = freezeAcceptanceContract(plan);

  const altered = verifyFrozenContractConsent({
    contract,
    consentPhrase: `APPROVE_CONTRACT ${plan.sliceId} sha256:deadbeef`,
    rawPlanToVerify: samplePlan(),
  });
  assert.equal(altered.ok, false);
  assert.equal(altered.reason, "REFUSED_EXACT_CONSENT_MISMATCH");

  const missing = verifyFrozenContractConsent({
    contract,
    rawPlanToVerify: samplePlan(),
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "REFUSED_EXACT_CONSENT_MISMATCH");

  // Trailing whitespace is not an exact match.
  const padded = verifyFrozenContractConsent({
    contract,
    consentPhrase: `${contract.consentPhrase} `,
    rawPlanToVerify: samplePlan(),
  });
  assert.equal(padded.ok, false);
  assert.equal(padded.reason, "REFUSED_EXACT_CONSENT_MISMATCH");
});

test("freeze and verify detach nested caller data (edit-and-retry safe)", () => {
  const plan = samplePlan();
  plan.steps[0].inputs = { nested: ["keep-me-mutable"] };
  plan.budgetLimits.extra = { cap: 1 };

  const contract = freezeAcceptanceContract(plan);
  assert.ok(Object.isFrozen(contract.canonicalPlan));
  assert.ok(Object.isFrozen(contract.canonicalPlan.steps[0]));

  // Caller still owns mutable nested objects after freeze.
  plan.steps[0].inputs.nested.push("after-freeze");
  plan.budgetLimits.extra.cap = 2;
  assert.equal(plan.steps[0].inputs.nested[1], "after-freeze");
  assert.equal(plan.budgetLimits.extra.cap, 2);

  // Failed verify must not freeze the caller's nested objects either.
  const retryPlan = samplePlan();
  retryPlan.steps[0].inputs = { nested: ["retry"] };
  const mismatch = verifyFrozenContractConsent({
    contract,
    consentPhrase: contract.consentPhrase,
    rawPlanToVerify: retryPlan,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, "REFUSED_CONTRACT_HASH_MISMATCH");
  retryPlan.steps[0].inputs.nested.push("after-mismatch");
  assert.equal(retryPlan.steps[0].inputs.nested[1], "after-mismatch");
});

test("negative control 3: unknown budget exhaustion freezes at FREEZE_STOP_AT_UNKNOWN", () => {
  const exhausted = evaluateUnknownBudget({
    unresolvedUnknowns: ["port_7421_vs_7770"],
    maxUnknowns: 0,
  });
  assert.equal(exhausted.status, "FREEZE_STOP_AT_UNKNOWN");
  assert.equal(exhausted.mayProceed, false);
  assert.equal(exhausted.boundary.authorityDelta, 0);

  const withinBudget = evaluateUnknownBudget({
    unresolvedUnknowns: [],
    maxUnknowns: 0,
  });
  assert.equal(withinBudget.status, "WITHIN_UNKNOWN_BUDGET");
  assert.equal(withinBudget.mayProceed, true);

  const underCap = evaluateUnknownBudget({
    unresolvedUnknowns: ["one"],
    maxUnknowns: 2,
  });
  assert.equal(underCap.status, "WITHIN_UNKNOWN_BUDGET");
  assert.equal(underCap.mayProceed, true);
});
