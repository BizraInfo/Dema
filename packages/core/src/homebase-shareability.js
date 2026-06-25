// DEMA-HOMEBASE-SHAREABILITY-1A — metadata-only shareability analysis.
//
// Classifies homebase asset clusters and categories into what can safely be
// shared, what requires content consent, and what must stay private. Composes
// homebase asset awareness only — NO content reads, NO network, NO URP
// submission, NO upload, NO token action.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
} from "./homebase-asset-awareness.js";

export const HOMEBASE_SHAREABILITY_SCHEMA =
  "bizra.dema.homebase_shareability.v0.1";
export const HOMEBASE_SHAREABILITY_TRUTH_LABEL =
  "DEMA_HOMEBASE_SHAREABILITY_METADATA_ONLY";

const SHAREABILITY_LEVELS = Object.freeze([
  "shareable_metadata_only",
  "shareable_with_consent",
  "content_consent_required",
  "manual_review_required",
  "blocked_do_not_share",
]);

const CONSENT_LEVELS = Object.freeze([
  "none",
  "metadata_only",
  "content_review",
  "explicit_typed_go",
]);

const CATEGORY_DEFAULTS = Object.freeze({
  receipt_or_proof: Object.freeze({
    shareability_level: "shareable_with_consent",
    consent_required: "explicit_typed_go",
    privacy_risk: "low",
    urp_compatibility: "consent_gated",
    benefit_class: "reputation_evidence",
  }),
  code_project: Object.freeze({
    shareability_level: "shareable_with_consent",
    consent_required: "content_review",
    privacy_risk: "medium",
    urp_compatibility: "consent_gated",
    benefit_class: "knowledge_product",
  }),
  document: Object.freeze({
    shareability_level: "content_consent_required",
    consent_required: "content_review",
    privacy_risk: "medium",
    urp_compatibility: "consent_gated",
    benefit_class: "knowledge_product",
  }),
  model_artifact: Object.freeze({
    shareability_level: "shareable_with_consent",
    consent_required: "metadata_only",
    privacy_risk: "low",
    urp_compatibility: "compatible_preview",
    benefit_class: "hardware_compute",
  }),
  dataset: Object.freeze({
    shareability_level: "content_consent_required",
    consent_required: "content_review",
    privacy_risk: "high",
    urp_compatibility: "consent_gated",
    benefit_class: "data_contribution",
  }),
  media: Object.freeze({
    shareability_level: "blocked_do_not_share",
    consent_required: "explicit_typed_go",
    privacy_risk: "high",
    urp_compatibility: "blocked",
    benefit_class: "none",
  }),
  archive: Object.freeze({
    shareability_level: "manual_review_required",
    consent_required: "content_review",
    privacy_risk: "medium",
    urp_compatibility: "consent_gated",
    benefit_class: "bundle_review",
  }),
  unknown: Object.freeze({
    shareability_level: "manual_review_required",
    consent_required: "content_review",
    privacy_risk: "medium",
    urp_compatibility: "consent_gated",
    benefit_class: "manual_review",
  }),
});

