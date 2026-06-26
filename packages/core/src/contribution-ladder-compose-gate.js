// CONTRIBUTION-LADDER-COMPOSE-GATE-1A — pure compose gate for economic genesis ladder.
//
// Chains metadata-only kernels: inventory → awareness → shareability →
// historical → benefit preview → receipt-plan. Read-only fixture compose;
// no content read, no network, no mint, wallet, URP, or SAT settlement.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  LOCAL_ASSET_INVENTORY_SCHEMA,
} from "./local-asset-awareness.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
  buildHomebaseAssetAwareness,
} from "./homebase-asset-awareness.js";
import {
  HOMEBASE_SHAREABILITY_SCHEMA,
  HOMEBASE_SHAREABILITY_TRUTH_LABEL,
  buildHomebaseShareability,
} from "./homebase-shareability.js";
import {
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
  buildNode0HistoricalContributionVerification,
} from "./node0-historical-contribution-verification.js";
import {
  URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
  buildUrpContributionBenefitPreview,
} from "./urp-contribution-benefit-preview.js";
import {
  POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA,
  POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
  buildPoiReceiptEligibilityPlan,
} from "./poi-receipt-eligibility-plan.js";

export const CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA =
  "bizra.dema.contribution_ladder_compose_gate.v0.1";
export const CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL =
  "CONTRIBUTION_LADDER_COMPOSE_GATE_DOCS_ONLY";

export const CONTRIBUTION_LADDER_STEPS = Object.freeze([
  Object.freeze({ pr: "#264", stage: "asset_awareness", kernel: "homebase-asset-awareness" }),
  Object.freeze({ pr: "#265", stage: "historical_verification", kernel: "node0-historical-contribution-verification" }),
  Object.freeze({ pr: "#266", stage: "shareability", kernel: "homebase-shareability" }),
  Object.freeze({ pr: "#267", stage: "benefit_preview", kernel: "urp-contribution-benefit-preview" }),
  Object.freeze({ pr: "#268", stage: "receipt_plan", kernel: "poi-receipt-eligibility-plan" }),
]);

export const LADDER_FIXTURE_GENERATED_AT = "2026-06-26T12:00:00.000Z";
export const LADDER_FIXTURE_LOOKBACK_YEARS = 3;

export const LADDER_FIXTURE_RECORDS = Object.freeze([
  Object.freeze({
    record_id: "id:app/package.json",
    kind: "file",
    name: "package.json",
    relative_path: "app/package.json",
    extension: ".json",
    category: "code_project",
    size_bytes: 2048,
    mtime_iso: LADDER_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:proofs/receipt.json",
    kind: "file",
    name: "receipt.json",
    relative_path: "proofs/receipt.json",
    extension: ".json",
    category: "receipt_or_proof",
    size_bytes: 512,
    mtime_iso: LADDER_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:models/weights.gguf",
    kind: "file",
    name: "weights.gguf",
    relative_path: "models/weights.gguf",
    extension: ".gguf",
    category: "model_artifact",
    size_bytes: 1_000_000,
    mtime_iso: LADDER_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
]);

export const LADDER_FIXTURE_GIT_EVIDENCE = Object.freeze({
  is_git_repository: true,
  lookback_years: LADDER_FIXTURE_LOOKBACK_YEARS,
  commits_in_window: 180,
  first_commit_iso: "2023-01-15T00:00:00.000Z",
  last_commit_iso: LADDER_FIXTURE_GENERATED_AT,
});

export const LADDER_FIXTURE_CANON_WITNESSES = Object.freeze([
  Object.freeze({
    id: "root_source_of_truth",
    present: true,
    content_read: false,
  }),
  Object.freeze({
    id: "the_message_pdf",
    present: false,
    content_read: false,
  }),
]);

export const LADDER_FIXTURE_HARDWARE = Object.freeze({
  cpu_cores_logical: 16,
  memory_total_gb: 64,
  gpus: Object.freeze([
    Object.freeze({ name: "GPU", vram_gb: 24 }),
  ]),
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function boundaryAllFalse(boundary) {
  const canonical = buildPreviewBoundary();
  if (!boundary || typeof boundary !== "object") return false;
  return Object.keys(canonical).every((key) => boundary[key] === false);
}

export function buildContributionLadderFixtureInventory({
  records = LADDER_FIXTURE_RECORDS,
  generated_at_iso = LADDER_FIXTURE_GENERATED_AT,
} = {}) {
  const categories = records.reduce((acc, record) => {
    acc[record.category] = (acc[record.category] ?? 0) + 1;
    return acc;
  }, {});

  return freezeDeep({
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    valid: true,
    error: null,
    generated_at_iso,
    root: Object.freeze({
      display: "/home/node0/fixture",
      path_hash: "sha256:ladder_fixture_root",
      exists: true,
    }),
    limits: Object.freeze({
      max_depth: 3,
      max_entries: 5000,
      follow_symlinks: false,
    }),
    summary: Object.freeze({
      records_count: records.length,
      files_count: records.length,
      dirs_count: 0,
      symlinks_count: 0,
      denied_count: 0,
      truncated: false,
    }),
    categories: freezeDeep(categories),
    records: freezeDeep([...records]),
    denied: Object.freeze([]),
    warnings: Object.freeze([]),
    boundary: Object.freeze({
      file_content_read: false,
      network_used: false,
    }),
  });
}

/**
 * @param {object} params
 * @param {object} params.inventory LOCAL_ASSET_INVENTORY_SCHEMA envelope
 * @param {object} [params.git_evidence]
 * @param {readonly object[]} [params.canon_witnesses]
 * @param {object} [params.hardware_observation]
 * @param {number} [params.lookback_years]
 * @param {string} [params.generated_at_iso]
 */
export function composeContributionLadder({
  inventory,
  git_evidence = LADDER_FIXTURE_GIT_EVIDENCE,
  canon_witnesses = LADDER_FIXTURE_CANON_WITNESSES,
  hardware_observation = LADDER_FIXTURE_HARDWARE,
  lookback_years = LADDER_FIXTURE_LOOKBACK_YEARS,
  generated_at_iso = LADDER_FIXTURE_GENERATED_AT,
} = {}) {
  const awareness = buildHomebaseAssetAwareness({ inventory });
  const shareability = buildHomebaseShareability({ awareness });
  const historical = buildNode0HistoricalContributionVerification({
    awareness,
    git_evidence,
    canon_witnesses,
    hardware_observation,
    lookback_years,
    generated_at_iso,
  });
  const benefit_preview = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
    lookback_years,
    generated_at_iso,
  });
  const receipt_plan = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
    lookback_years,
    generated_at_iso,
  });

  return freezeDeep({
    schema: CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA,
    truth_label: CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL,
    ladder_steps: CONTRIBUTION_LADDER_STEPS,
    inventory,
    awareness,
    shareability,
    historical,
    benefit_preview,
    receipt_plan,
    boundary: buildPreviewBoundary(),
  });
}

