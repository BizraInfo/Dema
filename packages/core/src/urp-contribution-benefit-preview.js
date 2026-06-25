// URP-CONTRIBUTION-BENEFIT-PREVIEW-1A — pre-token contribution benefit preview.
//
// Composes metadata-only homebase asset awareness (#264), Node0 historical
// contribution verification (#265), and homebase shareability (#266) into
// honest benefit eligibility previews. No token mint, no wallet, no URP
// submission, no upload, no valuation guarantee.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
} from "./homebase-asset-awareness.js";
import {
  HOMEBASE_SHAREABILITY_SCHEMA,
  HOMEBASE_SHAREABILITY_TRUTH_LABEL,
} from "./homebase-shareability.js";
import {
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
} from "./node0-historical-contribution-verification.js";

export const URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA =
  "bizra.dema.urp_contribution_benefit_preview.v0.1";
export { URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL };

const CONTRIBUTION_CLASSES = Object.freeze([
  "hardware",
  "data",
  "knowledge_product",
  "impact",
]);

const CATEGORY_TO_CONTRIBUTION = Object.freeze({
  code_project: "knowledge_product",
  document: "knowledge_product",
  receipt_or_proof: "impact",
  model_artifact: "hardware",
  dataset: "data",
  media: "data",
  archive: "data",
  unknown: "data",
});

const BENEFIT_CLASS_CATALOG = Object.freeze([
  "token_eligibility_preview",
  "reputation",
  "service_credit",
  "marketplace_priority",
  "SAT_review_needed",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "Local metadata can be composed into pre-token benefit eligibility previews with shareability boundaries applied first.",
  "Historical verification signals can inform reward eligibility bands without minting or transferring value.",
  "Blocked or consent-gated assets are separated from preview-only benefit classes.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No token was minted, priced, allocated, or transferred.",
  "No wallet access, URP submission, upload, or SAT settlement occurred.",
  "Benefit bands and classes are previews only — not earnings, not guarantees, not market value.",
  "No file content was read; classification uses metadata, path markers, and composed reports only.",
  "The founder 50% URP commons covenant preview (when present) is separate from any user tax.",
  "Future token price or reward amount is not promised.",
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

function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function eligibilityBandFromScore(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "none";
}

function mapHistoricalBand(band) {
  if (band === "insufficient_evidence") return "none";
  if (band === "high" || band === "medium" || band === "low" || band === "none") {
    return band;
  }
  return "none";
}

function benefitClassesForAssessment(assessment) {
  if (assessment.shareability_level === "blocked_do_not_share") {
    return Object.freeze([]);
  }
  const base = assessment.benefit_class ?? "manual_review";
  const classes = new Set();
  if (base === "hardware_compute") {
    classes.add("token_eligibility_preview");
    classes.add("service_credit");
    classes.add("SAT_review_needed");
  } else if (base === "knowledge_product") {
    classes.add("token_eligibility_preview");
    classes.add("reputation");
    classes.add("marketplace_priority");
  } else if (base === "data_contribution") {
    classes.add("service_credit");
    classes.add("marketplace_priority");
    classes.add("SAT_review_needed");
  } else if (base === "reputation_evidence") {
    classes.add("reputation");
    classes.add("token_eligibility_preview");
  } else if (base === "bundle_review" || base === "manual_review") {
    classes.add("SAT_review_needed");
    classes.add("marketplace_priority");
  }
  if (assessment.shareability_level === "shareable_metadata_only") {
    classes.delete("token_eligibility_preview");
    if (!classes.has("reputation")) classes.add("reputation");
  }
  if (
    assessment.shareability_level === "content_consent_required" ||
    assessment.consent_required === "content_review" ||
    assessment.consent_required === "explicit_typed_go"
  ) {
    classes.add("SAT_review_needed");
  }
  return freezeDeep([...classes].sort());
}

function eligibilityBandForAssessment(assessment, riskDiscount) {
  if (assessment.shareability_level === "blocked_do_not_share") return "none";
  const weights = {
    shareable_metadata_only: 35,
    shareable_with_consent: 65,
    content_consent_required: 25,
    manual_review_required: 20,
    blocked_do_not_share: 0,
  };
  let score = weights[assessment.shareability_level] ?? 0;
  if (assessment.privacy_risk === "high") score -= 15;
  if (assessment.privacy_risk === "medium") score -= 5;
  score -= riskDiscount;
  return eligibilityBandFromScore(clampScore(score));
}

function buildSatVerificationPath(assessment) {
  if (assessment.shareability_level === "blocked_do_not_share") {
    return Object.freeze({
      required: false,
      status: "not_applicable",
      note: "Blocked assets are not eligible for SAT verification preview",
    });
  }
  return Object.freeze({
    required: true,
    status: "DESIGNED_NOT_LIVE",
    note:
      "SAT independent verification would be required before any live URP reward settlement",
    preview_only: true,
  });
}

function buildPatRewardPath(assessment) {
  if (assessment.shareability_level === "blocked_do_not_share") {
    return Object.freeze({
      available: false,
      status: "blocked_by_shareability",
      note: "No PAT reward path for blocked assets",
    });
  }
  return Object.freeze({
    available: true,
    status: "PREVIEW_ONLY",
    note:
      "PAT receipt path may apply after explicit consent, proof, and live rails — preview only",
    preview_only: true,
  });
}

function buildResourcePreview(assessment, riskDiscount) {
  const contribution_class =
    CATEGORY_TO_CONTRIBUTION[assessment.category] ?? "data";
  const possible_benefit_classes = benefitClassesForAssessment(assessment);
  const estimated_eligibility_band = eligibilityBandForAssessment(
    assessment,
    riskDiscount,
  );
  const blocked = assessment.shareability_level === "blocked_do_not_share";

  return Object.freeze({
    resource_id: assessment.assessment_id,
    cluster_id: assessment.cluster_id,
    top_level: assessment.top_level,
    category: assessment.category,
    contribution_class,
    shareability_level: assessment.shareability_level,
    shareability_bucket: assessment.shareability_level,
    proof_required: assessment.proof_required,
    consent_required: assessment.consent_required,
    possible_benefit_classes,
    estimated_eligibility_band,
    benefit_estimate:
      blocked || estimated_eligibility_band === "none"
        ? null
        : Object.freeze({
            preview_only: true,
            band: estimated_eligibility_band,
            note:
              "Estimated eligibility if URP accepts and verifies this contribution (preview only)",
          }),
    sat_verification: buildSatVerificationPath(assessment),
    pat_reward_path: buildPatRewardPath(assessment),
    urp_compatibility_status: assessment.urp_compatibility,
    risk_uncertainty_discount: riskDiscount,
    requires_future_consent:
      assessment.shareability_level === "content_consent_required" ||
      assessment.consent_required === "explicit_typed_go" ||
      assessment.consent_required === "content_review",
    what_remains_not_proven: freezeDeep(
      blocked
        ? ["shareability_blocked", "no_benefit_preview"]
        : [
            "sat_independent_verification",
            "urp_submission_acceptance",
            "live_token_allocation",
            "market_price_or_guaranteed_reward",
          ],
    ),
    preview_only: true,
  });
}

function buildContributionClassRollup(resourcePreviews) {
  const tallies = Object.fromEntries(
    CONTRIBUTION_CLASSES.map((c) => [c, { contribution_class: c, count: 0 }]),
  );
  for (const preview of resourcePreviews) {
    const entry = tallies[preview.contribution_class];
    if (entry) entry.count += 1;
  }
  return freezeDeep(
    CONTRIBUTION_CLASSES.map((c) =>
      Object.freeze({
        contribution_class: c,
        resource_count: tallies[c].count,
        preview_only: true,
      }),
    ),
  );
}

function resolveUrpReadiness(shareability, historical) {
  const blocked =
    shareability?.shareability_summary?.blocked_do_not_share?.length ?? 0;
  const shareScore = shareability?.scores?.shareability_score ?? 0;
  const histBand =
    historical?.reward_eligibility_preview?.eligibility_band ?? "none";
  if (blocked > 0 && shareScore < 30) {
    return "local_only";
  }
  if (
    shareScore >= 40 &&
    mapHistoricalBand(histBand) !== "none" &&
    historical?.valid === true
  ) {
    return "urp_later_preview";
  }
  return "local_only";
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
    economic_action_performed: false,
  });
}

