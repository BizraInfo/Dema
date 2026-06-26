// POI-RECEIPT-ELIGIBILITY-1A — pre-token PoI receipt eligibility plan preview.
//
// Composes URP contribution benefit preview (#267) with shareability and
// historical verification signals into proof-plan requirements: what receipt,
// evidence, witness, hash, benchmark, or SAT review would strengthen eligibility.
// No token mint, no wallet, no URP submission, no upload, no SAT settlement.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
} from "./urp-contribution-benefit-preview.js";
import {
  HOMEBASE_SHAREABILITY_SCHEMA,
  HOMEBASE_SHAREABILITY_TRUTH_LABEL,
} from "./homebase-shareability.js";
import {
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
} from "./node0-historical-contribution-verification.js";

export const POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA =
  "bizra.dema.poi_receipt_eligibility_plan.v0.1";
export const POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL =
  "POI_RECEIPT_ELIGIBILITY_PLAN_PREVIEW_ONLY";

const PROOF_ARTIFACT_TYPES = Object.freeze([
  "metadata_boundary_receipt",
  "pat_action_receipt",
  "content_hash_attestation",
  "git_time_span_evidence",
  "canon_witness_marker",
  "hardware_benchmark_summary",
  "sat_independent_review",
  "explicit_typed_consent_record",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "Benefit preview outputs can be translated into explicit proof-plan requirements before any live PoI or URP settlement.",
  "Blocked or consent-gated resources are separated from resources that may strengthen eligibility with additional evidence.",
  "Historical git span and canon witness gaps can be listed as plan items without reading file content.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No PoI receipt was minted, signed, chained, or settled.",
  "No SAT verification runtime, URP submission, upload, wallet access, or token mint occurred.",
  "Proof plans are advisory previews — not acceptance, not guarantees, not legal or financial advice.",
  "Content hashes and benchmarks are listed as future requirements only; none were computed in this pass.",
  "Strengthened eligibility bands remain preview-only caps, not earned rewards.",
]);

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function bandRank(band) {
  const ranks = { none: 0, low: 1, medium: 2, high: 3 };
  return ranks[band] ?? 0;
}

function strengthenedBand(current, delta) {
  const order = ["none", "low", "medium", "high"];
  const idx = Math.min(
    order.length - 1,
    Math.max(0, order.indexOf(current) + delta),
  );
  return order[idx];
}

function buildProofArtifacts(resource, historical) {
  if (resource.shareability_level === "blocked_do_not_share") {
    return Object.freeze([]);
  }
  const artifacts = new Set(["metadata_boundary_receipt"]);
  if (resource.contribution_class === "impact") {
    artifacts.add("pat_action_receipt");
  }
  if (resource.requires_future_consent) {
    artifacts.add("explicit_typed_consent_record");
  }
  if (
    resource.shareability_level === "shareable_with_consent" ||
    resource.shareability_level === "content_consent_required"
  ) {
    artifacts.add("content_hash_attestation");
  }
  if (resource.contribution_class === "hardware") {
    artifacts.add("hardware_benchmark_summary");
  }
  if (resource.contribution_class === "knowledge_product") {
    artifacts.add("git_time_span_evidence");
  }
  if ((historical?.canon_witnesses?.length ?? 0) > 0) {
    artifacts.add("canon_witness_marker");
  }
  if (
    resource.possible_benefit_classes?.includes("SAT_review_needed") ||
    resource.sat_verification?.required === true
  ) {
    artifacts.add("sat_independent_review");
  }
  return freezeDeep([...artifacts].sort());
}