const GLOBAL_DO_NOT_SHARE = Object.freeze([
  "secrets_and_key_patterns",
  "private_keys_and_wallets",
  "raw_personal_media_without_consent",
  "unlicensed_or_unknown_rights_data",
  "confidential_client_files",
  "anything_without_explicit_typed_consent",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No file content was read — classification uses names, extensions, paths, and metadata only.",
  "Shareability levels are advisory previews, not URP acceptance or SAT verification.",
  "No upload, deletion, token action, or URP submission was performed.",
  "URP compatibility is preview-only; federation and reward rails remain DESIGNED_NOT_LIVE.",
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

function pathLooksSensitive(topLevel) {
  const lower = String(topLevel || "").toLowerCase();
  return /(secret|credential|password|wallet|private|family|\.ssh)/.test(lower);
}

function classifyCluster(cluster) {
  const defaults =
    CATEGORY_DEFAULTS[cluster.category] ?? CATEGORY_DEFAULTS.unknown;
  let shareability_level = defaults.shareability_level;
  let consent_required = defaults.consent_required;
  let privacy_risk = defaults.privacy_risk;
  let urp_compatibility = defaults.urp_compatibility;
  let benefit_class = defaults.benefit_class;
  const reasons = [`category:${cluster.category}`];

  if (pathLooksSensitive(cluster.top_level)) {
    shareability_level = "blocked_do_not_share";
    consent_required = "explicit_typed_go";
    privacy_risk = "high";
    urp_compatibility = "blocked";
    benefit_class = "none";
    reasons.push("sensitive_top_level_name");
  }

  let recommended_next_action = "No action — metadata-only preview";
  if (shareability_level === "shareable_metadata_only") {
    recommended_next_action =
      "May share metadata summary after operator review";
  } else if (shareability_level === "shareable_with_consent") {
    recommended_next_action =
      "Obtain explicit consent before any URP contribution preview";
  } else if (shareability_level === "content_consent_required") {
    recommended_next_action =
      "Content consent and license review required before sharing";
  } else if (shareability_level === "blocked_do_not_share") {
    recommended_next_action = "Do not share — keep local and private";
  } else {
    recommended_next_action = "Manual review required before any share decision";
  }

  return Object.freeze({
    assessment_id: `sha256:${sha256(
      stableStringify({
        cluster_id: cluster.cluster_id,
        shareability_level,
      }),
    )}`,
    cluster_id: cluster.cluster_id,
    top_level: cluster.top_level,
    category: cluster.category,
    record_count: cluster.record_count,
    shareability_level,
    consent_required,
    privacy_risk,
    urp_compatibility,
    benefit_class,
    proof_required: shareability_level.startsWith("shareable")
      ? "receipt_and_metadata_boundary"
      : shareability_level === "content_consent_required"
        ? "content_consent_plus_receipt"
        : "not_applicable",
    reasons: Object.freeze(reasons),
    recommended_next_action,
    preview_only: true,
    economic_action_performed: false,
  });
}

function buildCategoryRollup(clusterAssessments) {
  const map = new Map();
  for (const assessment of clusterAssessments) {
    const key = assessment.category;
    const existing = map.get(key) ?? {
      category: key,
      cluster_count: 0,
      record_count: 0,
      levels: {},
    };
    existing.cluster_count += 1;
    existing.record_count += assessment.record_count;
    existing.levels[assessment.shareability_level] =
      (existing.levels[assessment.shareability_level] ?? 0) + 1;
    map.set(key, existing);
  }
  return freezeDeep(
    [...map.values()]
      .map((entry) =>
        Object.freeze({
          category: entry.category,
          cluster_count: entry.cluster_count,
          record_count: entry.record_count,
          dominant_shareability_level: Object.entries(entry.levels).sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0],
          shareability_level_counts: Object.freeze({ ...entry.levels }),
        }),
      )
      .sort((a, b) => a.category.localeCompare(b.category)),
  );
}

function aggregateLists(clusterAssessments) {
  const can_share = [];
  const requires_content_consent = [];
  const blocked = [];
  const urp_later_preview = [];

  for (const a of clusterAssessments) {
    const label = `${a.category}@${a.top_level}`;
    if (
      a.shareability_level === "shareable_metadata_only" ||
      a.shareability_level === "shareable_with_consent"
    ) {
      can_share.push(label);
      if (a.urp_compatibility !== "blocked") {
        urp_later_preview.push(label);
      }
    } else if (
      a.shareability_level === "content_consent_required" ||
      a.shareability_level === "manual_review_required"
    ) {
      requires_content_consent.push(label);
    } else if (a.shareability_level === "blocked_do_not_share") {
      blocked.push(label);
    }
  }

  return freezeDeep({
    can_share_preview: Object.freeze([...new Set(can_share)].sort()),
    requires_content_consent: Object.freeze(
      [...new Set(requires_content_consent)].sort(),
    ),
    blocked_do_not_share: Object.freeze([...new Set(blocked)].sort()),
    urp_compatible_later_preview: Object.freeze(
      [...new Set(urp_later_preview)].sort(),
    ),
    global_do_not_share: GLOBAL_DO_NOT_SHARE,
  });
}

function scoreShareability(clusterAssessments, awareness) {
  if (!clusterAssessments.length) return 0;
  const weights = {
    shareable_metadata_only: 100,
    shareable_with_consent: 75,
    content_consent_required: 40,
    manual_review_required: 25,
    blocked_do_not_share: 0,
  };
  const totalRecords = clusterAssessments.reduce(
    (sum, a) => sum + a.record_count,
    0,
  );
  let weighted = 0;
  for (const a of clusterAssessments) {
    weighted += (weights[a.shareability_level] ?? 0) * a.record_count;
  }
  let score = totalRecords > 0 ? weighted / totalRecords : 0;
  const riskFlags = awareness?.risk_flags ?? [];
  if (riskFlags.includes("secret_or_key_pattern_denied")) score -= 20;
  if (riskFlags.includes("wallet_or_secret_directory_denied")) score -= 20;
  if (awareness?.summary?.truncated) score -= 10;
  return clampScore(score);
}

function scoreRisk(awareness, clusterAssessments) {
  let score = 0;
  const blocked = clusterAssessments.filter(
    (a) => a.shareability_level === "blocked_do_not_share",
  ).length;
  const media = awareness?.categories?.media ?? 0;
  score += Math.min(30, blocked * 5);
  score += Math.min(25, media > 0 ? 15 : 0);
  for (const flag of awareness?.risk_flags ?? []) {
    if (flag.includes("secret") || flag.includes("wallet")) score += 15;
  }
  return clampScore(score);
}

function buildBoundary(inventoryBoundary = {}) {
  return freezeDeep({
    ...buildPreviewBoundary(),
    ...inventoryBoundary,
    file_content_read: false,
    network_used: false,
    scanned_root_mutated: false,
    upload_performed: false,
    urp_submission_performed: false,
    token_minted: false,
    economic_action_performed: false,
  });
}

export function buildHomebaseShareability({ awareness } = {}) {
  const awarenessValid =
    awareness &&
    awareness.schema === HOMEBASE_ASSET_AWARENESS_SCHEMA &&
    awareness.truth_label === HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL;

  if (!awarenessValid) {
    return freezeDeep({
      schema: HOMEBASE_SHAREABILITY_SCHEMA,
      truth_label: HOMEBASE_SHAREABILITY_TRUTH_LABEL,
      valid: false,
      error: "invalid_or_missing_asset_awareness",
      generated_at_iso: awareness?.generated_at_iso ?? "",
      awareness: awareness ?? null,
      cluster_assessments: Object.freeze([]),
      category_rollup: Object.freeze([]),
      shareability_summary: null,
      scores: Object.freeze({}),
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: buildBoundary(),
    });
  }

  const clusters = awareness.clusters ?? [];
  const cluster_assessments = freezeDeep(
    clusters.map(classifyCluster).sort((a, b) =>
      a.top_level.localeCompare(b.top_level),
    ),
  );
  const category_rollup = buildCategoryRollup(cluster_assessments);
  const shareability_summary = aggregateLists(cluster_assessments);
  const shareability_score = scoreShareability(cluster_assessments, awareness);
  const risk_score = scoreRisk(awareness, cluster_assessments);

  const report_id = `sha256:${sha256(
    stableStringify({
      root_hash: awareness.root?.path_hash,
      cluster_count: cluster_assessments.length,
      shareability_score,
    }),
  )}`;

  return freezeDeep({
    schema: HOMEBASE_SHAREABILITY_SCHEMA,
    truth_label: HOMEBASE_SHAREABILITY_TRUTH_LABEL,
    valid: awareness.valid === true,
    error: awareness.error ?? null,
    mode: "metadata_only",
    generated_at_iso: awareness.generated_at_iso,
    report_id,
    root: awareness.root,
    awareness_schema: awareness.schema,
    awareness_truth_label: awareness.truth_label,
    cluster_assessments,
    category_rollup,
    shareability_summary,
    scores: Object.freeze({
      shareability_score,
      risk_score,
    }),
    shareability_levels_reference: SHAREABILITY_LEVELS,
    consent_levels_reference: CONSENT_LEVELS,
    next_recommended_step:
      "Proceed to URP-CONTRIBUTION-BENEFIT-PREVIEW-1A only after consent boundaries are accepted",
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: buildBoundary(awareness.boundary),
  });
}

export function renderHomebaseShareabilitySummary(report) {
  if (!report || report.schema !== HOMEBASE_SHAREABILITY_SCHEMA) {
    return "Dema homebase shareability: invalid report";
  }
  const summary = report.shareability_summary;
  const lines = [
    "DEMA HOMEBASE SHAREABILITY · METADATA ONLY",
    `truth: ${report.truth_label}`,
    `root: ${report.root?.display ?? "unknown"}`,
    `clusters assessed: ${report.cluster_assessments.length}`,
    `shareability score: ${report.scores?.shareability_score ?? 0} · risk: ${report.scores?.risk_score ?? 0}`,
    `can share (preview): ${summary?.can_share_preview?.length ?? 0}`,
    `content consent required: ${summary?.requires_content_consent?.length ?? 0}`,
    `blocked: ${summary?.blocked_do_not_share?.length ?? 0}`,
  ];
  lines.push(
    "Boundary: metadata-only · no content · no network · no URP submission · no upload",
  );
  return lines.join("\n");
}
