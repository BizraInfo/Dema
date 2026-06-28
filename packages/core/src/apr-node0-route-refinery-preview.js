// APR-NODE0-ROUTE-REFINERY-PREVIEW-1A
//
// Preview-only route refinery over AASR route previews. It critiques and
// improves route eligibility signals; it does not execute any route.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildAasrNode0StateRouterPreview,
  verifyAasrNode0StateRouterPreview,
  AASR_NODE0_STATE_ROUTER_SCHEMA,
} from "./aasr-node0-state-router-preview.js";

export const APR_NODE0_ROUTE_REFINERY_SCHEMA =
  "bizra.node0.apr_route_refinery_preview.v0.1";
export const APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL =
  "APR_NODE0_ROUTE_REFINERY_PREVIEW_ONLY";
export const APR_NODE0_ROUTE_REFINERY_STAGE =
  "APR_NODE0_AASR_ROUTE_REFINEMENT_PREVIEW";

const DEFAULT_PROOF_REQUIREMENTS = Object.freeze({
  required_route_fields: Object.freeze([
    "normalized_claim",
    "snr_decision",
    "pat_sat_route",
    "consent_state",
    "compliance_state",
    "chained_state_block_preview",
  ]),
  minimum_snr_score: 0.85,
  require_state_block_hash: true,
  require_pat_sat_refs: true,
});

const DEFAULT_RISK_POLICY = Object.freeze({
  action_blockers: Object.freeze([
    "boundary_not_all_false",
    "no_preview_artifact_to_route",
    "consent_missing_for_state_transition",
  ]),
  high_risk_blockers: Object.freeze([
    "boundary_not_all_false",
    "file_mutation_performed",
    "urp_write_performed",
    "state_written",
  ]),
});

const DEFAULT_CONSENT_POLICY = Object.freeze({
  require_exact_consent_before_action: true,
  execution_allowed_must_remain_false: true,
});

