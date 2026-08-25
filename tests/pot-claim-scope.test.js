import test from "node:test";
import assert from "node:assert/strict";

import {
  POT_CLAIM_SCOPE_GO_PHRASE,
  POT_CLAIM_SCOPE_SCHEMA,
  POT_CLAIM_SCOPE_TRUTH_LABEL,
  buildPotClaimScopePayload,
  evaluatePotClaimScope,
  planPotClaimScope,
  runPotClaimScope,
  verifyPotClaimScope,
} from "../packages/core/src/pot-claim-scope.js";
import { runPotClaimScopeCheck } from "../scripts/review/pot-claim-scope-check.mjs";

const DIGEST = (hex) => `sha256:${hex.repeat(64).slice(0, 64)}`;
const BINDING = DIGEST("a");
const EVIDENCE = DIGEST("b");
const EVALUATION = Object.freeze({ evaluation_at: "2026-08-23T18:00:00Z" });
const FRESH = Object.freeze({ observed_at: "2026-08-23T17:59:00Z", max_age_ms: 120000 });

function rail(status = "PASS", extra = {}) {
  return { status, evidence_digest: EVIDENCE, causal_binding_digest: BINDING, ...extra };
}

function componentClaim(overrides = {}) {
  return {
    scope: "COMPONENT",
    identity: {
      component_id: "pot-claim-scope",
      component_version: "0.1",
      source_digest: DIGEST("c"),
      evaluation_digest: DIGEST("d"),
      environment_identity: "fixture",
      causal_binding_digest: BINDING,
    },
    rails: {
      formal_contract: rail(),
      integrity_binding: rail(),
      empirical_observation: rail("PASS", FRESH),
      economic_value: rail("NOT_APPLICABLE"),
    },
    recovery: { required: false, status: "NOT_APPLICABLE" },
    verification: { contradictions: [] },
    promotion: { requested: "COMPONENT_VERIFIED" },
    ...overrides,
  };
}

function routeClaim(overrides = {}) {
  return {
    scope: "ROUTE",
    identity: {
      release_digest: DIGEST("c"),
      mr_revision_digest: DIGEST("d"),
      route_descriptor_digest: DIGEST("e"),
      provider_id: "llama-cpp-local",
      model_id: "gemma4-12b",
      adapter_digest: DIGEST("f"),
      authority_scope_digest: DIGEST("1"),
      causal_binding_digest: BINDING,
    },
    rails: {
      formal_contract: rail(),
      integrity_binding: rail(),
      empirical_observation: rail("PASS", FRESH),
      economic_value: rail("NOT_APPLICABLE"),
    },
    recovery: {
      timeout_policy: "BOUNDED",
      retry_policy: "BOUNDED",
      fallback_policy: "DISABLED",
      duplicate_call_handling: "DECLARED",
    },
    verification: { contradictions: [] },
    promotion: { requested: "ROUTE_VERIFIED" },
    ...overrides,
  };
}

function missionClaim(overrides = {}) {
  return {
    scope: "MISSION",
    identity: {
      mission_id: "mission:fixture",
      mission_contract_digest: DIGEST("c"),
      release_digest: DIGEST("d"),
      mr_revision_digest: DIGEST("e"),
      authority_scope_digest: DIGEST("f"),
      approved_input_digest: DIGEST("1"),
      run_id: "run:fixture",
      worker_identity: "worker:fixture",
      verifier_id: "sat:fixture",
      receipt_digest: DIGEST("2"),
      causal_binding_digest: BINDING,
    },
    rails: {
      formal_contract: rail(),
      integrity_binding: rail(),
      empirical_observation: rail("PASS", FRESH),
      economic_value: rail("MEASUREMENT_PENDING"),
    },
    economic_measurement_plan: {
      manual_baseline: "minutes per approved root audit",
      node0_burden: "human review minutes",
      false_positive_burden: "false delta count",
      operational_cost: "operator remediation minutes",
      compute_cost: "local process duration",
      measurement_window: "three comparable runs",
    },
    recovery: { required: false, status: "NOT_APPLICABLE" },
    verification: { contradictions: [] },
    promotion: { requested: "MISSION_VERIFIED" },
    ...overrides,
  };
}

