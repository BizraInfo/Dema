import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPoiReceiptSealPreview,
  POI_RECEIPT_SEAL_PREVIEW_SCHEMA,
  POI_RECEIPT_SEAL_PREVIEW_TRUTH_LABEL,
  POI_RECEIPT_SEAL_CONSENT_TEMPLATE,
} from "../packages/core/src/poi-receipt-seal-preview.js";
import { buildPoiReceiptDraft } from "../packages/core/src/poi-receipt-draft.js";
import { buildPoiReceiptEligibilityPlan } from "../packages/core/src/poi-receipt-eligibility-plan.js";
import { buildUrpContributionBenefitPreview } from "../packages/core/src/urp-contribution-benefit-preview.js";
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

function composeReceiptDraft(records) {
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
  const receipt_plan = buildPoiReceiptEligibilityPlan({
    benefit_preview,
    shareability,
    historical,
    lookback_years: 3,
  });
  const receipt_draft = buildPoiReceiptDraft({
    receipt_plan,
    lookback_years: 3,
  });
  return { receipt_draft };
}

test("schema, truth label, deterministic preview_id", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const a = buildPoiReceiptSealPreview({ receipt_draft });
  const b = buildPoiReceiptSealPreview({ receipt_draft });
  assert.equal(a.schema, POI_RECEIPT_SEAL_PREVIEW_SCHEMA);
  assert.equal(a.truth_label, POI_RECEIPT_SEAL_PREVIEW_TRUTH_LABEL);
  assert.equal(a.preview_id, b.preview_id);
  assert.equal(a.seal_performed, false);
  assert.equal(a.boundary.seal_performed, false);
});

test("pending evidence slots produce seal blockers", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("proofs/impact.json", "receipt_or_proof"),
  ]);
  const report = buildPoiReceiptSealPreview({ receipt_draft });
  assert.ok(report.seal_blockers.some((b) => b.startsWith("pending_evidence_slots")));
  assert.equal(report.seal_readiness, "blocked_pending_evidence");
});

test("consent phrase embeds draft_id", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const report = buildPoiReceiptSealPreview({ receipt_draft });
  assert.ok(report.consent_phrase.includes(receipt_draft.draft_id));
  assert.equal(
    report.consent_phrase_template,
    POI_RECEIPT_SEAL_CONSENT_TEMPLATE,
  );
});

test("content-consent resources add explicit consent blocker", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("docs/notes.md", "document"),
  ]);
  const report = buildPoiReceiptSealPreview({ receipt_draft });
  assert.ok(
    report.seal_blockers.some((b) => b.startsWith("explicit_consent_required")),
  );
  assert.equal(report.seal_readiness, "blocked_pending_evidence");
});

test("global proof gaps appear as pending global actions blocker", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildPoiReceiptSealPreview({ receipt_draft });
  assert.ok(
    report.seal_blockers.some((b) => b.startsWith("pending_global_actions")),
  );
});

test("fails closed on invalid receipt draft input", () => {
  const report = buildPoiReceiptSealPreview({ receipt_draft: { schema: "wrong" } });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_receipt_draft");
  assert.equal(report.preview_id, null);
});

test("seal gates remain DESIGNED_NOT_LIVE for identity and SAT", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const report = buildPoiReceiptSealPreview({ receipt_draft });
  const identity = report.seal_gates.find((g) => g.gate_id === "identity_binding");
  assert.equal(identity.status, "DESIGNED_NOT_LIVE");
});

test("blocked-only resources yield no strengthenable draft blocker", () => {
  const { receipt_draft } = composeReceiptDraft([
    fileRecord("family/photo.jpg", "media"),
  ]);
  const report = buildPoiReceiptSealPreview({ receipt_draft });
  assert.ok(report.seal_blockers.includes("no_strengthenable_resources_in_draft"));
});