const DEFAULT_IMPROVEMENT_POLICY = Object.freeze({
  minimum_route_quality_score: 0.85,
  overclaim_fragments: Object.freeze([
    "executed",
    "renamed",
    "moved",
    "merged",
    "deleted",
    "content read",
    "token minted",
    "wallet accessed",
    "urp submitted",
    "daemon started",
    "autonomous action performed",
    "runtime autonomy",
    "live apr",
    "live rsi",
    "reward issued",
  ]),
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function previewHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function aprBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    scan_executed: false,
    route_execution_performed: false,
    file_mutation_performed: false,
    file_content_read: false,
    ocr_performed: false,
    embedding_generated: false,
    network_used: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    transfer_performed: false,
    daemon_started: false,
    model_invocation_performed: false,
    autonomous_action_performed: false,
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((value) => value === false);
}

function routeId(route) {
  return (
    route?.chained_state_block_preview?.block_preview_hash ??
    previewHash({
      schema: route?.schema ?? null,
      claim: route?.normalized_claim ?? null,
      verdict: route?.final_router_verdict ?? null,
    })
  );
}

function buildProofGapAnalysis(route, proofRequirements) {
  const requirements = {
    ...DEFAULT_PROOF_REQUIREMENTS,
    ...(proofRequirements ?? {}),
  };
  const requiredFields = requirements.required_route_fields ?? [];
  const missingFields = requiredFields.filter((field) => route?.[field] == null);
  const routeVerification = verifyAasrNode0StateRouterPreview(route);
  const stateHash = route?.chained_state_block_preview?.block_preview_hash;
  const hashOk =
    requirements.require_state_block_hash !== true ||
    /^sha256:[0-9a-f]{64}$/.test(stateHash ?? "");
  const patSatOk =
    requirements.require_pat_sat_refs !== true ||
    (Array.isArray(route?.pat_sat_route?.refs) && route.pat_sat_route.refs.length > 0);
  const snrScore = Number(route?.snr_decision?.score ?? 0);
  const snrOk = snrScore >= Number(requirements.minimum_snr_score ?? 0);
  const gaps = Object.freeze([
    ...missingFields.map((field) => `missing_route_field:${field}`),
    ...(routeVerification.ok ? [] : routeVerification.blocked_by),
    ...(hashOk ? [] : ["missing_or_invalid_state_block_hash"]),
    ...(patSatOk ? [] : ["missing_pat_sat_refs"]),
    ...(snrOk ? [] : ["snr_below_required_threshold"]),
  ]);

  return freezeDeep({
    ok: gaps.length === 0,
    required_route_fields: Object.freeze([...requiredFields]),
    missing_fields: Object.freeze(missingFields),
    route_schema_ok: route?.schema === AASR_NODE0_STATE_ROUTER_SCHEMA,
    route_verified: routeVerification.ok,
    route_verifier_blocked_by: routeVerification.blocked_by,
    state_block_hash_ok: hashOk,
    pat_sat_refs_ok: patSatOk,
    snr_score: snrScore,
    minimum_snr_score: Number(requirements.minimum_snr_score ?? 0),
    blocked_by: gaps,
  });
}

function buildConsentGapAnalysis(route, consentPolicy) {
  const policy = { ...DEFAULT_CONSENT_POLICY, ...(consentPolicy ?? {}) };
  const collected = route?.consent_state?.collected === true;
  const executionAllowed = route?.consent_state?.execution_allowed === true;
  const gaps = Object.freeze([
    ...(policy.require_exact_consent_before_action && !collected
      ? ["exact_consent_missing_before_action"]
      : []),
    ...(policy.execution_allowed_must_remain_false && executionAllowed
      ? ["execution_allowed_true"]
      : []),
  ]);

  return freezeDeep({
    ok: gaps.length === 0,
    collected,
    exact_consent_required_before_action:
      policy.require_exact_consent_before_action === true,
    execution_allowed: executionAllowed,
    execution_allowed_must_remain_false:
      policy.execution_allowed_must_remain_false === true,
    blocked_by: gaps,
  });
}

function buildRiskGapAnalysis(route, boundaries, riskPolicy) {
  const policy = { ...DEFAULT_RISK_POLICY, ...(riskPolicy ?? {}) };
  const routeBlockers = Array.isArray(route?.blocked_by) ? route.blocked_by : [];
  const highRiskBlockers = routeBlockers.filter((code) =>
    policy.high_risk_blockers?.includes(code),
  );
  const actionBlockers = routeBlockers.filter((code) =>
    policy.action_blockers?.includes(code),
  );
  const boundaryOk = boundaryAllFalse(boundaries) && boundaryAllFalse(route?.boundaries);
  const riskLevel = !boundaryOk || highRiskBlockers.length > 0
    ? "high"
    : actionBlockers.length > 0
      ? "medium"
      : "low";
  const gaps = Object.freeze([
    ...(boundaryOk ? [] : ["boundary_not_all_false"]),
    ...highRiskBlockers.map((code) => `high_risk_route_blocker:${code}`),
    ...actionBlockers.map((code) => `action_blocker:${code}`),
  ]);

  return freezeDeep({
    ok: riskLevel === "low",
    risk_level: riskLevel,
    route_blockers: Object.freeze([...routeBlockers]),
    high_risk_blockers: Object.freeze(highRiskBlockers),
    action_blockers: Object.freeze(actionBlockers),
    boundary_ok: boundaryOk,
    blocked_by: gaps,
  });
}

function buildOverclaimAnalysis(route, improvementPolicy) {
  const policy = { ...DEFAULT_IMPROVEMENT_POLICY, ...(improvementPolicy ?? {}) };
  const claim = String(route?.normalized_claim ?? "").toLowerCase();
  const fragments = policy.overclaim_fragments ?? [];
  const matches = fragments.filter((fragment) =>
    claim.includes(String(fragment).toLowerCase()),
  );

  return freezeDeep({
    ok: matches.length === 0,
    checked_claim: claim,
    forbidden_fragments: Object.freeze([...fragments]),
    matched_fragments: Object.freeze(matches),
    blocked_by: Object.freeze(
      matches.map((fragment) => `overclaim_fragment:${fragment}`),
    ),
  });
}

function scoreRoute({
  proofGapAnalysis,
  consentGapAnalysis,
  riskGapAnalysis,
  overclaimAnalysis,
  boundaries,
}) {
  const score =
    (proofGapAnalysis.ok ? 0.25 : 0) +
    (consentGapAnalysis.ok ? 0.25 : 0) +
    (riskGapAnalysis.ok ? 0.25 : 0) +
    (overclaimAnalysis.ok ? 0.15 : 0) +
    (boundaryAllFalse(boundaries) ? 0.1 : 0);
  return Number(score.toFixed(4));
}

function buildRecommendedAdjustments({
  proofGapAnalysis,
  consentGapAnalysis,
  riskGapAnalysis,
  overclaimAnalysis,
}) {
  return Object.freeze([
    ...(proofGapAnalysis.ok
      ? []
      : [{
          adjustment: "attach_missing_route_proof_before_action_eligibility",
          blocked_by: proofGapAnalysis.blocked_by,
        }]),
    ...(consentGapAnalysis.ok
      ? []
      : [{
          adjustment: "collect_exact_preview_consent_before_action_eligibility",
          blocked_by: consentGapAnalysis.blocked_by,
        }]),
    ...(riskGapAnalysis.ok
      ? []
      : [{
          adjustment: "reduce_route_risk_before_action_eligibility",
          blocked_by: riskGapAnalysis.blocked_by,
        }]),
    ...(overclaimAnalysis.ok
      ? []
      : [{
          adjustment: "reduce_claim_to_preview_safe_language",
          blocked_by: overclaimAnalysis.blocked_by,
        }]),
  ].map(freezeDeep));
}

function safeNextAction({
  routeQualityScore,
  proofGapAnalysis,
  consentGapAnalysis,
  riskGapAnalysis,
  overclaimAnalysis,
  improvementPolicy,
}) {
  const threshold = Number(
    improvementPolicy?.minimum_route_quality_score ??
      DEFAULT_IMPROVEMENT_POLICY.minimum_route_quality_score,
  );
  if (!proofGapAnalysis.route_schema_ok) return "repair_aasr_route_schema_first";
  if (!riskGapAnalysis.boundary_ok) return "reject_route_until_boundaries_are_false";
  if (!overclaimAnalysis.ok) return "reduce_claim_to_preview_safe_language";
  if (!consentGapAnalysis.ok) {
    return "collect_exact_preview_consent_before_action_eligibility";
  }
  if (!proofGapAnalysis.ok) return "attach_required_route_proof_fields";
  return routeQualityScore >= threshold
    ? "route_refined_for_human_review_only"
    : "improve_route_quality_before_action_eligibility";
}

function buildRefinementBlock({
  previousStateHash,
  inputRouteId,
  routeQualityScore,
  proofGapAnalysis,
  consentGapAnalysis,
  riskGapAnalysis,
  overclaimAnalysis,
  safeNextActionRecommendation,
  boundaries,
}) {
  const block = {
    previous_state_hash: previousStateHash,
    input_route_id: inputRouteId,
    route_quality_score: routeQualityScore,
    proof_ok: proofGapAnalysis.ok,
    consent_ok: consentGapAnalysis.ok,
    risk_ok: riskGapAnalysis.ok,
    overclaim_ok: overclaimAnalysis.ok,
    safe_next_action_recommendation: safeNextActionRecommendation,
    boundaries,
  };
  return freezeDeep({
    previous_state_hash: previousStateHash,
    block_preview_hash: previewHash(block),
    verification_result: "APR_ROUTE_REFINEMENT_BLOCK_HASHED",
    refinement_written: false,
    route_execution_performed: false,
  });
}

function verificationResult(blockedBy) {
  return Object.freeze({
    ok: blockedBy.length === 0,
    blocked_by: Object.freeze([...blockedBy]),
  });
}

export function buildAprNode0RouteRefineryPreview({
  aasr_route_preview = buildAasrNode0StateRouterPreview(),
  proof_requirements = DEFAULT_PROOF_REQUIREMENTS,
  risk_policy = DEFAULT_RISK_POLICY,
  consent_policy = DEFAULT_CONSENT_POLICY,
  improvement_policy = DEFAULT_IMPROVEMENT_POLICY,
  previous_state_hash = "sha256:apr-route-refinery-preview-genesis",
  boundary = aprBoundary(),
} = {}) {
  const boundaries = freezeDeep({ ...aprBoundary(), ...boundary });
  const input_route_id = routeId(aasr_route_preview);
  const proof_gap_analysis = buildProofGapAnalysis(
    aasr_route_preview,
    proof_requirements,
  );
  const consent_gap_analysis = buildConsentGapAnalysis(
    aasr_route_preview,
    consent_policy,
  );
  const risk_gap_analysis = buildRiskGapAnalysis(
    aasr_route_preview,
    boundaries,
    risk_policy,
  );
  const overclaim_analysis = buildOverclaimAnalysis(
    aasr_route_preview,
    improvement_policy,
  );
  const route_quality_score = scoreRoute({
    proofGapAnalysis: proof_gap_analysis,
    consentGapAnalysis: consent_gap_analysis,
    riskGapAnalysis: risk_gap_analysis,
    overclaimAnalysis: overclaim_analysis,
    boundaries,
  });
  const recommended_route_adjustments = buildRecommendedAdjustments({
    proofGapAnalysis: proof_gap_analysis,
    consentGapAnalysis: consent_gap_analysis,
    riskGapAnalysis: risk_gap_analysis,
    overclaimAnalysis: overclaim_analysis,
  });
  const safe_next_action_recommendation = safeNextAction({
    routeQualityScore: route_quality_score,
    proofGapAnalysis: proof_gap_analysis,
    consentGapAnalysis: consent_gap_analysis,
    riskGapAnalysis: risk_gap_analysis,
    overclaimAnalysis: overclaim_analysis,
    improvementPolicy: improvement_policy,
  });
  const blocked_by = Object.freeze([
    ...proof_gap_analysis.blocked_by,
    ...consent_gap_analysis.blocked_by,
    ...risk_gap_analysis.blocked_by,
    ...overclaim_analysis.blocked_by,
    ...(boundaryAllFalse(boundaries) ? [] : ["boundary_not_all_false"]),
  ]);
  const chained_refinement_block_preview = buildRefinementBlock({
    previousStateHash: previous_state_hash,
    inputRouteId: input_route_id,
    routeQualityScore: route_quality_score,
    proofGapAnalysis: proof_gap_analysis,
    consentGapAnalysis: consent_gap_analysis,
    riskGapAnalysis: risk_gap_analysis,
    overclaimAnalysis: overclaim_analysis,
    safeNextActionRecommendation: safe_next_action_recommendation,
    boundaries,
  });

  return freezeDeep({
    schema: APR_NODE0_ROUTE_REFINERY_SCHEMA,
    truth_label: APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL,
    refinery_stage: APR_NODE0_ROUTE_REFINERY_STAGE,
    input_route_id,
    route_quality_score,
    proof_gap_analysis,
    consent_gap_analysis,
    risk_gap_analysis,
    overclaim_analysis,
    recommended_route_adjustments,
    safe_next_action_recommendation,
    blocked_by,
    chained_refinement_block_preview,
    boundaries,
    what_this_proves: Object.freeze([
      "APR can critique an AASR route preview before any action becomes eligible.",
      "The refinery can separate proof, consent, risk, and overclaim gaps into deterministic preview recommendations.",
      "The refinement block can be content-addressed without writing state or executing a route.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "APR did not execute a route, mutate files, read content, invoke a model, write URP state, mint tokens, access a wallet, transfer value, start a daemon, or perform autonomous action.",
      "APR did not prove live RSI, federation, reward, economic settlement, or runtime autonomy.",
    ]),
  });
}

export function verifyAprNode0RouteRefineryPreview(report) {
  const blocked_by = [];

  if (!report || report.schema !== APR_NODE0_ROUTE_REFINERY_SCHEMA) {
    blocked_by.push("invalid_schema");
    return verificationResult(blocked_by);
  }
  if (report.truth_label !== APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.refinery_stage !== APR_NODE0_ROUTE_REFINERY_STAGE) {
    blocked_by.push("invalid_refinery_stage");
  }
  if (!/^sha256:/.test(report.input_route_id ?? "")) {
    blocked_by.push("missing_input_route_id");
  }
  if (typeof report.route_quality_score !== "number") {
    blocked_by.push("missing_route_quality_score");
  }
  if (!report.proof_gap_analysis || !report.consent_gap_analysis) {
    blocked_by.push("missing_gap_analysis");
  }
  if (!report.risk_gap_analysis || !report.overclaim_analysis) {
    blocked_by.push("missing_risk_or_overclaim_analysis");
  }
  if (!Array.isArray(report.recommended_route_adjustments)) {
    blocked_by.push("missing_recommended_route_adjustments");
  }
  if (!report.safe_next_action_recommendation) {
    blocked_by.push("missing_safe_next_action_recommendation");
  }
  if (!boundaryAllFalse(report.boundaries)) {
    blocked_by.push("boundary_not_all_false");
  }
  if (!/^sha256:/.test(
    report.chained_refinement_block_preview?.block_preview_hash ?? "",
  )) {
    blocked_by.push("missing_refinement_block_hash");
  }
  if (report.chained_refinement_block_preview?.refinement_written !== false) {
    blocked_by.push("refinement_written");
  }
  if (
    report.chained_refinement_block_preview?.route_execution_performed !== false
  ) {
    blocked_by.push("route_execution_performed");
  }
  if (report.boundaries?.model_invocation_performed !== false) {
    blocked_by.push("model_invocation_performed");
  }
  if (report.boundaries?.autonomous_action_performed !== false) {
    blocked_by.push("autonomous_action_performed");
  }

  return verificationResult(blocked_by);
}

export function runAprNode0RouteRefineryPreviewGate() {
  const report = buildAprNode0RouteRefineryPreview();
  const verified = verifyAprNode0RouteRefineryPreview(report);
  return freezeDeep({
    ok: verified.ok,
    schema: APR_NODE0_ROUTE_REFINERY_SCHEMA,
    truth_label: APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL,
    verified,
    input_route_id: report.input_route_id,
    route_quality_score: report.route_quality_score,
    safe_next_action_recommendation: report.safe_next_action_recommendation,
    report,
  });
}