function responsibilityClaim(overrides = {}) {
  return {
    scope: "RESPONSIBILITY",
    identity: {
      responsibility_id: "responsibility:estate-map",
      mission_template_digest: DIGEST("c"),
      release_digest: DIGEST("d"),
      mr_revision_digest: DIGEST("e"),
      authority_scope_digest: DIGEST("f"),
      verifier_id: "sat:fixture",
      receipt_digest: DIGEST("1"),
      causal_binding_digest: BINDING,
    },
    rails: {
      formal_contract: rail(),
      integrity_binding: rail(),
      empirical_observation: rail("PASS", FRESH),
      economic_value: rail("PASS", FRESH),
    },
    recovery: { required: true, status: "PASS", evidence_digest: EVIDENCE, causal_binding_digest: BINDING, ...FRESH },
    verification: { contradictions: [] },
    recurrence: { completed_runs: 2 },
    economic_measurement: { burden_removed: 1 },
    promotion: { requested: "VRO_CONVERGED" },
    ...overrides,
  };
}

function input(claim = componentClaim(), evaluation = EVALUATION) {
  return { claim, evaluation };
}

test("red-first contract closes: exact-consent plan and review fixture are green", () => {
  const plan = planPotClaimScope({ consent: POT_CLAIM_SCOPE_GO_PHRASE, input: input() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
  const result = runPotClaimScopeCheck();
  assert.equal(result.ok, true, result.blocked_by.join(", "));
  assert.equal(result.decision.resulting_status, "COMPONENT_VERIFIED");
});

test("payload is canonical, re-derivable, all-false, and authority-zero", () => {
  const payload = buildPotClaimScopePayload(input());
  assert.equal(payload.schema, POT_CLAIM_SCOPE_SCHEMA);
  assert.equal(payload.truth_label, POT_CLAIM_SCOPE_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyPotClaimScope(payload).ok, true);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.authority_delta, 0);
});

test("hash, label, and incomplete-boundary tampering fail verification", () => {
  const payload = buildPotClaimScopePayload(input());
  assert.equal(verifyPotClaimScope({ ...payload, content_hash: DIGEST("0") }).ok, false);
  assert.equal(verifyPotClaimScope({ ...payload, truth_label: "FORGED" }).ok, false);
  const boundary = { ...payload.boundary };
  delete boundary.network_used;
  const result = verifyPotClaimScope({ ...payload, boundary });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("boundary_not_all_false"));
});

test("unknown scopes fail closed and model-supplied required-rail overrides do nothing", () => {
  const unknown = evaluatePotClaimScope(input({ ...componentClaim(), scope: "AGENT_DECIDES" }));
  assert.equal(unknown.verdict, "FAIL");
  assert.ok(unknown.reasons.includes("claim_scope_unknown"));

  const override = evaluatePotClaimScope(input({
    ...componentClaim(),
    required_rails: [],
    rails: { economic_value: rail("NOT_APPLICABLE") },
  }));
  assert.equal(override.verdict, "HOLD");
  assert.ok(override.reasons.includes("rail_missing:formal_contract"));
});

test("UNKNOWN holds and permitted NOT_APPLICABLE does not masquerade as UNKNOWN", () => {
  const component = evaluatePotClaimScope(input(componentClaim({
    rails: { ...componentClaim().rails, economic_value: rail("NOT_APPLICABLE") },
  })));
  assert.equal(component.verdict, "PASS");

  const unknown = evaluatePotClaimScope(input(componentClaim({
    rails: { ...componentClaim().rails, empirical_observation: rail("UNKNOWN") },
  })));
  assert.equal(unknown.verdict, "HOLD");
  assert.ok(unknown.reasons.includes("rail_not_pass:empirical_observation:UNKNOWN"));
});

test("explicit causal mismatch and contradiction fail rather than promote", () => {
  const mismatch = evaluatePotClaimScope(input(componentClaim({
    rails: { ...componentClaim().rails, integrity_binding: rail("PASS", { causal_binding_digest: DIGEST("9") }) },
  })));
  assert.equal(mismatch.verdict, "FAIL");
  assert.ok(mismatch.reasons.includes("causal_binding_mismatch:integrity_binding"));

  const contradicted = evaluatePotClaimScope(input(componentClaim({ verification: { contradictions: ["provider mismatch"] } })));
  assert.equal(contradicted.verdict, "FAIL");
  assert.ok(contradicted.reasons.includes("contradictions_present"));
});

