import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPoiReceiptEligibilityPlan,
  POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA,
  POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
} from "../packages/core/src/poi-receipt-eligibility-plan.js";
import {
  buildUrpContributionBenefitPreview,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
} from "../packages/core/src/urp-contribution-benefit-preview.js";
import { buildHomebaseAssetAwareness } from "../packages/core/src/homebase-asset-awareness.js";
import { buildHomebaseShareability } from "../packages/core/src/homebase-shareability.js";
import { buildNode0HistoricalContributionVerification } from "../packages/core/src/node0-historical-contribution-verification.js";
import { LOCAL_ASSET_INVENTORY_SCHEMA } from "../packages/core/src/local-asset-awareness.js";

const FIXED_NOW = "2026-06-25T12:00:00.000Z";

function fileRecord(relative_path, category) {
  return {
    record_id: `id:${relative_path}`,
    kind: "file",
    name: relative_path.split("/").pop(),
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

function composeBenefitStack(records) {
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
      denied_count: 0,
      truncated: false,
    },
    categories: records.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
    records,
    denied: [],
    warnings: [],
    boundary: { file_content_read: false, network_used: false },
  };
  const awareness = buildHomebaseAssetAwareness({ inventory });
  const shareability = buildHomebaseShareability({ awareness });
  const historical = buildNode0HistoricalContributionVerification({
    awareness,
    git_evidence: Object.freeze({
      is_git_repository: true,
      lookback_years: 3,
      commits_in_window: 200,
      first_commit_iso: "2023-01-01T00:00:00.000Z",
      last_commit_iso: FIXED_NOW,
    }),
    canon_witnesses: Object.freeze([
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
    ]),
    hardware_observation: Object.freeze({
      cpu_cores_logical: 16,
      gpus: Object.freeze([]),
    }),
    lookback_years: 3,
  });
  const benefit_preview = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
    lookback_years: 3,
  });
  return { shareability, historical, benefit_preview };
}

test("schema, truth label, deterministic report_id", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("app/package.json", "code_project"),
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const a = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  const b = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  assert.equal(a.schema, POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA);
  assert.equal(a.truth_label, POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL);
  assert.equal(a.report_id, b.report_id);
  assert.equal(a.boundary.file_content_read, false);
  assert.equal(a.boundary.poi_receipt_minted, false);
  assert.equal(a.boundary.urp_submission_performed, false);
  assert.equal(a.boundary.token_minted, false);
});

test("blocked resources get empty proof artifact list", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("family/photo.jpg", "media"),
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  const blocked = report.resource_receipt_plans.find(
    (p) => p.top_level === "family",
  );
  assert.equal(blocked.blocked, true);
  assert.deepEqual(blocked.proof_artifacts_required, []);
  assert.equal(blocked.strengthens_eligibility_to_preview, "none");
});

test("strengthenable resources list proof artifacts without mint", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("proofs/impact.json", "receipt_or_proof"),
  ]);
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  const plan = report.resource_receipt_plans[0];
  assert.equal(plan.blocked, false);
  assert.ok(plan.proof_artifacts_required.includes("metadata_boundary_receipt"));
  assert.ok(plan.proof_artifacts_required.includes("pat_action_receipt"));
  assert.ok(plan.proof_artifacts_required.includes("sat_independent_review"));
  assert.notEqual(plan.strengthens_eligibility_to_preview, "none");
});

test("content-consent resources require explicit consent in plan", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("docs/notes.md", "document"),
  ]);
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  const plan = report.resource_receipt_plans[0];
  assert.equal(plan.blocked, false);
  assert.equal(plan.requires_explicit_consent, true);
  assert.ok(
    plan.proof_artifacts_required.includes("explicit_typed_consent_record"),
  );
});

test("hardware resources require benchmark summary artifact", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("models/weights.gguf", "model_artifact"),
  ]);
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  const plan = report.resource_receipt_plans[0];
  assert.equal(plan.contribution_class, "hardware");
  assert.ok(
    plan.proof_artifacts_required.includes("hardware_benchmark_summary"),
  );
});

test("global proof gaps surface missing canon witnesses", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  assert.ok(
    report.global_proof_gaps.includes("canon_witness:the_message_pdf"),
  );
});

test("fails closed on invalid benefit preview input", () => {
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview: { schema: "wrong" },
  });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_benefit_preview");
});

test("SAT verification plan is preview-only DESIGNED_NOT_LIVE", () => {
  const { shareability, historical, benefit_preview } = composeBenefitStack([
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const report = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
  });
  assert.equal(report.sat_verification_plan.preview_only, true);
  assert.equal(report.sat_verification_plan.status, "DESIGNED_NOT_LIVE");
  assert.equal(benefit_preview.truth_label, URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL);
});