function buildResourceReceiptPlan(resource, historical) {
  const blocked = resource.shareability_level === "blocked_do_not_share";
  const proof_artifacts_required = buildProofArtifacts(resource, historical);
  const strengthens_to =
    blocked || resource.estimated_eligibility_band === "none"
      ? "none"
      : strengthenedBand(resource.estimated_eligibility_band, 1);

  return Object.freeze({
    resource_id: resource.resource_id,
    top_level: resource.top_level,
    contribution_class: resource.contribution_class,
    shareability_level: resource.shareability_level,
    current_eligibility_band: resource.estimated_eligibility_band,
    strengthens_eligibility_to_preview: strengthens_to,
    proof_artifacts_required,
    consent_required: resource.consent_required ?? "none",
    proof_required: resource.proof_required ?? "not_applicable",
    requires_sat_review:
      proof_artifacts_required.includes("sat_independent_review"),
    requires_explicit_consent: resource.requires_future_consent === true,
    blocked,
    benefit_estimate_allowed: resource.benefit_estimate !== null,
    what_remains_not_proven: freezeDeep(
      blocked
        ? ["shareability_blocked", "no_proof_plan_execution"]
        : [
            "live_poi_receipt_mint",
            "sat_settlement",
            "urp_acceptance",
            "content_hash_computation",
            "guaranteed_reward",
          ],
    ),
    preview_only: true,
  });
}

function buildGlobalProofGaps(historical, benefit_preview) {
  const gaps = [];
  const git = historical?.time_span_evidence;
  if (!git?.is_git_repository) {
    gaps.push("git_repository_at_root");
  } else if ((git.commits_in_window ?? 0) === 0) {
    gaps.push("git_commits_in_lookback_window");
  }
  for (const witness of historical?.canon_witnesses ?? []) {
    if (!witness.present) gaps.push(`canon_witness:${witness.id}`);
  }
  for (const flag of historical?.uncertainty_flags ?? []) {
    if (
      [
        "token_rails_not_live",
        "urp_reward_settlement_not_live",
        "no_canon_witness_paths_present",
      ].includes(flag)
    ) {
      gaps.push(flag);
    }
  }
  if ((benefit_preview?.scores?.aggregate_eligibility_score ?? 0) < 25) {
    gaps.push("aggregate_benefit_eligibility_low");
  }
  return freezeDeep([...new Set(gaps)].sort());
}

function buildSatVerificationPlan(benefit_preview) {
  const needsSat = (benefit_preview?.resource_previews ?? []).some(
    (r) =>
      r.sat_verification?.required === true &&
      r.estimated_eligibility_band !== "none",
  );
  return Object.freeze({
    required: needsSat,
    status: "DESIGNED_NOT_LIVE",
    note:
      "SAT independent review would be required before live reward settlement — preview only",
    preview_only: true,
  });
}

function buildBoundary(extra = {}) {
  return freezeDeep({
    ...buildPreviewBoundary(),
    ...extra,
    file_content_read: false,
    network_used: false,
    scanned_root_mutated: false,
    token_minted: false,
    wallet_accessed: false,
    urp_submission_performed: false,
    upload_performed: false,
    poi_receipt_minted: false,
    sat_settlement_performed: false,
    economic_action_performed: false,
  });
}

