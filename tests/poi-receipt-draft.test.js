import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPoiReceiptDraft,
  POI_RECEIPT_DRAFT_SCHEMA,
  POI_RECEIPT_DRAFT_TRUTH_LABEL,
} from "../packages/core/src/poi-receipt-draft.js";
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

function composeReceiptPlan(records) {
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
  return { receipt_plan, shareability, historical, benefit_preview };
}

test("schema, truth label, deterministic draft_id", () => {
  const { receipt_plan } = composeReceiptPlan([
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const a = buildPoiReceiptDraft({ receipt_plan });
  const b = buildPoiReceiptDraft({ receipt_plan });
  assert.equal(a.schema, POI_RECEIPT_DRAFT_SCHEMA);
  assert.equal(a.truth_label, POI_RECEIPT_DRAFT_TRUTH_LABEL);
  assert.equal(a.draft_id, b.draft_id);
  assert.equal(a.unsigned_body.signature_status, "UNSIGNED");
  assert.equal(a.boundary.signature_emitted, false);
  assert.equal(a.boundary.poi_receipt_minted, false);
});

test("blocked resources excluded from unsigned draft slots", () => {
  const { receipt_plan } = composeReceiptPlan([
    fileRecord("family/photo.jpg", "media"),
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildPoiReceiptDraft({ receipt_plan });
  const blocked = report.resource_drafts.find((d) => d.top_level === "family");
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.included_in_unsigned_draft, false);
  assert.deepEqual(blocked.evidence_slots, []);
});

test("strengthenable resources get pending evidence slots", () => {
  const { receipt_plan } = composeReceiptPlan([
    fileRecord("proofs/impact.json", "receipt_or_proof"),
  ]);
  const report = buildPoiReceiptDraft({ receipt_plan });
  const draft = report.resource_drafts[0];
  assert.equal(draft.included_in_unsigned_draft, true);
  assert.ok(draft.evidence_slots.length > 0);
  assert.equal(draft.evidence_slots[0].status, "pending_local_gather");
  assert.equal(draft.evidence_slots[0].payload_ref, null);
});

test("content-consent resources include explicit consent slot", () => {
  const { receipt_plan } = composeReceiptPlan([
    fileRecord("docs/notes.md", "document"),
  ]);
  const report = buildPoiReceiptDraft({ receipt_plan });
  const draft = report.resource_drafts[0];
  const types = draft.evidence_slots.map((s) => s.artifact_type);
  assert.ok(types.includes("explicit_typed_consent_record"));
});

test("global proof gaps become global evidence actions", () => {
  const { receipt_plan } = composeReceiptPlan([
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildPoiReceiptDraft({ receipt_plan });
  assert.ok(report.global_evidence_actions.length > 0);
  assert.ok(
    report.global_evidence_actions.some((a) =>
      a.gap.startsWith("canon_witness:"),
    ),
  );
});

test("fails closed on invalid receipt plan input", () => {
  const report = buildPoiReceiptDraft({ receipt_plan: { schema: "wrong" } });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_receipt_plan");
  assert.equal(report.draft_id, null);
});

test("unsigned body hash changes when plan changes", () => {
  const planA = composeReceiptPlan([
    fileRecord("proofs/a.json", "receipt_or_proof"),
  ]).receipt_plan;
  const planB = composeReceiptPlan([
    fileRecord("app/package.json", "code_project"),
  ]).receipt_plan;
  const draftA = buildPoiReceiptDraft({ receipt_plan: planA });
  const draftB = buildPoiReceiptDraft({ receipt_plan: planB });
  assert.notEqual(draftA.draft_id, draftB.draft_id);
});

test("no filesystem write or signature in boundary", () => {
  const { receipt_plan } = composeReceiptPlan([
    fileRecord("app/package.json", "code_project"),
  ]);
  const report = buildPoiReceiptDraft({ receipt_plan });
  assert.equal(report.boundary.filesystem_write_performed, false);
  assert.equal(report.boundary.chain_head_advanced, false);
  assert.equal(report.summary.seal_status, "NOT_SEALED");
});
