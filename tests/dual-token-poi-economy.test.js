import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL,
  LIVE_TOKEN_MINT_TRUTH_LABEL,
  POI_MINT_PREVIEW_TRUTH_LABEL,
  buildDualTokenPoiEconomyCanon,
  previewPoiMintDecision,
  verifyPoiMintPreview,
} from "../packages/core/src/dual-token-poi-economy.js";
import { evaluatePoiMintRule } from "../packages/core/src/poi-mint-rule.js";
import {
  buildServiceEconomyLedgerEntry,
  verifyServiceEconomyLedgerEntry,
} from "../packages/core/src/service-economy-ledger.js";

const SHA = (ch) => `sha256:${ch.repeat(64)}`;

function verifiedReceipt(overrides = {}) {
  return {
    schema: "bizra.poi.claim.v0.1",
    claim_id: "poi_claim_001",
    mission_id: "mission_001",
    actor: "node0_operator",
    actor_type: "human",
    beneficiary: "beneficiary_alpha",
    result_artifact: SHA("a"),
    work_receipt: SHA("b"),
    causal_trace: SHA("c"),
    consent_receipt: SHA("d"),
    impact_evidence: [SHA("e")],
    status: "VERIFIED",
    fate: { status: "PASS" },
    sat: { status: "VALIDATED" },
    source_kind: "RESULT_RECEIPT",
    anti_abuse: {
      proof_exists: true,
      consent_exists: true,
      impact_score_exists: true,
      job_completed: true,
      quality_score_min_pass: true,
      not_duplicate: true,
    },
    metrics: {
      base_capacity_units: 10,
      service_completion_score: 1,
      proof_confidence: 0.8,
      quality_multiplier: 1.25,
      anti_abuse_multiplier: 1,
      fairness_dampener: 1,
      impact_score: 2,
      beneficiary_weight: 1.5,
      durability_score: 1,
      additionality_score: 0.5,
      human_review_weight: 1,
    },
    truth_label: "POI_VERIFIED_RECEIPT",
    ...overrides,
  };
}

function preview(receipt, extra = {}) {
  return previewPoiMintDecision({
    impactReceipt: receipt,
    generatedAtIso: "2026-07-01T08:00:00.000Z",
    ...extra,
  });
}

test("DT-00 canon declares designed-not-live dual-token economy", () => {
  const canon = buildDualTokenPoiEconomyCanon({
    generatedAtIso: "2026-07-01T08:00:00.000Z",
  });
  assert.equal(canon.truth_label, DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL);
  assert.equal(canon.live_token_mint, LIVE_TOKEN_MINT_TRUTH_LABEL);
  assert.equal(canon.tokens.bzc.symbol, "BZR-C");
  assert.equal(canon.tokens.bzi.symbol, "BZR-I");
  assert.equal(canon.boundary.receipt_mint_performed, false);
  assert.equal(canon.boundary.network_used, false);
  assert.ok(Object.isFrozen(canon));
});

test("DT-01 verified PoI can produce simulated BZR-C/BZR-I preview", () => {
  const result = preview(verifiedReceipt());
  assert.equal(result.truth_label, POI_MINT_PREVIEW_TRUTH_LABEL);
  assert.equal(result.live_mint, false);
  assert.equal(result.mint_allowed_if_live, true);
  assert.equal(result.bzc_mint_preview, 10);
  assert.equal(result.bzi_mint_preview, 1.2);
  assert.equal(result.blocked_reason, null);
  assert.match(result.receipt_hash, /^sha256:[a-f0-9]{64}$/);
});

test("DT-02 unverified PoI produces zero mint", () => {
  const result = preview(verifiedReceipt({ status: "POI_CANDIDATE_NOT_VERIFIED" }));
  assert.equal(result.mint_allowed_if_live, false);
  assert.equal(result.bzc_mint_preview, 0);
  assert.equal(result.bzi_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("poi_not_verified"));
});

test("DT-03 cost receipt alone produces zero BZR-I", () => {
  const result = preview(
    verifiedReceipt({
      source_kind: "COST_RECEIPT",
      impact_evidence: [],
    }),
  );
  assert.equal(result.bzc_mint_preview, 0);
  assert.equal(result.bzi_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("cost_receipt_is_not_impact"));
});

test("DT-04 proof-of-spend produces zero impact mint", () => {
  const result = preview(
    verifiedReceipt({
      source_kind: "PROOF_OF_SPEND",
      proof_of_spend_receipt: SHA("f"),
    }),
  );
  assert.equal(result.bzi_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("proof_of_spend_is_not_value"));
});

