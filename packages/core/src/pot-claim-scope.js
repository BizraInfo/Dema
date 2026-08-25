// POT-CLAIM-SCOPE-0A — pure four-scope Proof-of-Truth claim evaluator.
//
// This is a structural promotion contract, not a live proof engine. It accepts
// caller-supplied evidence descriptors and an explicit evaluation time, then
// enforces the fixed COMPONENT / ROUTE / MISSION / RESPONSIBILITY requirements.
// It never reads evidence, starts a clock, invokes a provider, or changes state.
//
// The existing proof-convergence preview remains illustrative. The existing
// flywheel convergence verifier remains receipt-chain specific. This slice is
// the small, generic scope guard between those distinct truth surfaces.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const POT_CLAIM_SCOPE_SCHEMA = "bizra.dema.pot_claim_scope.v0.1";
export const POT_CLAIM_SCOPE_TRUTH_LABEL = "POT_CLAIM_SCOPE_MEASURED_REPO";
export const POT_CLAIM_SCOPE_GO_PHRASE = "GO: pot claim scope preview";

export const POT_CLAIM_SCOPES = Object.freeze([
  "COMPONENT",
  "ROUTE",
  "MISSION",
  "RESPONSIBILITY",
]);

export const POT_RAILS = Object.freeze([
  "formal_contract",
  "integrity_binding",
  "empirical_observation",
  "economic_value",
]);

const RAIL_STATUSES = new Set([
  "PASS",
  "FAIL",
  "HOLD",
  "UNKNOWN",
  "NOT_APPLICABLE",
  "MEASUREMENT_PENDING",
]);
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const BOUNDARY_KEYS = Object.freeze([
  "execution_allowed",
  "daemon_started",
  "network_used",
  "token_minted",
  "wallet_accessed",
  "live_execution_performed",
  "file_mutation_performed",
  "model_invocation_performed",
]);