test("freshness is caller-supplied: missing or stale empirical evidence holds", () => {
  const missingTime = evaluatePotClaimScope(input(componentClaim(), {}));
  assert.equal(missingTime.verdict, "HOLD");
  assert.ok(missingTime.reasons.includes("evaluation_time_missing_or_malformed"));

  const stale = evaluatePotClaimScope(input(componentClaim({
    rails: { ...componentClaim().rails, empirical_observation: rail("PASS", { observed_at: "2026-08-23T17:00:00Z", max_age_ms: 1 }) },
  })));
  assert.equal(stale.verdict, "HOLD");
  assert.ok(stale.reasons.includes("freshness_stale:empirical_observation"));
});

test("COMPONENT and ROUTE cannot promote beyond their exact scope", () => {
  const component = evaluatePotClaimScope(input(componentClaim({ promotion: { requested: "RESPONSIBILITY_VERIFIED" } })));
  assert.equal(component.verdict, "FAIL");
  assert.ok(component.reasons.includes("promotion_scope_escalation"));

  const route = evaluatePotClaimScope(input(routeClaim({ promotion: { requested: "MISSION_VERIFIED" } })));
  assert.equal(route.verdict, "FAIL");
  assert.ok(route.reasons.includes("promotion_scope_escalation"));
});

test("signed/integrity-bound mission without observed execution holds", () => {
  const result = evaluatePotClaimScope(input(missionClaim({
    rails: { ...missionClaim().rails, empirical_observation: rail("UNKNOWN") },
  })));
  assert.equal(result.verdict, "HOLD");
  assert.ok(result.reasons.includes("rail_not_pass:empirical_observation:UNKNOWN"));
});

test("MISSION requires an economic measurement plan but does not self-promote to responsibility", () => {
  const missingPlan = evaluatePotClaimScope(input(missionClaim({ economic_measurement_plan: {} })));
  assert.equal(missingPlan.verdict, "HOLD");
  assert.ok(missingPlan.reasons.includes("economic_measurement_plan_missing:manual_baseline"));

  const escalate = evaluatePotClaimScope(input(missionClaim({ promotion: { requested: "VRO_CONVERGED" } })));
  assert.equal(escalate.verdict, "FAIL");
  assert.ok(escalate.reasons.includes("promotion_scope_escalation"));

  const unknownEconomic = evaluatePotClaimScope(input(missionClaim({
    rails: { ...missionClaim().rails, economic_value: rail("UNKNOWN") },
  })));
  assert.equal(unknownEconomic.verdict, "HOLD");
  assert.ok(unknownEconomic.reasons.includes("economic_measurement_not_ready:UNKNOWN"));
});

test("RESPONSIBILITY requires all rails, recovery, repetition, and positive burden removal", () => {
  const good = evaluatePotClaimScope(input(responsibilityClaim()));
  assert.equal(good.verdict, "PASS");
  assert.equal(good.resulting_status, "VRO_CONVERGED");

  const oneRun = evaluatePotClaimScope(input(responsibilityClaim({ recurrence: { completed_runs: 1 } })));
  assert.equal(oneRun.verdict, "HOLD");
  assert.ok(oneRun.reasons.includes("responsibility_recurrence_not_established"));

  const noValue = evaluatePotClaimScope(input(responsibilityClaim({ economic_measurement: { burden_removed: 0 } })));
  assert.equal(noValue.verdict, "FAIL");
  assert.ok(noValue.reasons.includes("economic_burden_not_positive"));

  const noRecovery = evaluatePotClaimScope(input(responsibilityClaim({ recovery: { required: true, status: "UNKNOWN" } })));
  assert.equal(noRecovery.verdict, "HOLD");
  assert.ok(noRecovery.reasons.includes("recovery_not_pass:UNKNOWN"));
});

test("run remains pure and reports non-pass claims without consuming authority", () => {
  const result = runPotClaimScope({
    consent: POT_CLAIM_SCOPE_GO_PHRASE,
    input: input(componentClaim({ rails: { ...componentClaim().rails, empirical_observation: rail("UNKNOWN") } })),
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("claim_verdict:HOLD"));
  assert.equal(result.boundary.model_invocation_performed, false);
  assert.equal(result.authority_delta, 0);
});