test("DT-05 simulation truth_label blocks live mint", () => {
  const result = preview(verifiedReceipt(), { requestedLiveMint: true });
  assert.equal(result.live_mint, false);
  assert.equal(result.live_mint_truth_label, LIVE_TOKEN_MINT_TRUTH_LABEL);
  assert.equal(result.no_wallet, true);
  assert.equal(result.no_sale, true);
  assert.ok(result.blocked_reasons.includes("live_mint_blocked_until_external_review"));
});

test("DT-06 duplicate contribution produces zero mint", () => {
  const result = preview(
    verifiedReceipt({
      anti_abuse: {
        ...verifiedReceipt().anti_abuse,
        not_duplicate: false,
      },
    }),
  );
  assert.equal(result.bzc_mint_preview, 0);
  assert.equal(result.bzi_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("anti_abuse_failed:not_duplicate"));
});

test("DT-07 missing consent produces zero mint", () => {
  const result = preview(
    verifiedReceipt({
      consent_receipt: null,
      anti_abuse: {
        ...verifiedReceipt().anti_abuse,
        consent_exists: false,
      },
    }),
  );
  assert.equal(result.bzc_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("anti_abuse_failed:consent_exists"));
});

test("DT-08 failed job produces zero mint", () => {
  const result = preview(
    verifiedReceipt({
      anti_abuse: {
        ...verifiedReceipt().anti_abuse,
        job_completed: false,
      },
    }),
  );
  assert.equal(result.bzc_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("anti_abuse_failed:job_completed"));
});

test("DT-09 quality below threshold produces zero mint", () => {
  const result = preview(
    verifiedReceipt({
      anti_abuse: {
        ...verifiedReceipt().anti_abuse,
        quality_score_min_pass: false,
      },
    }),
  );
  assert.equal(result.bzi_mint_preview, 0);
  assert.ok(
    result.blocked_reasons.includes("anti_abuse_failed:quality_score_min_pass"),
  );
});

test("DT-10 agent self-reward attempt rejected", () => {
  const result = preview(
    verifiedReceipt({
      actor: "P3_Forge",
      actor_type: "agent",
      beneficiary: "P3_Forge",
      self_reward_attempt: true,
    }),
  );
  assert.equal(result.mint_allowed_if_live, false);
  assert.equal(result.bzc_mint_preview, 0);
  assert.equal(result.bzi_mint_preview, 0);
  assert.ok(result.blocked_reasons.includes("agent_self_reward_rejected"));
});

test("DT-11 Gini above threshold applies dampener", () => {
  const result = preview(
    verifiedReceipt({
      fairness: {
        concentration_gini: 0.92,
        gini_threshold: 0.7,
        dampener: 0.25,
      },
    }),
  );
  assert.equal(result.mint_allowed_if_live, true);
  assert.equal(result.fairness.action, "DAMPENED");
  assert.equal(result.fairness.applied_dampener, 0.25);
  assert.equal(result.bzc_mint_preview, 2.5);
  assert.equal(result.bzi_mint_preview, 0.3);
});

test("DT-12 receipt hash replay deterministic", () => {
  const a = preview(verifiedReceipt());
  const b = preview(verifiedReceipt());
  assert.equal(a.receipt_hash, b.receipt_hash);
  const verify = verifyPoiMintPreview(a);
  assert.equal(verify.valid, true);
  assert.equal(verify.recomputed_receipt_hash, a.receipt_hash);
});

test("DT-13 rule evaluator and service ledger stay preview-only", () => {
  const rule = evaluatePoiMintRule({ impactReceipt: verifiedReceipt() });
  assert.equal(rule.allowed_if_live, true);
  assert.equal(rule.live_mint, false);

  const entry = buildServiceEconomyLedgerEntry({
    service_type: "AaaS_CODE_REVIEW_AGENT",
    payer: "node0_operator",
    provider: "P3_Forge",
    bzc_spend_preview: 3.5,
    source_receipt_hash: rule.receipt_hash,
    result_accepted: true,
    generatedAtIso: "2026-07-01T08:00:00.000Z",
  });
  assert.equal(entry.truth_label, "SERVICE_ECONOMY_LEDGER_PREVIEW_ONLY");
  assert.equal(entry.live_transfer, false);
  assert.equal(entry.boundary.receipt_mint_performed, false);
  assert.equal(verifyServiceEconomyLedgerEntry(entry).valid, true);
});

test("DT-14 CLI emits JSON mint preview from an impact receipt file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-poi-preview-"));
  try {
    const receiptPath = join(dir, "poi.json");
    await writeFile(receiptPath, JSON.stringify(verifiedReceipt(), null, 2));
    const run = spawnSync(
      process.execPath,
      [
        "apps/cli/src/index.js",
        "economy",
        "poi-mint-preview",
        "--impact-receipt",
        receiptPath,
        "--json",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.truth_label, POI_MINT_PREVIEW_TRUTH_LABEL);
    assert.equal(parsed.live_mint, false);
    assert.equal(parsed.bzc_mint_preview, 10);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
