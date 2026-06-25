import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUrpContributionBenefitPreview,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
} from "../packages/core/src/urp-contribution-benefit-preview.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
  buildHomebaseAssetAwareness,
} from "../packages/core/src/homebase-asset-awareness.js";
import {
  HOMEBASE_SHAREABILITY_SCHEMA,
  HOMEBASE_SHAREABILITY_TRUTH_LABEL,
  buildHomebaseShareability,
} from "../packages/core/src/homebase-shareability.js";
import {
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
  buildNode0HistoricalContributionVerification,
} from "../packages/core/src/node0-historical-contribution-verification.js";
import { LOCAL_ASSET_INVENTORY_SCHEMA } from "../packages/core/src/local-asset-awareness.js";

const FIXED_NOW = "2026-06-25T12:00:00.000Z";

function fileRecord(relative_path, category, name) {
  return {
    record_id: `id:${relative_path}`,
    kind: "file",
    name: name ?? relative_path.split("/").pop(),
    relative_path,
    extension: `.${relative_path.split(".").pop()}`,
    category,
    size_bytes: 100,
    mtime_iso: FIXED_NOW,
    risk_flags: [],
    content_hash: null,
    content_preview: null,
  };
}

function makeAwareness(records, extra = {}) {
  const inventory = {
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    valid: true,
    error: null,
    generated_at_iso: FIXED_NOW,
    root: { display: "/tmp/fix", path_hash: "sha256:fix", exists: true },
    limits: { max_depth: 2, max_entries: 5000, follow_symlinks: false },
    summary: {
      records_count: records.length,
      files_count: records.length,
      dirs_count: 0,
      symlinks_count: 0,
      denied_count: extra.denied?.length ?? 0,
      truncated: false,
    },
    categories: records.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
    records,
    denied: extra.denied ?? [],
    warnings: [],
    boundary: { file_content_read: false, network_used: false },
  };
  return buildHomebaseAssetAwareness({ inventory });
}

function composeStack(records, extra = {}) {
  const awareness = makeAwareness(records, extra);
  const shareability = buildHomebaseShareability({ awareness });
  const historical = buildNode0HistoricalContributionVerification({
    awareness,
    git_evidence: Object.freeze({
      is_git_repository: true,
      lookback_years: 3,
      commits_in_window: 120,
      first_commit_iso: "2023-01-01T00:00:00.000Z",
      last_commit_iso: FIXED_NOW,
    }),
    canon_witnesses: Object.freeze([
      Object.freeze({
        id: "root_source_of_truth",
        present: true,
        content_read: false,
      }),
    ]),
    hardware_observation: Object.freeze({
      cpu_cores_logical: 16,
      memory_total_gb: 64,
      gpus: Object.freeze([Object.freeze({ name: "GPU", vram_gb: 24 })]),
    }),
    lookback_years: 3,
  });
  return { awareness, shareability, historical };
}

test("schema, truth label, deterministic report_id", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("app/package.json", "code_project"),
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const a = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  const b = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  assert.equal(a.schema, URP_CONTRIBUTION_BENEFIT_PREVIEW_SCHEMA);
  assert.equal(a.truth_label, URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL);
  assert.equal(a.report_id, b.report_id);
  assert.equal(a.boundary.file_content_read, false);
  assert.equal(a.boundary.network_used, false);
  assert.equal(a.boundary.token_minted, false);
  assert.equal(a.boundary.wallet_accessed, false);
  assert.equal(a.boundary.urp_submission_performed, false);
  assert.equal(a.boundary.upload_performed, false);
});

test("blocked assets receive no benefit estimate", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("family/photo.jpg", "media"),
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  const blocked = report.resource_previews.find(
    (p) => p.top_level === "family",
  );
  assert.equal(blocked.shareability_level, "blocked_do_not_share");
  assert.equal(blocked.estimated_eligibility_band, "none");
  assert.equal(blocked.benefit_estimate, null);
  assert.deepEqual(blocked.possible_benefit_classes, []);
});

test("shareable metadata paths stay metadata-level in preview", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("models/weights.gguf", "model_artifact"),
  ]);
  const report = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  const model = report.resource_previews[0];
  assert.equal(model.contribution_class, "hardware");
  assert.ok(
    model.possible_benefit_classes.includes("service_credit") ||
      model.possible_benefit_classes.includes("SAT_review_needed"),
  );
  assert.equal(model.requires_future_consent, false);
});

test("content-consent assets require future consent", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("docs/notes.md", "document"),
  ]);
  const report = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  const doc = report.resource_previews[0];
  assert.equal(doc.shareability_level, "content_consent_required");
  assert.equal(doc.requires_future_consent, true);
  assert.ok(doc.possible_benefit_classes.includes("SAT_review_needed"));
});

test("hardware contribution class surfaces compute benefit classes", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("models/model.bin", "model_artifact"),
  ]);
  const report = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  assert.equal(report.resource_previews[0].contribution_class, "hardware");
  assert.ok(
    report.resource_previews[0].possible_benefit_classes.includes(
      "service_credit",
    ),
  );
});

test("historical verification maps to reward eligibility preview only", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("app/package.json", "code_project"),
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const report = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  assert.ok(report.historical_reward_preview);
  assert.equal(report.historical_reward_preview.preview_only, true);
  assert.equal(
    report.historical_reward_preview.truth_label,
    URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
  );
  assert.equal(report.historical_reward_preview.token_mint_performed, false);
});

test("fails closed on invalid compose inputs", () => {
  const report = buildUrpContributionBenefitPreview({
    awareness: { schema: "wrong" },
    shareability: { schema: HOMEBASE_SHAREABILITY_SCHEMA },
  });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_asset_awareness");
});

test("urp readiness and contribution class rollup", () => {
  const { awareness, shareability, historical } = composeStack([
    fileRecord("app/package.json", "code_project"),
    fileRecord("data/set.csv", "dataset"),
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const report = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
  });
  assert.ok(["local_only", "urp_later_preview"].includes(report.urp_readiness));
  assert.equal(report.contribution_class_rollup.length, 4);
  const total = report.contribution_class_rollup.reduce(
    (sum, row) => sum + row.resource_count,
    0,
  );
  assert.equal(total, report.resource_previews.length);
});