export function buildPoiReceiptEligibilityPlan({
  benefit_preview,
  shareability = null,
  historical = null,
  lookback_years = 3,
  generated_at_iso = "",
} = {}) {
  const benefitValid =
    benefit_preview &&
    benefit_preview.schema === URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA &&
    benefit_preview.truth_label === URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL;
  const shareabilityValid =
    !shareability ||
    (shareability.schema === HOMEBASE_SHAREABILITY_SCHEMA &&
      shareability.truth_label === HOMEBASE_SHAREABILITY_TRUTH_LABEL);
  const historicalValid =
    !historical ||
    (historical.schema === NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA &&
      historical.truth_label ===
        NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL);

  if (!benefitValid || !shareabilityValid || !historicalValid) {
    return freezeDeep({
      schema: POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA,
      truth_label: POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
      valid: false,
      error: !benefitValid
        ? "invalid_or_missing_benefit_preview"
        : !shareabilityValid
          ? "invalid_shareability_input"
          : "invalid_historical_verification_input",
      generated_at_iso,
      benefit_preview: benefit_preview ?? null,
      resource_receipt_plans: Object.freeze([]),
      global_proof_gaps: Object.freeze([]),
      sat_verification_plan: null,
      proof_artifact_types: PROOF_ARTIFACT_TYPES,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: buildBoundary(),
    });
  }

  const resource_receipt_plans = freezeDeep(
    (benefit_preview.resource_previews ?? [])
      .map((r) => buildResourceReceiptPlan(r, historical))
      .sort((a, b) => a.top_level.localeCompare(b.top_level)),
  );

  const strengthenable = resource_receipt_plans.filter((p) => !p.blocked);
  const blocked_count = resource_receipt_plans.filter((p) => p.blocked).length;

  const report_id = `sha256:${sha256(
    stableStringify({
      benefit_report_id: benefit_preview.report_id,
      lookback_years,
      strengthenable: strengthenable.length,
      blocked: blocked_count,
    }),
  )}`;

  return freezeDeep({
    schema: POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA,
    truth_label: POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
    valid: benefit_preview.valid === true,
    error: benefit_preview.error ?? null,
    mode: "metadata_first_pre_token",
    generated_at_iso:
      generated_at_iso ||
      benefit_preview.generated_at_iso ||
      "",
    report_id,
    lookback_years,
    root: benefit_preview.root,
    benefit_preview_schema: benefit_preview.schema,
    benefit_preview_report_id: benefit_preview.report_id,
    resource_receipt_plans,
    summary: Object.freeze({
      total_resources: resource_receipt_plans.length,
      strengthenable_count: strengthenable.length,
      blocked_count,
      requires_sat_review_count: resource_receipt_plans.filter(
        (p) => p.requires_sat_review,
      ).length,
      requires_explicit_consent_count: resource_receipt_plans.filter(
        (p) => p.requires_explicit_consent,
      ).length,
      max_strengthened_band_preview:
        strengthenable.length > 0
          ? strengthenable.reduce(
              (best, p) =>
                bandRank(p.strengthens_eligibility_to_preview) > bandRank(best)
                  ? p.strengthens_eligibility_to_preview
                  : best,
              "none",
            )
          : "none",
    }),
    global_proof_gaps: buildGlobalProofGaps(historical, benefit_preview),
    sat_verification_plan: buildSatVerificationPlan(benefit_preview),
    proof_artifact_types: PROOF_ARTIFACT_TYPES,
    urp_readiness: benefit_preview.urp_readiness ?? "local_only",
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    what_remains_not_proven: freezeDeep([
      "live_poi_receipt_mint_and_chain",
      "sat_settlement_runtime",
      "urp_submission_acceptance",
      "content_hash_or_benchmark_execution",
      "guaranteed_reward_or_token_price",
    ]),
    next_recommended_consent_step:
      "Run dema contribute receipt-draft after proof-plan boundaries are accepted",
    boundary: buildBoundary(benefit_preview.boundary),
  });
}

export function renderPoiReceiptEligibilityPlan(report) {
  if (!report || report.schema !== POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA) {
    return "Dema contribute receipt-plan: invalid report";
  }
  const summary = report.summary ?? {};
  const lines = [
    "POI RECEIPT ELIGIBILITY PLAN · PREVIEW ONLY",
    `truth: ${report.truth_label}`,
    `root: ${report.root?.display ?? "unknown"}`,
    `resources: ${summary.total_resources ?? 0} · strengthenable: ${summary.strengthenable_count ?? 0} · blocked: ${summary.blocked_count ?? 0}`,
    `max strengthened band (preview): ${summary.max_strengthened_band_preview ?? "none"}`,
    `SAT review plan: ${report.sat_verification_plan?.required ? "required (DESIGNED_NOT_LIVE)" : "not applicable"}`,
  ];
  if ((report.global_proof_gaps?.length ?? 0) > 0) {
    lines.push(`global proof gaps: ${report.global_proof_gaps.join(", ")}`);
  }
  lines.push(
    "Boundary: metadata-first · no content · no network · no PoI mint · no URP submission · no wallet",
  );
  return lines.join("\n");
}
