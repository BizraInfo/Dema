// NODE0-HISTORICAL-CONTRIBUTION-VERIFICATION-1A — pre-token historical work
// verification preview. Composes metadata-only asset awareness, git time-span
// evidence, and canon witness markers into contribution categories with honest
// benefit/risk/shareability previews. No token mint, no URP submission, no
// content reads, no valuation guarantee.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
} from "./homebase-asset-awareness.js";

export const NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA =
  "bizra.dema.node0_historical_contribution_verification.v0.1";
export const NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL =
  "NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_PRE_TOKEN";
export const URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL =
  "URP_CONTRIBUTION_BENEFIT_PREVIEW_ONLY";

const CONTRIBUTION_TYPES = Object.freeze([
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

const WHAT_THIS_PROVES = Object.freeze([
  "Declared local roots can be classified into historical contribution categories using metadata-only signals.",
  "Git time-span evidence and canon witness path markers can be composed with asset awareness for pre-token eligibility preview.",
  "Founder URP commons commitment can be recorded as a preview covenant without minting or transferring value.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No token was minted, allocated, priced, or transferred.",
  "No URP submission, SAT verification runtime, or PoI settlement occurred.",
  "Benefit bands are previews only — not earnings, not guarantees, not market value.",
  "No file content was read for classification; names, extensions, git dates, and path markers only.",
  "Historical work outside the declared root or git window may remain unverified.",
  "The 50% URP commons preview is a founder covenant record, not a tax on future node users.",
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

function bandFromScore(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "insufficient_evidence";
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

function aggregateContributionCategories(awareness, hardwareObservation) {
  const tallies = Object.fromEntries(CONTRIBUTION_TYPES.map((t) => [t, 0]));
  const categories = awareness?.categories ?? {};
  for (const [category, count] of Object.entries(categories)) {
    const type = CATEGORY_TO_CONTRIBUTION[category] ?? "data";
    tallies[type] = (tallies[type] ?? 0) + (count ?? 0);
  }
  if (hardwareObservation?.cpu_cores_logical > 0) {
    tallies.hardware += 1;
  }
  if ((hardwareObservation?.gpus?.length ?? 0) > 0) {
    tallies.hardware += hardwareObservation.gpus.length;
  }

  return freezeDeep(
    CONTRIBUTION_TYPES.map((contribution_type) =>
      Object.freeze({
        contribution_type,
        signal_count: tallies[contribution_type] ?? 0,
        preview_only: true,
      }),
    ),
  );
}

function scoreShareability(awareness, hardwareObservation) {
  let score = 50;
  const denied = awareness?.denied_count ?? 0;
  const riskFlags = awareness?.risk_flags ?? [];
  if (denied > 0) score -= 15;
  if (riskFlags.includes("secret_or_key_pattern_denied")) score -= 25;
  if (riskFlags.includes("wallet_or_secret_directory_denied")) score -= 20;
  if ((awareness?.categories?.media ?? 0) > 50) score -= 10;
  if ((hardwareObservation?.cpu_cores_logical ?? 0) >= 8) score += 10;
  if ((hardwareObservation?.gpus?.length ?? 0) > 0) score += 10;
  return clampScore(score);
}

function scoreBenefit(awareness, gitEvidence, canonWitnesses) {
  let score = 0;
  const cats = awareness?.categories ?? {};
  score += Math.min(30, (cats.code_project ?? 0) / 10);
  score += Math.min(25, (cats.document ?? 0) / 8);
  score += Math.min(20, (cats.receipt_or_proof ?? 0) * 4);
  score += Math.min(15, (cats.model_artifact ?? 0) * 5);
  score += Math.min(10, (gitEvidence?.commits_in_window ?? 0) / 50);
  const presentWitnesses = (canonWitnesses ?? []).filter((w) => w.present).length;
  score += Math.min(20, presentWitnesses * 5);
  return clampScore(score);
}

function scoreRisk(awareness) {
  let score = 0;
  const riskFlags = awareness?.risk_flags ?? [];
  if (riskFlags.includes("secret_or_key_pattern_denied")) score += 30;
  if (riskFlags.includes("wallet_or_secret_directory_denied")) score += 25;
  if (riskFlags.includes("scan_truncated_by_limits")) score += 15;
  if ((awareness?.categories?.media ?? 0) > 0) score += 10;
  if ((awareness?.denied_count ?? 0) > 0) score += 10;
  return clampScore(score);
}

function scoreProofStrength(gitEvidence, canonWitnesses, awareness) {
  let score = 0;
  if (gitEvidence?.is_git_repository) score += 20;
  if ((gitEvidence?.commits_in_window ?? 0) > 100) score += 25;
  else if ((gitEvidence?.commits_in_window ?? 0) > 10) score += 15;
  else if ((gitEvidence?.commits_in_window ?? 0) > 0) score += 8;
  const presentWitnesses = (canonWitnesses ?? []).filter((w) => w.present).length;
  score += Math.min(30, presentWitnesses * 6);
  if ((awareness?.categories?.receipt_or_proof ?? 0) > 0) score += 15;
  if (awareness?.valid === true) score += 10;
  return clampScore(score);
}

function buildUncertaintyFlags(awareness, gitEvidence, canonWitnesses) {
  const flags = [];
  if (!gitEvidence?.is_git_repository) flags.push("no_git_history_at_root");
  if ((gitEvidence?.commits_in_window ?? 0) === 0) {
    flags.push("no_commits_in_lookback_window");
  }
  if ((canonWitnesses ?? []).filter((w) => w.present).length === 0) {
    flags.push("no_canon_witness_paths_present");
  }
  if (awareness?.summary?.truncated === true) {
    flags.push("asset_scan_truncated");
  }
  if ((awareness?.categories?.unknown ?? 0) > 100) {
    flags.push("large_unknown_category_bucket");
  }
  flags.push("token_rails_not_live");
  flags.push("urp_reward_settlement_not_live");
  return freezeDeep([...new Set(flags)].sort());
}

function buildUnverifiedItems(awareness, gitEvidence, canonWitnesses) {
  const items = [];
  if (!gitEvidence?.is_git_repository) {
    items.push("git_history_for_declared_root");
  }
  for (const witness of canonWitnesses ?? []) {
    if (!witness.present) items.push(`canon_witness:${witness.id}`);
  }
  if (awareness?.summary?.truncated) {
    items.push("complete_asset_inventory_beyond_scan_limits");
  }
  items.push("content_level_originality_review");
  items.push("sat_independent_verification");
  items.push("poi_impact_settlement");
  items.push("live_token_allocation");
  return freezeDeep([...new Set(items)].sort());
}

function buildRewardEligibilityPreview({
  benefitScore,
  proofScore,
  riskScore,
  uncertaintyFlags,
}) {
  const net = clampScore(benefitScore + proofScore - riskScore);
  const blocking = uncertaintyFlags.filter((f) =>
    [
      "no_git_history_at_root",
      "no_commits_in_lookback_window",
      "no_canon_witness_paths_present",
      "token_rails_not_live",
      "urp_reward_settlement_not_live",
    ].includes(f),
  );
  return freezeDeep({
    preview_only: true,
    truth_label: URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
    eligibility_band: bandFromScore(net),
    net_contribution_opportunity_score: net,
    benefit_score: benefitScore,
    proof_strength_score: proofScore,
    risk_score: riskScore,
    formula_note:
      "Benefit + Proof Strength − Risk = Net Contribution Opportunity (preview only; no mint)",
    blocking_reasons: blocking,
    token_mint_performed: false,
    urp_reward_rails_live: false,
    estimated_benefit_if_accepted:
      "Estimated benefit if URP accepts and verifies this contribution (preview only)",
  });
}

function buildUrpCommonsCommitmentPreview(eligibilityBand) {
  return freezeDeep({
    preview_only: true,
    covenant_id: "founder_sadaqah_50_percent_to_urp_commons",
    commitment_fraction: 0.5,
    retained_fraction: 0.5,
    note:
      "50% of verified Node0-earned genesis allocation previewed for BIZRA URP commons treasury; founder covenant, not a user tax",
    sat_treasury_management: "DESIGNED_NOT_LIVE",
    applies_when: "genesis_token_rails_live_and_eligibility_verified",
    active: eligibilityBand !== "insufficient_evidence",
  });
}

function buildShareabilityHints(awareness, shareabilityScore) {
  const share = [];
  const blocked = [];
  if (shareabilityScore >= 40) {
    share.push("selected_public_repos_metadata");
    share.push("anonymized_benchmark_metadata");
    share.push("verified_impact_receipt_markers");
  }
  if ((awareness?.categories?.receipt_or_proof ?? 0) > 0) {
    share.push("receipt_or_proof_artifacts_after_consent");
  }
  if ((awareness?.categories?.code_project ?? 0) > 0) {
    share.push("code_project_surfaces_after_license_review");
  }
  blocked.push("secrets_and_key_patterns");
  blocked.push("private_keys_and_wallets");
  blocked.push("raw_personal_media_without_consent");
  blocked.push("unlicensed_or_unknown_rights_data");
  blocked.push("anything_without_explicit_typed_consent");
  return freezeDeep({
    shareability_score: shareabilityScore,
    shareable_preview: freezeDeep([...new Set(share)].sort()),
    do_not_share: freezeDeep(blocked),
  });
}

export function buildNode0HistoricalContributionVerification({
  awareness,
  git_evidence = null,
  canon_witnesses = [],
  hardware_observation = null,
  lookback_years = 3,
  generated_at_iso = "",
} = {}) {
  const awarenessValid =
    awareness &&
    awareness.schema === HOMEBASE_ASSET_AWARENESS_SCHEMA &&
    awareness.truth_label === HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL;

  if (!awarenessValid) {
    return freezeDeep({
      schema: NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
      truth_label: NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
      valid: false,
      error: "invalid_or_missing_asset_awareness",
      generated_at_iso,
      awareness: awareness ?? null,
      contribution_categories: Object.freeze([]),
      time_span_evidence: git_evidence ?? null,
      canon_witnesses: Object.freeze(canon_witnesses ?? []),
      scores: Object.freeze({}),
      uncertainty_flags: Object.freeze(["invalid_asset_awareness_input"]),
      unverified_items: Object.freeze([]),
      reward_eligibility_preview: null,
      urp_commons_commitment_preview: null,
      shareability_hints: null,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: buildBoundary(),
    });
  }

  const contribution_categories = aggregateContributionCategories(
    awareness,
    hardware_observation,
  );
  const shareabilityScore = scoreShareability(awareness, hardware_observation);
  const benefitScore = scoreBenefit(awareness, git_evidence, canon_witnesses);
  const riskScore = scoreRisk(awareness);
  const proofScore = scoreProofStrength(git_evidence, canon_witnesses, awareness);
  const uncertainty_flags = buildUncertaintyFlags(
    awareness,
    git_evidence,
    canon_witnesses,
  );
  const unverified_items = buildUnverifiedItems(
    awareness,
    git_evidence,
    canon_witnesses,
  );
  const reward_eligibility_preview = buildRewardEligibilityPreview({
    benefitScore,
    proofScore,
    riskScore,
    uncertaintyFlags: uncertainty_flags,
  });
  const urp_commons_commitment_preview = buildUrpCommonsCommitmentPreview(
    reward_eligibility_preview.eligibility_band,
  );
  const shareability_hints = buildShareabilityHints(awareness, shareabilityScore);

  const report_id = `sha256:${sha256(
    stableStringify({
      root_hash: awareness.root?.path_hash,
      git: git_evidence,
      scores: { benefitScore, proofScore, riskScore, shareabilityScore },
      lookback_years,
    }),
  )}`;

  return freezeDeep({
    schema: NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
    truth_label: NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
    valid: awareness.valid === true,
    error: awareness.error ?? null,
    mode: "metadata_first_pre_token",
    generated_at_iso:
      generated_at_iso || awareness.generated_at_iso || "",
    report_id,
    lookback_years,
    root: awareness.root,
    awareness_schema: awareness.schema,
    awareness_truth_label: awareness.truth_label,
    time_span_evidence: git_evidence,
    canon_witnesses: Object.freeze([...(canon_witnesses ?? [])]),
    hardware_observation_summary: hardware_observation
      ? Object.freeze({
          cpu_cores_logical: hardware_observation.cpu_cores_logical ?? null,
          memory_total_gb: hardware_observation.memory_total_gb ?? null,
          gpu_count: hardware_observation.gpus?.length ?? 0,
          preview_only: true,
        })
      : null,
    verified_asset_classes: Object.freeze(
      Object.entries(awareness.categories ?? {})
        .filter(([, count]) => count > 0)
        .map(([asset_class, count]) =>
          Object.freeze({ asset_class, count, metadata_only: true }),
        )
        .sort((a, b) => a.asset_class.localeCompare(b.asset_class)),
    ),
    contribution_categories,
    scores: Object.freeze({
      shareability_score: shareabilityScore,
      benefit_score: benefitScore,
      risk_score: riskScore,
      proof_strength_score: proofScore,
    }),
    uncertainty_flags,
    unverified_items,
    reward_eligibility_preview,
    urp_commons_commitment_preview,
    shareability_hints,
    next_recommended_consent_step:
      "Review shareability hints, then proceed to DEMA-HOMEBASE-SHAREABILITY-1A before any URP preview",
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: buildBoundary(awareness.boundary),
  });
}

export function formatNode0HistoricalContributionVerification(report) {
  if (
    !report ||
    report.schema !== NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA
  ) {
    return "Dema genesis verify-node0: invalid report";
  }
  const lines = [
    "NODE0 HISTORICAL CONTRIBUTION · PRE-TOKEN VERIFICATION",
    `truth: ${report.truth_label}`,
    `root: ${report.root?.display ?? "unknown"}`,
    `lookback: ${report.lookback_years}y · git commits: ${report.time_span_evidence?.commits_in_window ?? "n/a"}`,
    `scores — benefit: ${report.scores?.benefit_score ?? 0} · proof: ${report.scores?.proof_strength_score ?? 0} · risk: ${report.scores?.risk_score ?? 0}`,
    `eligibility preview: ${report.reward_eligibility_preview?.eligibility_band ?? "n/a"} (${report.reward_eligibility_preview?.truth_label ?? ""})`,
    `URP commons covenant preview: ${(report.urp_commons_commitment_preview?.commitment_fraction ?? 0) * 100}% founder sadaqah (preview only)`,
  ];
  if ((report.uncertainty_flags?.length ?? 0) > 0) {
    lines.push(`uncertainty: ${report.uncertainty_flags.join(", ")}`);
  }
  lines.push(
    "Boundary: metadata-first · no content read · no network · no token mint · no URP submission",
  );
  return lines.join("\n");
}
