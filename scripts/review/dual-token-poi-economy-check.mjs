#!/usr/bin/env node
/**
 * DUAL-TOKEN-POI-ECONOMY-CANON-1A review gate.
 *
 * Hermetic check only: docs + pure local preview kernel. No wallet, no chain,
 * no network, no sale, no live mint.
 */
import {
  DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL,
  LIVE_TOKEN_MINT_TRUTH_LABEL,
  POI_MINT_PREVIEW_TRUTH_LABEL,
  buildDualTokenPoiEconomyCanon,
  previewPoiMintDecision,
  verifyPoiMintPreview,
} from "../../packages/core/src/dual-token-poi-economy.js";
import {
  buildServiceEconomyLedgerEntry,
  verifyServiceEconomyLedgerEntry,
} from "../../packages/core/src/service-economy-ledger.js";

const SHA = (ch) => `sha256:${ch.repeat(64)}`;

const sampleReceipt = {
  schema: "bizra.poi.claim.v0.1",
  claim_id: "poi_check_001",
  mission_id: "mission_check_001",
  actor: "node0_operator",
  actor_type: "human",
  beneficiary: "beneficiary_check",
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
};

function fail(message) {
  console.error(`DUAL-TOKEN-POI-ECONOMY-CANON-1A: ${message}`);
  process.exit(1);
}

const canon = buildDualTokenPoiEconomyCanon({
  generatedAtIso: "2026-07-01T08:00:00.000Z",
});
if (canon.truth_label !== DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL) {
  fail("canon truth_label mismatch");
}
if (canon.live_token_mint !== LIVE_TOKEN_MINT_TRUTH_LABEL) {
  fail("live token mint label mismatch");
}

const allowedPreview = previewPoiMintDecision({
  impactReceipt: sampleReceipt,
  generatedAtIso: "2026-07-01T08:00:00.000Z",
});
if (allowedPreview.truth_label !== POI_MINT_PREVIEW_TRUTH_LABEL) {
  fail("preview truth_label mismatch");
}
if (allowedPreview.live_mint !== false || allowedPreview.no_wallet !== true) {
  fail("preview boundary violated");
}
if (
  allowedPreview.bzc_mint_preview !== 10 ||
  allowedPreview.bzi_mint_preview !== 1.2
) {
  fail("deterministic preview amounts drifted");
}
if (!verifyPoiMintPreview(allowedPreview).valid) {
  fail("preview replay verification failed");
}

const blockedPreview = previewPoiMintDecision({
  impactReceipt: {
    ...sampleReceipt,
    status: "POI_CANDIDATE_NOT_VERIFIED",
  },
});
if (
  blockedPreview.bzc_mint_preview !== 0 ||
  blockedPreview.bzi_mint_preview !== 0 ||
  !blockedPreview.blocked_reasons.includes("poi_not_verified")
) {
  fail("unverified PoI did not zero mint preview");
}

const spendPreview = previewPoiMintDecision({
  impactReceipt: {
    ...sampleReceipt,
    source_kind: "PROOF_OF_SPEND",
  },
});
if (!spendPreview.blocked_reasons.includes("proof_of_spend_is_not_value")) {
  fail("proof-of-spend value blocker missing");
}

const serviceEntry = buildServiceEconomyLedgerEntry({
  service_type: "AaaS_CODE_REVIEW_AGENT",
  payer: "node0_operator",
  provider: "P3_Forge",
  bzc_spend_preview: 3.5,
  source_receipt_hash: allowedPreview.receipt_hash,
  result_accepted: true,
  generatedAtIso: "2026-07-01T08:00:00.000Z",
});
if (!verifyServiceEconomyLedgerEntry(serviceEntry).valid) {
  fail("service ledger replay verification failed");
}

console.log(
  JSON.stringify({
    gate: "DUAL-TOKEN-POI-ECONOMY-CANON-1A",
    status: "PASS",
    canon_truth_label: DUAL_TOKEN_POI_ECONOMY_TRUTH_LABEL,
    preview_truth_label: POI_MINT_PREVIEW_TRUTH_LABEL,
    live_token_mint: LIVE_TOKEN_MINT_TRUTH_LABEL,
    bzc_mint_preview: allowedPreview.bzc_mint_preview,
    bzi_mint_preview: allowedPreview.bzi_mint_preview,
    no_wallet: true,
    no_sale: true,
    no_live_mint: true,
    receipt_hash: allowedPreview.receipt_hash,
  }),
);