const SCOPE_RULES = Object.freeze({
  COMPONENT: Object.freeze({
    identity: Object.freeze([
      "component_id",
      "component_version",
      "source_digest",
      "evaluation_digest",
      "environment_identity",
    ]),
    required_rails: Object.freeze([
      "formal_contract",
      "integrity_binding",
      "empirical_observation",
    ]),
    fresh_rails: Object.freeze(["empirical_observation"]),
    resulting_statuses: Object.freeze(["COMPONENT_VERIFIED"]),
  }),
  ROUTE: Object.freeze({
    identity: Object.freeze([
      "release_digest",
      "mr_revision_digest",
      "route_descriptor_digest",
      "provider_id",
      "model_id",
      "adapter_digest",
      "authority_scope_digest",
    ]),
    required_rails: Object.freeze([
      "formal_contract",
      "integrity_binding",
      "empirical_observation",
    ]),
    fresh_rails: Object.freeze(["empirical_observation"]),
    resulting_statuses: Object.freeze(["ROUTE_VERIFIED"]),
  }),
  MISSION: Object.freeze({
    identity: Object.freeze([
      "mission_id",
      "mission_contract_digest",
      "release_digest",
      "mr_revision_digest",
      "authority_scope_digest",
      "approved_input_digest",
      "run_id",
      "worker_identity",
      "verifier_id",
      "receipt_digest",
    ]),
    required_rails: Object.freeze([
      "formal_contract",
      "integrity_binding",
      "empirical_observation",
    ]),
    fresh_rails: Object.freeze(["empirical_observation"]),
    resulting_statuses: Object.freeze(["MISSION_VERIFIED"]),
  }),
  RESPONSIBILITY: Object.freeze({
    identity: Object.freeze([
      "responsibility_id",
      "mission_template_digest",
      "release_digest",
      "mr_revision_digest",
      "authority_scope_digest",
      "verifier_id",
      "receipt_digest",
    ]),
    required_rails: Object.freeze([
      "formal_contract",
      "integrity_binding",
      "empirical_observation",
      "economic_value",
    ]),
    fresh_rails: Object.freeze([
      "empirical_observation",
      "economic_value",
    ]),
    resulting_statuses: Object.freeze(["VRO_CANDIDATE", "VRO_CONVERGED"]),
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function validIdentityValue(key, value) {
  return key.endsWith("_digest") ? SHA256.test(value) : nonEmptyString(value);
}

function parseIso(value) {
  if (!nonEmptyString(value) || !ISO_TIME.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function potClaimScopeBoundary() {
  return Object.freeze({
    ...Object.fromEntries(BOUNDARY_KEYS.map((key) => [key, false])),
  });
}

export { potClaimScopeBoundary };

function scopeResult({ scope, verdict, reasons, resulting_status, evaluation_at }) {
  return deepFreeze({
    schema: POT_CLAIM_SCOPE_SCHEMA,
    truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
    scope,
    verdict,
    resulting_status,
    reasons: Object.freeze([...reasons]),
    evaluation_at: evaluation_at ?? null,
    authority_delta: 0,
    boundary: potClaimScopeBoundary(),
  });
}

function scopeAndRule(claim, failures, holds) {
  if (!isPlainObject(claim)) {
    addReason(holds, "claim_missing_or_malformed");
    return { scope: null, rule: null };
  }
  if (!Object.hasOwn(claim, "scope")) {
    addReason(holds, "claim_scope_missing");
    return { scope: null, rule: null };
  }
  const scope = claim.scope;
  const rule = SCOPE_RULES[scope];
  if (!rule) addReason(failures, "claim_scope_unknown");
  return { scope, rule: rule ?? null };
}

function checkIdentity(claim, rule, failures, holds) {
  if (!isPlainObject(claim.identity)) {
    addReason(holds, "identity_missing_or_malformed");
    return null;
  }
  for (const key of rule.identity) {
    if (!Object.hasOwn(claim.identity, key)) {
      addReason(holds, `identity_missing:${key}`);
    } else if (!validIdentityValue(key, claim.identity[key])) {
      addReason(failures, `identity_malformed:${key}`);
    }
  }
  const binding = claim.identity.causal_binding_digest;
  if (!Object.hasOwn(claim.identity, "causal_binding_digest")) {
    addReason(holds, "identity_missing:causal_binding_digest");
    return null;
  }
  if (!SHA256.test(binding)) {
    addReason(failures, "identity_malformed:causal_binding_digest");
    return null;
  }
  return binding;
}

function checkFreshness({ rail, evidence, evaluation, failures, holds }) {
  const evaluationAt = parseIso(evaluation?.evaluation_at);
  if (evaluationAt === null) {
    addReason(holds, "evaluation_time_missing_or_malformed");
    return;
  }
  if (!Object.hasOwn(evidence, "observed_at") || !Object.hasOwn(evidence, "max_age_ms")) {
    addReason(holds, `freshness_missing:${rail}`);
    return;
  }
  const observedAt = parseIso(evidence.observed_at);
  if (observedAt === null || !Number.isSafeInteger(evidence.max_age_ms) || evidence.max_age_ms < 0) {
    addReason(failures, `freshness_malformed:${rail}`);
    return;
  }
  if (observedAt > evaluationAt || evaluationAt - observedAt > evidence.max_age_ms) {
    addReason(holds, `freshness_stale:${rail}`);
  }
}

function checkRequiredRail({
  claim,
  rail,
  binding,
  evaluation,
  fresh,
  failures,
  holds,
}) {
  const evidence = claim.rails?.[rail];
  if (!isPlainObject(evidence)) {
    addReason(holds, `rail_missing:${rail}`);
    return;
  }
  if (!RAIL_STATUSES.has(evidence.status)) {
    addReason(failures, `rail_status_malformed:${rail}`);
    return;
  }
  if (evidence.status === "FAIL") {
    addReason(failures, `rail_failed:${rail}`);
    return;
  }
  if (evidence.status === "NOT_APPLICABLE") {
    addReason(failures, `rail_not_applicable:${rail}`);
    return;
  }
  if (evidence.status !== "PASS") {
    addReason(holds, `rail_not_pass:${rail}:${evidence.status}`);
    return;
  }
  if (!SHA256.test(evidence.evidence_digest)) {
    addReason(holds, `rail_evidence_missing_or_malformed:${rail}`);
  }
  if (!SHA256.test(evidence.causal_binding_digest)) {
    addReason(holds, `rail_binding_missing_or_malformed:${rail}`);
  } else if (binding && evidence.causal_binding_digest !== binding) {
    addReason(failures, `causal_binding_mismatch:${rail}`);
  }
  if (fresh) checkFreshness({ rail, evidence, evaluation, failures, holds });
}

function checkMissionEconomicPlan(claim, binding, failures, holds) {
  const evidence = claim.rails?.economic_value;
  if (!isPlainObject(evidence)) {
    addReason(holds, "rail_missing:economic_value");
  } else if (!RAIL_STATUSES.has(evidence.status)) {
    addReason(failures, "rail_status_malformed:economic_value");
  } else if (evidence.status === "NOT_APPLICABLE") {
    addReason(failures, "rail_not_applicable:economic_value");
  } else if (evidence.status !== "MEASUREMENT_PENDING" && evidence.status !== "PASS") {
    addReason(holds, `economic_measurement_not_ready:${evidence.status}`);
  } else if (evidence.status === "PASS") {
    if (!SHA256.test(evidence.evidence_digest) || !SHA256.test(evidence.causal_binding_digest)) {
      addReason(holds, "rail_evidence_missing_or_malformed:economic_value");
    } else if (binding && evidence.causal_binding_digest !== binding) {
      addReason(failures, "causal_binding_mismatch:economic_value");
    }
  }

  const plan = claim.economic_measurement_plan;
  const fields = [
    "manual_baseline",
    "node0_burden",
    "false_positive_burden",
    "operational_cost",
    "compute_cost",
    "measurement_window",
  ];
  if (!isPlainObject(plan)) {
    addReason(holds, "economic_measurement_plan_missing_or_malformed");
    return;
  }
  for (const field of fields) {
    if (!nonEmptyString(plan[field])) addReason(holds, `economic_measurement_plan_missing:${field}`);
  }
}

function checkRouteRecovery(claim, failures, holds) {
  const recovery = claim.recovery;
  if (!isPlainObject(recovery)) {
    addReason(holds, "route_failure_policy_missing_or_malformed");
    return;
  }
  const exact = {
    timeout_policy: "BOUNDED",
    retry_policy: "BOUNDED",
    duplicate_call_handling: "DECLARED",
  };
  for (const [field, expected] of Object.entries(exact)) {
    if (recovery[field] !== expected) addReason(failures, `route_failure_policy_invalid:${field}`);
  }
  if (!["DISABLED", "EXPLICIT"].includes(recovery.fallback_policy)) {
    addReason(failures, "route_failure_policy_invalid:fallback_policy");
  }
}

function checkRecovery({ claim, scope, binding, evaluation, failures, holds }) {
  const recovery = claim.recovery;
  if (scope === "ROUTE") {
    checkRouteRecovery(claim, failures, holds);
    return;
  }

  const required = scope === "RESPONSIBILITY" || recovery?.required === true;
  if (!required) return;
  if (!isPlainObject(recovery)) {
    addReason(holds, "recovery_missing_or_malformed");
    return;
  }
  if (recovery.status === "FAIL") {
    addReason(failures, "recovery_failed");
    return;
  }
  if (recovery.status !== "PASS") {
    addReason(holds, `recovery_not_pass:${recovery.status ?? "MISSING"}`);
    return;
  }
  if (!SHA256.test(recovery.evidence_digest) || !SHA256.test(recovery.causal_binding_digest)) {
    addReason(holds, "recovery_evidence_missing_or_malformed");
  } else if (binding && recovery.causal_binding_digest !== binding) {
    addReason(failures, "causal_binding_mismatch:recovery");
  }
  if (scope === "RESPONSIBILITY") {
    checkFreshness({ rail: "recovery", evidence: recovery, evaluation, failures, holds });
  }
}

function checkContradictions(claim, failures, holds) {
  const contradictions = claim.verification?.contradictions;
  if (!Array.isArray(contradictions)) {
    addReason(holds, "verification_contradictions_missing_or_malformed");
  } else if (contradictions.length > 0) {
    addReason(failures, "contradictions_present");
  }
}

function requestedStatus(claim, scope, rule, failures, holds) {
  const requested = claim.promotion?.requested;
  if (!requested) return scope === "RESPONSIBILITY" ? "VRO_CANDIDATE" : rule.resulting_statuses[0];
  if (!rule.resulting_statuses.includes(requested)) {
    addReason(failures, "promotion_scope_escalation");
    return null;
  }
  if (scope === "RESPONSIBILITY" && requested === "VRO_CONVERGED") {
    const completedRuns = claim.recurrence?.completed_runs;
    const burdenRemoved = claim.economic_measurement?.burden_removed;
    if (!Number.isSafeInteger(completedRuns) || completedRuns < 2) {
      addReason(holds, "responsibility_recurrence_not_established");
    }
    if (typeof burdenRemoved !== "number" || !Number.isFinite(burdenRemoved)) {
      addReason(holds, "economic_burden_removed_missing_or_malformed");
    } else if (burdenRemoved <= 0) {
      addReason(failures, "economic_burden_not_positive");
    }
  }
  return requested;
}

// The authoritative pure evaluator. `evaluation.evaluation_at` is required by
// every fresh rail and supplied by the caller; this module never reads a clock.
export function evaluatePotClaimScope({ claim, evaluation } = {}) {
  const failures = [];
  const holds = [];
  const { scope, rule } = scopeAndRule(claim, failures, holds);
  if (!rule) {
    const verdict = failures.length ? "FAIL" : "HOLD";
    return scopeResult({
      scope,
      verdict,
      resulting_status: null,
      reasons: [...failures, ...holds],
      evaluation_at: evaluation?.evaluation_at,
    });
  }

  const binding = checkIdentity(claim, rule, failures, holds);
  for (const rail of rule.required_rails) {
    checkRequiredRail({
      claim,
      rail,
      binding,
      evaluation,
      fresh: rule.fresh_rails.includes(rail),
      failures,
      holds,
    });
  }
  if (scope === "MISSION") checkMissionEconomicPlan(claim, binding, failures, holds);
  checkRecovery({ claim, scope, binding, evaluation, failures, holds });
  checkContradictions(claim, failures, holds);
  const status = requestedStatus(claim, scope, rule, failures, holds);

  const verdict = failures.length ? "FAIL" : holds.length ? "HOLD" : "PASS";
  return scopeResult({
    scope,
    verdict,
    resulting_status: verdict === "PASS" ? status : null,
    reasons: [...failures, ...holds],
    evaluation_at: evaluation?.evaluation_at,
  });
}

function validInput(input) {
  return isPlainObject(input) && isPlainObject(input.claim) && isPlainObject(input.evaluation);
}

export function planPotClaimScope({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== POT_CLAIM_SCOPE_GO_PHRASE) addReason(blocked_by, "consent_phrase_mismatch");
  if (!validInput(input)) addReason(blocked_by, "input_missing_or_malformed");
  return Object.freeze({
    schema: POT_CLAIM_SCOPE_SCHEMA,
    truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildPotClaimScopePayload(input) {
  const decision = evaluatePotClaimScope(input);
  const body = {
    schema: POT_CLAIM_SCOPE_SCHEMA,
    truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    decision,
    boundary: potClaimScopeBoundary(),
    authority_delta: 0,
  };
  return deepFreeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

export function verifyPotClaimScope(payload) {
  const blocked_by = [];
  if (!isPlainObject(payload)) addReason(blocked_by, "payload_missing_or_malformed");
  if (blocked_by.length === 0) {
    const { content_hash, ...body } = payload;
    if (!SHA256.test(content_hash)) addReason(blocked_by, "content_hash_missing_or_malformed");
    else {
      try {
        if (sha256CanonicalJsonV1(body) !== content_hash) addReason(blocked_by, "content_hash_mismatch");
      } catch {
        addReason(blocked_by, "payload_not_canonicalizable");
      }
    }
    if (payload.schema !== POT_CLAIM_SCOPE_SCHEMA) addReason(blocked_by, "schema_mismatch");
    if (payload.truth_label !== POT_CLAIM_SCOPE_TRUTH_LABEL) addReason(blocked_by, "truth_label_mismatch");
    if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) addReason(blocked_by, "canonicalization_algorithm_mismatch");
    if (payload.authority_delta !== 0) addReason(blocked_by, "authority_delta_nonzero");
    if (
      !isPlainObject(payload.boundary) ||
      Object.keys(payload.boundary).length !== BOUNDARY_KEYS.length ||
      !BOUNDARY_KEYS.every((key) => payload.boundary[key] === false)
    ) addReason(blocked_by, "boundary_not_all_false");
    try {
      const expected = evaluatePotClaimScope(payload.input);
      if (sha256CanonicalJsonV1(expected) !== sha256CanonicalJsonV1(payload.decision)) {
        addReason(blocked_by, "decision_rederivation_mismatch");
      }
    } catch {
      addReason(blocked_by, "decision_not_canonicalizable");
    }
  }
  return deepFreeze({
    ok: blocked_by.length === 0,
    schema: POT_CLAIM_SCOPE_SCHEMA,
    truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
    content_hash: isPlainObject(payload) ? payload.content_hash ?? null : null,
    boundary: potClaimScopeBoundary(),
    authority_delta: 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function runPotClaimScope({ consent, input } = {}) {
  const plan = planPotClaimScope({ consent, input });
  if (!plan.eligible) {
    return deepFreeze({
      ok: false,
      schema: POT_CLAIM_SCOPE_SCHEMA,
      truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
      content_hash: null,
      decision: null,
      boundary: potClaimScopeBoundary(),
      authority_delta: 0,
      blocked_by: plan.blocked_by,
    });
  }
  try {
    const payload = buildPotClaimScopePayload(input);
    const verification = verifyPotClaimScope(payload);
    const tampered = verifyPotClaimScope({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
    const decisionPasses = payload.decision.verdict === "PASS";
    const blocked_by = [
      ...verification.blocked_by,
      ...(tampered.ok ? ["tamper_control_accepted"] : []),
      ...(decisionPasses ? [] : [`claim_verdict:${payload.decision.verdict}`]),
    ];
    return deepFreeze({
      ok: blocked_by.length === 0,
      schema: POT_CLAIM_SCOPE_SCHEMA,
      truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
      content_hash: payload.content_hash,
      decision: payload.decision,
      boundary: potClaimScopeBoundary(),
      authority_delta: 0,
      blocked_by: Object.freeze(blocked_by),
    });
  } catch {
    return deepFreeze({
      ok: false,
      schema: POT_CLAIM_SCOPE_SCHEMA,
      truth_label: POT_CLAIM_SCOPE_TRUTH_LABEL,
      content_hash: null,
      decision: null,
      boundary: potClaimScopeBoundary(),
      authority_delta: 0,
      blocked_by: Object.freeze(["payload_build_or_verify_failed"]),
    });
  }
}