export function verifyContributionLadderComposeGate(composed) {
  const blocked_by = [];

  if (!composed || composed.schema !== CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA) {
    blocked_by.push("invalid_compose_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (composed.truth_label !== CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL) {
    blocked_by.push("invalid_compose_truth_label");
  }

  const stages = [
    ["awareness", composed.awareness, HOMEBASE_ASSET_AWARENESS_SCHEMA, HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL],
    ["shareability", composed.shareability, HOMEBASE_SHAREABILITY_SCHEMA, HOMEBASE_SHAREABILITY_TRUTH_LABEL],
    ["historical", composed.historical, NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA, NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL],
    ["benefit_preview", composed.benefit_preview, URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA, URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL],
    ["receipt_plan", composed.receipt_plan, POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA, POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL],
  ];

  for (const [name, report, schema, truthLabel] of stages) {
    if (!report || report.schema !== schema) {
      blocked_by.push(`invalid_${name}_schema`);
      continue;
    }
    if (report.truth_label !== truthLabel) {
      blocked_by.push(`invalid_${name}_truth_label`);
    }
    if (report.valid !== true) {
      blocked_by.push(`${name}_not_valid`);
    }
    if (!boundaryAllFalse(report.boundary)) {
      blocked_by.push(`${name}_boundary_not_all_false`);
    }
  }

  if (!composed.receipt_plan?.resource_receipt_plans?.length) {
    blocked_by.push("receipt_plan_empty");
  }

  const economicFlags = [
    "poi_receipt_minted",
    "token_minted",
    "wallet_accessed",
    "urp_submission_performed",
    "sat_settlement_performed",
    "economic_action_performed",
  ];
  const receiptBoundary = composed.receipt_plan?.boundary ?? {};
  for (const flag of economicFlags) {
    if (receiptBoundary[flag] === true) {
      blocked_by.push(`economic_boundary_violation:${flag}`);
    }
  }

  if (!boundaryAllFalse(composed.boundary)) {
    blocked_by.push("compose_boundary_not_all_false");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runContributionLadderComposeGate({
  inventory = buildContributionLadderFixtureInventory(),
} = {}) {
  const composed = composeContributionLadder({ inventory });
  const verified = verifyContributionLadderComposeGate(composed);
  return freezeDeep({
    ok: verified.ok,
    schema: CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA,
    truth_label: CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL,
    verified,
    ladder_step_count: CONTRIBUTION_LADDER_STEPS.length,
    resource_receipt_plan_count:
      composed.receipt_plan?.resource_receipt_plans?.length ?? 0,
    composed,
  });
}
