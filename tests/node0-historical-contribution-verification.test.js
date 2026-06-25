import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNode0HistoricalContributionVerification,
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA,
  NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL,
  URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL,
} from "../packages/core/src/node0-historical-contribution-verification.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
} from "../packages/core/src/homebase-asset-awareness.js";

const FIXED_NOW = "2026-06-25T12:00:00.000Z";

function makeAwareness(extra = {}) {
  return {
    schema: HOMEBASE_ASSET_AWARENESS_SCHEMA,
    truth_label: HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
    valid: true,
    error: null,
    mode: "metadata_only",
    generated_at_iso: FIXED_NOW,
    root: {
      display: "/tmp/node0",
      path_hash: "sha256:abc",
      exists: true,
    },
    limits: { max_depth: 2, max_entries: 5000, follow_symlinks: false },
    summary: {
      records_count: 10,
      files_count: 8,
      dirs_count: 2,
      symlinks_count: 0,
      denied_count: 0,
      truncated: false,
    },
    categories: {
      code_project: 5,
      document: 3,
      receipt_or_proof: 2,
    },
    clusters: [],
    hidden_gem_candidates: [],
    monetization_candidates: [],
    risk_flags: [],
    denied_count: 0,
    boundary: {
      file_content_read: false,
      network_used: false,
      scanned_root_mutated: false,
    },
    ...extra,
  };
}

const gitEvidence = Object.freeze({
  is_git_repository: true,
  lookback_years: 3,
  window_start_iso: "2023-06-25T12:00:00.000Z",
  window_end_iso: FIXED_NOW,
  commits_in_window: 250,
  first_commit_iso: "2023-08-01T10:00:00.000Z",
  last_commit_iso: FIXED_NOW,
});

const canonWitnesses = Object.freeze([
  Object.freeze({
    id: "root_source_of_truth",
    witness_role: "public_canon",
    relative_path: "docs/BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md",
    present: true,
    content_read: false,
  }),
  Object.freeze({
    id: "the_message_pdf",
    witness_role: "arabic_root_al_risala",
    relative_path: "themassage.pdf",
    present: false,
    content_read: false,
  }),
]);

test("schema, truth label, and deterministic report_id", () => {
  const awareness = makeAwareness();
  const a = buildNode0HistoricalContributionVerification({
    awareness,
    git_evidence: gitEvidence,
    canon_witnesses: canonWitnesses,
    hardware_observation: { cpu_cores_logical: 24, gpus: [{ name: "RTX 4090" }] },
  });
  const b = buildNode0HistoricalContributionVerification({
    awareness,
    git_evidence: gitEvidence,
    canon_witnesses: canonWitnesses,
    hardware_observation: { cpu_cores_logical: 24, gpus: [{ name: "RTX 4090" }] },
  });
  assert.equal(a.schema, NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_SCHEMA);
  assert.equal(a.truth_label, NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_TRUTH_LABEL);
  assert.equal(a.report_id, b.report_id);
  assert.equal(a.boundary.token_minted, false);
  assert.equal(a.boundary.file_content_read, false);
});

test("contribution categories and verified asset classes", () => {
  const report = buildNode0HistoricalContributionVerification({
    awareness: makeAwareness(),
    git_evidence: gitEvidence,
    canon_witnesses: canonWitnesses,
  });
  const types = report.contribution_categories.map((c) => c.contribution_type);
  assert.deepEqual(types, [
    "hardware",
    "data",
    "knowledge_product",
    "impact",
  ]);
  assert.ok(report.verified_asset_classes.some((c) => c.asset_class === "code_project"));
});

test("reward eligibility preview is honest pre-token", () => {
  const report = buildNode0HistoricalContributionVerification({
    awareness: makeAwareness(),
    git_evidence: gitEvidence,
    canon_witnesses: canonWitnesses,
  });
  const preview = report.reward_eligibility_preview;
  assert.equal(preview.preview_only, true);
  assert.equal(preview.truth_label, URP_CONTRIBUTION_BENEFIT_PREVIEW_TRUTH_LABEL);
  assert.equal(preview.token_mint_performed, false);
  assert.equal(preview.urp_reward_rails_live, false);
  assert.match(preview.estimated_benefit_if_accepted, /preview only/i);
});

test("URP 50% commons covenant preview", () => {
  const report = buildNode0HistoricalContributionVerification({
    awareness: makeAwareness(),
    git_evidence: gitEvidence,
    canon_witnesses: canonWitnesses,
  });
  const covenant = report.urp_commons_commitment_preview;
  assert.equal(covenant.commitment_fraction, 0.5);
  assert.equal(covenant.retained_fraction, 0.5);
  assert.equal(covenant.preview_only, true);
  assert.equal(covenant.sat_treasury_management, "DESIGNED_NOT_LIVE");
});

test("risk flags increase risk score and shareability hints block secrets", () => {
  const report = buildNode0HistoricalContributionVerification({
    awareness: makeAwareness({
      risk_flags: ["secret_or_key_pattern_denied"],
      denied_count: 2,
    }),
    git_evidence: gitEvidence,
    canon_witnesses: canonWitnesses,
  });
  assert.ok(report.scores.risk_score > 0);
  assert.ok(report.shareability_hints.do_not_share.includes("secrets_and_key_patterns"));
});

test("fails closed on invalid awareness input", () => {
  const report = buildNode0HistoricalContributionVerification({
    awareness: { schema: "wrong" },
  });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_asset_awareness");
});

test("uncertainty flags when git or canon missing", () => {
  const report = buildNode0HistoricalContributionVerification({
    awareness: makeAwareness(),
    git_evidence: Object.freeze({
      is_git_repository: false,
      commits_in_window: 0,
    }),
    canon_witnesses: Object.freeze([]),
  });
  assert.ok(report.uncertainty_flags.includes("no_git_history_at_root"));
  assert.ok(report.uncertainty_flags.includes("no_canon_witness_paths_present"));
});