function computeRiskDiscount(shareability, historical) {
  let discount = 0;
  discount += Math.round((shareability?.scores?.risk_score ?? 0) * 0.2);
  discount += Math.round(
    (historical?.scores?.risk_score ?? 0) * 0.15,
  );
  const flags = historical?.uncertainty_flags ?? [];
  if (flags.includes("token_rails_not_live")) discount += 10;
  if (flags.includes("urp_reward_settlement_not_live")) discount += 10;
  return clampScore(discount);
}

export function buildUrpContributionBenefitPreview({
  awareness,
  shareability,
  historical = null,
  lookback_years = 3,
  generated_at_iso = "",
} = {}) {
  const awarenessValid =
    awareness &&
    awareness.schema === HOMEBASE_ASSET_AWARENESS_SCHEMA &&
    awareness.truth_label === HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL;
  const shareabilityValid =
    shareability &&
    shareability.schema === HOMEBASE_SHAREABILITY_SCHEMA &&
    shareability.truth_label === HOMEBASE_SHAREABILITY_TRUTH_LABEL;
  const historicalValid =
    !historical ||
    (historical.schema === NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA &&
      historical.truth_label ===
        NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL);

  if (!awarenessValid || !shareabilityValid || !historicalValid) {
    return freezeDeep({
      schema: URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA,
      truth_label: URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
      valid: false,
      error: !awarenessValid
        ? "invalid_or_missing_asset_awareness"
        : !shareabilityValid
          ? "invalid_or_missing_shareability"
          : "invalid_historical_verification_input",
      generated_at_iso,
      awareness: awareness ?? null,
      shareability: shareability ?? null,
      historical: historical ?? null,
      resource_previews: Object.freeze([]),
      contribution_class_rollup: Object.freeze([]),
      historical_reward_preview: null,
      urp_commons_covenant_preview: null,
      urp_readiness: "local_only",
      scores: Object.freeze({}),
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      what_remains_not_proven: Object.freeze([
        "complete_compose_input_required",
      ]),
      boundary: buildBoundary(),
    });
  }

  const riskDiscount = computeRiskDiscount(shareability, historical);
  const assessments = shareability.cluster_assessments ?? [];
  const resource_previews = freezeDeep(
    assessments
      .map((a) => buildResourcePreview(a, riskDiscount))
      .sort((a, b) => a.top_level.localeCompare(b.top_level)),
  );

  const historical_reward_preview = historical?.reward_eligibility_preview
    ? freezeDeep({
        ...historical.reward_eligibility_preview,
        mapped_eligibility_band: mapHistoricalBand(
          historical.reward_eligibility_preview.eligibility_band,
        ),
        preview_only: true,
      })
    : null;

  const urp_commons_covenant_preview =
    historical?.urp_commons_commitment_preview ?? null;

  const aggregateBandScores = resource_previews
    .filter((p) => p.estimated_eligibility_band !== "none")
    .map((p) => {
      const bands = { none: 0, low: 25, medium: 50, high: 75 };
      return bands[p.estimated_eligibility_band] ?? 0;
    });
  const aggregateScore =
    aggregateBandScores.length > 0
      ? aggregateBandScores.reduce((a, b) => a + b, 0) /
        aggregateBandScores.length
      : 0;

  const report_id = `sha256:${sha256(
    stableStringify({
      root_hash: awareness.root?.path_hash,
      shareability_id: shareability.report_id,
      historical_id: historical?.report_id ?? null,
      lookback_years,
      resource_count: resource_previews.length,
    }),
  )}`;

  return freezeDeep({
    schema: URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA,
    truth_label: URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
    valid: awareness.valid === true && shareability.valid === true,
    error: awareness.error ?? shareability.error ?? null,
    mode: "metadata_first_pre_token",
    generated_at_iso:
      generated_at_iso ||
      shareability.generated_at_iso ||
      awareness.generated_at_iso ||
      "",
    report_id,
    lookback_years,
    root: awareness.root,
    awareness_schema: awareness.schema,
    shareability_schema: shareability.schema,
    historical_schema: historical?.schema ?? null,
    resource_previews,
    contribution_class_rollup: buildContributionClassRollup(resource_previews),
    historical_reward_preview,
    urp_commons_covenant_preview,
    urp_readiness: resolveUrpReadiness(shareability, historical),
    scores: Object.freeze({
      shareability_score: shareability.scores?.shareability_score ?? 0,
      shareability_risk_score: shareability.scores?.risk_score ?? 0,
      historical_benefit_score: historical?.scores?.benefit_score ?? 0,
      historical_proof_score: historical?.scores?.proof_strength_score ?? 0,
      historical_risk_score: historical?.scores?.risk_score ?? 0,
      aggregate_eligibility_score: clampScore(aggregateScore),
      risk_uncertainty_discount: riskDiscount,
    }),
    benefit_class_catalog: BENEFIT_CLASS_CATALOG,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    what_remains_not_proven: freezeDeep([
      "sat_independent_verification_runtime",
      "urp_submission_acceptance",
      "live_token_allocation_and_pricing",
      "guaranteed_future_reward_amount",
      "content_level_originality_review",
    ]),
    next_recommended_consent_step:
      "No URP submission — review previews locally; future consent must be explicit typed GO",
    boundary: buildBoundary(awareness.boundary),
  });
}

export function renderUrpContributionBenefitPreview(report) {
  if (!report || report.schema !== URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA) {
    return "Dema contribute preview: invalid report";
  }
  const lines = [
    "URP CONTRIBUTION BENEFIT · PREVIEW ONLY",
    `truth: ${report.truth_label}`,
    `root: ${report.root?.display ?? "unknown"}`,
    `resources previewed: ${report.resource_previews?.length ?? 0}`,
    `URP readiness: ${report.urp_readiness}`,
    `aggregate eligibility score: ${report.scores?.aggregate_eligibility_score ?? 0} (preview)`,
  ];
  if (report.historical_reward_preview) {
    lines.push(
      `historical eligibility: ${report.historical_reward_preview.mapped_eligibility_band ?? "none"} (preview only)`,
    );
  }
  lines.push(
    "Boundary: metadata-first · no content · no network · no token mint · no URP submission · no wallet",
  );
  return lines.join("\n");
}
