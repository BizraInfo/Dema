import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const DUAL_TOKEN_POI_ECONOMY_SCHEMA =
  "bizra.dema.dual_token_poi_economy.v0.1";
export const POI_MINT_PREVIEW_SCHEMA =
  "bizra.dema.poi_mint_preview.v0.1";
export const DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL = "DESIGNED_NOT_LIVE";
export const POI_MINT_PREVIEW_TRUTH_LABEL = "ECONOMY_SIMULATION_ONLY";
export const LIVE_TOKEN_MINT_TRUTH_LABEL =
  "BLOCKED_UNTIL_EXTERNAL_REVIEW";
export const BZR_C_TRUTH_LABEL = "DESIGNED_UTILITY_TOKEN";
export const BZR_I_TRUTH_LABEL = "DESIGNED_IMPACT_REPUTATION_TOKEN";

const POI_CLAIM_SCHEMA = "bizra.poi.claim.v0.1";

const ANTI_ABUSE_KEYS = Object.freeze([
  "proof_exists",
  "consent_exists",
  "impact_score_exists",
  "job_completed",
  "quality_score_min_pass",
  "not_duplicate",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "A verified PoI-shaped claim can be evaluated by deterministic no-mint preview rules.",
  "BZR-C and BZR-I previews are zeroed when PoI, FATE, SAT, consent, quality, duplicate, or anti-self-reward gates fail.",
  "Receipt hashes replay deterministically over the preview body.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No live token was minted, transferred, sold, reserved, or promised.",
  "No wallet, chain deployment, public sale, exchange value, or external validator was used.",
  "SAT and FATE fields are consumed as declared receipt inputs; this local kernel does not run live SAT/FATE.",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round6(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function prefixedSha256(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function isVerifiedStatus(status) {
  return status === "VERIFIED" || status === "POI_VERIFIED";
}

function isGatePass(status) {
  return ["PASS", "PASSED", "VALIDATED", "PERMIT", "VERIFIED"].includes(
    status,
  );
}

function antiAbuseFailures(antiAbuse) {
  return ANTI_ABUSE_KEYS.filter((key) => antiAbuse?.[key] !== true);
}

function buildFairnessDecision({ fairness = {}, metrics = {} }) {
  const concentrationGini = numberOr(fairness.concentration_gini, null);
  const threshold = clamp01(fairness.gini_threshold, 0.75);
  const highConcentration =
    concentrationGini !== null && concentrationGini > threshold;
  const defaultDampener = highConcentration ? 0.5 : 1;
  const metricDampener = metrics.fairness_dampener;
  const requestedDampener = highConcentration
    ? fairness.dampener ?? metricDampener
    : metricDampener;
  const applied = clamp01(requestedDampener, defaultDampener);

  return freezeDeep({
    concentration_gini: concentrationGini,
    gini_threshold: threshold,
    action: highConcentration ? "DAMPENED" : "NONE",
    applied_dampener: applied,
  });
}

function buildBlockers({ impactReceipt, requestedLiveMint }) {
  const blockers = [];
  if (!impactReceipt || typeof impactReceipt !== "object") {
    return ["impact_receipt_missing"];
  }
  if (impactReceipt.schema !== POI_CLAIM_SCHEMA) {
    blockers.push("impact_receipt_schema_mismatch");
  }
  if (!isVerifiedStatus(impactReceipt.status)) {
    blockers.push("poi_not_verified");
  }
  if (!isGatePass(impactReceipt.fate?.status)) {
    blockers.push("fate_not_passed");
  }
  if (!isGatePass(impactReceipt.sat?.status)) {
    blockers.push("sat_not_validated");
  }
  if (impactReceipt.source_kind === "COST_RECEIPT") {
    blockers.push("cost_receipt_is_not_impact");
  }
  if (impactReceipt.source_kind === "PROOF_OF_SPEND") {
    blockers.push("proof_of_spend_is_not_value");
  }
  if (!Array.isArray(impactReceipt.impact_evidence)) {
    blockers.push("impact_evidence_missing");
  }
  for (const key of antiAbuseFailures(impactReceipt.anti_abuse)) {
    blockers.push(`anti_abuse_failed:${key}`);
  }
  if (
    impactReceipt.self_reward_attempt === true ||
    (impactReceipt.actor_type === "agent" &&
      typeof impactReceipt.actor === "string" &&
      impactReceipt.actor === impactReceipt.beneficiary)
  ) {
    blockers.push("agent_self_reward_rejected");
  }
  if (requestedLiveMint) {
    blockers.push("live_mint_blocked_until_external_review");
  }
  return [...new Set(blockers)];
}

function computePreviewMints({ impactReceipt, fairness, allowed }) {
  if (!allowed) {
    return { bzc: 0, bzi: 0 };
  }
  const metrics = impactReceipt.metrics ?? {};
  const proofConfidence = clamp01(metrics.proof_confidence, 1);
  const antiAbuseMultiplier = clamp01(metrics.anti_abuse_multiplier, 1);

  const bzc =
    numberOr(metrics.base_capacity_units, 0) *
    clamp01(metrics.service_completion_score, 1) *
    proofConfidence *
    numberOr(metrics.quality_multiplier, 1) *
    antiAbuseMultiplier *
    fairness.applied_dampener;

  const bzi =
    numberOr(metrics.impact_score, 0) *
    numberOr(metrics.beneficiary_weight, 1) *
    numberOr(metrics.durability_score, 1) *
    numberOr(metrics.additionality_score, 1) *
    proofConfidence *
    numberOr(metrics.human_review_weight, 1) *
    fairness.applied_dampener;

  return { bzc: round6(bzc), bzi: round6(bzi) };
}

export function buildDualTokenPoiEconomyCanon({ generatedAtIso = "" } = {}) {
  return freezeDeep({
    schema: DUAL_TOKEN_POI_ECONOMY_SCHEMA,
    truth_label: DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL,
    generated_at_iso: generatedAtIso,
    live_token_mint: LIVE_TOKEN_MINT_TRUTH_LABEL,
    supply_rule: "live_total_supply_zero_until_verified_poi_external_rails",
    tokens: {
      bzc: {
        name: "BIZRA Capacity Token",
        symbol: "BZR-C",
        role: "capacity_compute_service_execution_utility",
        truth_label: BZR_C_TRUTH_LABEL,
        live_supply: 0,
      },
      bzi: {
        name: "BIZRA Impact Token",
        symbol: "BZR-I",
        role: "impact_intelligence_knowledge_reputation_weight",
        truth_label: BZR_I_TRUTH_LABEL,
        live_supply: 0,
      },
    },
    invariants: [
      "no_mint_before_verified_poi",
      "simulation_receipts_never_mint_live_tokens",
      "cost_receipts_do_not_create_impact_value",
      "proof_of_spend_is_not_value",
      "agent_self_reward_forbidden",
      "fate_sat_poi_receipt_required_before_any_live_mint_design",
    ],
    boundary: buildPreviewBoundary(),
  });
}

export function previewPoiMintDecision({
  impactReceipt,
  requestedLiveMint = false,
  generatedAtIso = "",
} = {}) {
  const blockers = buildBlockers({ impactReceipt, requestedLiveMint });
  const liveOnlyBlocker = "live_mint_blocked_until_external_review";
  const substantiveBlockers = blockers.filter((b) => b !== liveOnlyBlocker);
  const allowedIfLive = substantiveBlockers.length === 0;
  const fairness = buildFairnessDecision({
    fairness: impactReceipt?.fairness,
    metrics: impactReceipt?.metrics,
  });
  const mints = computePreviewMints({
    impactReceipt: impactReceipt ?? {},
    fairness,
    allowed: allowedIfLive,
  });

  const body = freezeDeep({
    schema: POI_MINT_PREVIEW_SCHEMA,
    truth_label: POI_MINT_PREVIEW_TRUTH_LABEL,
    generated_at_iso: generatedAtIso,
    live_mint: false,
    requested_live_mint: requestedLiveMint === true,
    live_mint_truth_label: LIVE_TOKEN_MINT_TRUTH_LABEL,
    mint_allowed_if_live: allowedIfLive,
    blocked_reason: substantiveBlockers[0] ?? null,
    blocked_reasons: blockers,
    no_wallet: true,
    no_sale: true,
    no_public_token_promise: true,
    claim_id: impactReceipt?.claim_id ?? null,
    mission_id: impactReceipt?.mission_id ?? null,
    actor: impactReceipt?.actor ?? null,
    beneficiary: impactReceipt?.beneficiary ?? null,
    source_kind: impactReceipt?.source_kind ?? null,
    input_receipt_hash: impactReceipt ? prefixedSha256(impactReceipt) : null,
    tokens: {
      bzc: { symbol: "BZR-C", truth_label: BZR_C_TRUTH_LABEL },
      bzi: { symbol: "BZR-I", truth_label: BZR_I_TRUTH_LABEL },
    },
    bzc_mint_preview: mints.bzc,
    bzi_mint_preview: mints.bzi,
    fairness,
    gates: {
      poi_verified: isVerifiedStatus(impactReceipt?.status),
      fate_passed: isGatePass(impactReceipt?.fate?.status),
      sat_validated: isGatePass(impactReceipt?.sat?.status),
      anti_abuse_passed:
        antiAbuseFailures(impactReceipt?.anti_abuse).length === 0,
      agent_self_reward_allowed: false,
    },
    formulas: {
      bzc:
        "base_capacity_units * service_completion_score * proof_confidence * quality_multiplier * anti_abuse_multiplier * fairness_dampener",
      bzi:
        "impact_score * beneficiary_weight * durability_score * additionality_score * proof_confidence * human_review_weight * fairness_dampener",
    },
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: buildPreviewBoundary(),
  });

  return freezeDeep({
    ...body,
    receipt_hash: prefixedSha256(body),
  });
}

export function verifyPoiMintPreview(preview) {
  if (!preview || typeof preview !== "object") {
    return freezeDeep({
      valid: false,
      reason: "preview_missing_or_malformed",
      recomputed_receipt_hash: null,
    });
  }
  const { receipt_hash, ...body } = preview;
  const recomputed = prefixedSha256(body);
  const valid =
    preview.schema === POI_MINT_PREVIEW_SCHEMA &&
    preview.truth_label === POI_MINT_PREVIEW_TRUTH_LABEL &&
    preview.live_mint === false &&
    preview.no_wallet === true &&
    preview.no_sale === true &&
    receipt_hash === recomputed;

  return freezeDeep({
    valid,
    reason: valid ? null : "preview_hash_or_boundary_mismatch",
    recomputed_receipt_hash: recomputed,
  });
}

export function renderPoiMintPreview(report) {
  if (!report || report.schema !== POI_MINT_PREVIEW_SCHEMA) {
    return "Dema economy poi-mint-preview: invalid report";
  }
  return [
    "POI MINT PREVIEW · ECONOMY_SIMULATION_ONLY",
    `Live mint: ${report.live_mint}`,
    `Allowed if live rails existed: ${report.mint_allowed_if_live}`,
    `BZR-C preview: ${report.bzc_mint_preview}`,
    `BZR-I preview: ${report.bzi_mint_preview}`,
    `Blocked: ${report.blocked_reason ?? "none"}`,
    `Receipt hash: ${report.receipt_hash}`,
    "No wallet · no sale · no live token supply",
  ].join("\n");
}
