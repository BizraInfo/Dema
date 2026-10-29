// FROZEN-ACCEPTANCE-CONTRACT-1A — pure kernel. PREVIEW_ONLY · NOT ML · NOT runtime.
//
// Binds an acceptance contract to its full plan by a canonical SHA-256 hash and
// to a single exact consent phrase. The point is to make consent HASH-BOUND: an
// operator approving `APPROVE_CONTRACT <sliceId> <contractHash>` is approving
// exactly the plan that hashes to <contractHash>, nothing else. A one-byte
// mutation of the plan changes the hash and fails verification closed; a wrong
// or missing phrase fails verification closed. This kernel also evaluates the
// unresolved-unknown budget: when unknowns exceed the cap it returns a freeze,
// so work stops at the first unknown rather than proceeding on a guess.
//
// This kernel invokes no model, opens no network, and activates no runtime. A
// verified contract consent is a consent-matching PREVIEW, never an execution
// authorization: the plan must still pass its own gates before anything runs.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const FROZEN_ACCEPTANCE_CONTRACT_SCHEMA =
  "bizra.dema.frozen_acceptance_contract.v0.1";
export const FROZEN_ACCEPTANCE_CONTRACT_TRUTH_LABEL =
  "FROZEN_ACCEPTANCE_CONTRACT_PREVIEW_ONLY";

const CONSENT_PREFIX = "APPROVE_CONTRACT";

const boundary = () =>
  Object.freeze({ runtimeActivated: false, networkCalled: false, authorityDelta: 0 });

const nonEmptyString = (v) => typeof v === "string" && v.length > 0;

// Build the canonical frozen body from a plan. Every field that matters to the
// contract is included, so the hash covers the whole plan. Arrays preserve
// order (step order is part of the plan). Canonicalization is delegated to
// packages/canon so the hash is stable and byte-faithful.
function canonicalPlanBody(plan) {
  return {
    sliceId: plan?.sliceId ?? null,
    parentClosureGoalId: plan?.parentClosureGoalId ?? null,
    acceptanceCommands: Array.isArray(plan?.acceptanceCommands)
      ? [...plan.acceptanceCommands]
      : [],
    refusalConditions: Array.isArray(plan?.refusalConditions)
      ? [...plan.refusalConditions]
      : [],
    steps: Array.isArray(plan?.steps) ? plan.steps.map((s) => ({ ...s })) : [],
    budgetLimits: { ...(plan?.budgetLimits ?? {}) },
  };
}

function contractHashFor(plan) {
  return sha256CanonicalJsonV1(canonicalPlanBody(plan));
}

// Freeze a plan into an acceptance contract: canonical hash + the single exact
// consent phrase the operator must type to approve this exact plan.
export function freezeAcceptanceContract(plan) {
  if (!nonEmptyString(plan?.sliceId)) {
    throw new Error("freezeAcceptanceContract: sliceId is required");
  }
  const contractHash = contractHashFor(plan);
  const consentPhrase = `${CONSENT_PREFIX} ${plan.sliceId} ${contractHash}`;
  return Object.freeze({
    schema: FROZEN_ACCEPTANCE_CONTRACT_SCHEMA,
    truth_label: FROZEN_ACCEPTANCE_CONTRACT_TRUTH_LABEL,
    sliceId: plan.sliceId,
    parentClosureGoalId: plan.parentClosureGoalId ?? null,
    canonicalPlan: Object.freeze(canonicalPlanBody(plan)),
    contractHash,
    consentPhrase,
    boundary: boundary(),
  });
}

// Verify consent against the frozen contract. Fails closed on either axis:
//   - the re-derived hash of rawPlanToVerify must equal the frozen
//     contractHash (REFUSED_CONTRACT_HASH_MISMATCH), and
//   - the supplied consentPhrase must be an EXACT, byte-for-byte match of the
//     contract's consentPhrase (REFUSED_EXACT_CONSENT_MISMATCH).
// The hash check runs first so a tampered plan is rejected even if the phrase
// is copied from the original contract.
export function verifyFrozenContractConsent({
  contract,
  consentPhrase,
  rawPlanToVerify,
} = {}) {
  const base = { sliceId: contract?.sliceId ?? null, boundary: boundary() };

  if (!contract || !nonEmptyString(contract.contractHash) || !nonEmptyString(contract.consentPhrase)) {
    return Object.freeze({ ...base, ok: false, reason: "REFUSED_MALFORMED_CONTRACT" });
  }

  const rederivedHash = contractHashFor(rawPlanToVerify);
  if (rederivedHash !== contract.contractHash) {
    return Object.freeze({
      ...base,
      ok: false,
      reason: "REFUSED_CONTRACT_HASH_MISMATCH",
      rederived_hash: rederivedHash,
      expected_hash: contract.contractHash,
    });
  }

  if (consentPhrase !== contract.consentPhrase) {
    return Object.freeze({ ...base, ok: false, reason: "REFUSED_EXACT_CONSENT_MISMATCH" });
  }

  return Object.freeze({
    ...base,
    ok: true,
    reason: "CONTRACT_CONSENT_VERIFIED",
    contractHash: contract.contractHash,
  });
}

// Evaluate the unresolved-unknown budget. When the count of unresolved unknowns
// exceeds maxUnknowns, return a freeze so work stops at the first unknown
// rather than proceeding on a guess.
export function evaluateUnknownBudget(state) {
  const unresolved = Array.isArray(state?.unresolvedUnknowns)
    ? state.unresolvedUnknowns
    : [];
  const maxUnknowns = Number.isInteger(state?.maxUnknowns) ? state.maxUnknowns : 0;
  const overBudget = unresolved.length > maxUnknowns;

  return Object.freeze({
    schema: FROZEN_ACCEPTANCE_CONTRACT_SCHEMA,
    truth_label: FROZEN_ACCEPTANCE_CONTRACT_TRUTH_LABEL,
    status: overBudget ? "FREEZE_STOP_AT_UNKNOWN" : "WITHIN_UNKNOWN_BUDGET",
    mayProceed: !overBudget,
    unresolvedUnknownCount: unresolved.length,
    maxUnknowns,
    unresolvedUnknowns: Object.freeze([...unresolved]),
    boundary: boundary(),
  });
}
