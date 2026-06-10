#!/usr/bin/env node
/**
 * ADR-021 Impact Scoring Mock - Minimal local mock only (G4 after G3 proof of test boundary)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 *
 * Ultra-micro implementation per unlock ladder:
 * - Prove scoring boundary (ADR-021 + 7-cat scaffold + local gates + attempted 4-rail) → unlock mock scoring.
 * - Exact-string micro-consent only.
 * - 5 strict markers (parallel to ADR-020 proposal envelope).
 * - Anti-gaming / forbidden promotion enforcement (no reward eligibility, token, marketplace, public economic, etc.).
 * - Returns a receipted MOCK object only. No real score computation, no eligibility, no on-chain, no public signal.
 * - Self-test when invoked directly.
 *
 * Still blocked: contracts, real scoring, token logic, reward distribution, marketplace, Node1, URP bridge, Shariah claim.
 */

import { createHash } from "crypto";

const FORBIDDEN_PROMOTION_TERMS = new Set([
  "guaranteed",
  "apr",
  "fixed return",
  "reward eligibility",
  "impact scoring",
  "public economic",
  "marketplace",
  "claimable",
  "earn",
  "token allocation",
  "real value",
  "redeem",
  "payout",
]);

export function createMockImpactScore(
  { requireConsent },
  context = loadExampleScoringContext(),
) {
  if (requireConsent !== "GO: MOCK SCORING FOR ADR-021") {
    throw new Error("exact consent required: GO: MOCK SCORING FOR ADR-021");
  }

  // Exhaustive serialization check for forbidden (O(1) Set lookup after lower)
  const serialized = JSON.stringify(context).toLowerCase();
  for (const term of FORBIDDEN_PROMOTION_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(
        `FORBIDDEN_PROMOTION: detected "${term}" in scoring context`,
      );
    }
  }

  // 5-marker proof (test-boundary proven; mock only)
  const proof = {
    claim_label: context.claim_label,
    anti_gaming_enforced: true,
    consent_required: true,
    review_boundary: true,
    receipt_expectation: {
      schema: "bizra.impact.scoring.mock.v0.1",
      placeholder: true,
      note: "MOCK ONLY - no real value, no reward eligibility, no token, no marketplace, no public economic signal [PROTOTYPE] [DESIGNED_NOT_LIVE]",
    },
  };

  const canonical = JSON.stringify({ context, proof }, (k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  const id = "sha256:" + createHash("sha256").update(canonical).digest("hex");

  return {
    id,
    mockScore: {
      ...context,
      proof,
      value:
        "MOCK_ONLY [PROTOTYPE] [DESIGNED_NOT_LIVE] — NO REWARD ELIGIBILITY — TEST BOUNDARY ONLY",
      generated_at: Date.now(),
    },
    created_at: Date.now(),
  };
}

export function loadExampleScoringContext() {
  return {
    id: "ex-mock-score-001",
    claim_label:
      "Mock contribution measurement test boundary only [PROTOTYPE] [DESIGNED_NOT_LIVE]",
    description:
      "Minimal local mock measurement only — after ADR-021 test boundary + scaffold proven. Excludes contracts, real measurement logic, token logic, rewards, public mechanisms, public copy, Node1, URP bridge, Shariah claim [DECLARED]",
    categories: [
      "claim_label",
      "anti_gaming",
      "consent",
      "review_boundary",
      "receipt",
    ],
    evidence_refs: ["ADR-021", "tests/impact-scoring-mvp.test.js"],
    // Deliberately no numeric "score" or eligibility fields that could be misinterpreted
  };
}

// Self-test (executed only when run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const ctx = loadExampleScoringContext();
    const mock = createMockImpactScore(
      { requireConsent: "GO: MOCK SCORING FOR ADR-021" },
      ctx,
    );

    console.log(
      "Peak ultra micro mock scoring created (post scoring boundary G3 proof).",
    );
    console.log("ID prefix:", mock.id.slice(0, 16));
    console.log("claim_label present:", !!mock.mockScore.proof.claim_label);
    console.log(
      "anti_gaming_enforced:",
      mock.mockScore.proof.anti_gaming_enforced,
    );
    console.log("consent_required:", mock.mockScore.proof.consent_required);
    console.log("review_boundary:", mock.mockScore.proof.review_boundary);
    console.log(
      "receipt_expectation schema:",
      mock.mockScore.proof.receipt_expectation.schema,
    );
    console.log("value (MOCK_ONLY, no eligibility):", mock.mockScore.value);

    // Assertions for the 5 markers (parallel to proposal)
    if (!mock.mockScore.proof.claim_label)
      throw new Error("claim_label missing");
    if (!mock.mockScore.proof.anti_gaming_enforced)
      throw new Error("anti_gaming_enforced false");
    if (!mock.mockScore.proof.consent_required)
      throw new Error("consent_required false");
    if (!mock.mockScore.proof.review_boundary)
      throw new Error("review_boundary false");
    if (
      !mock.mockScore.proof.receipt_expectation ||
      !mock.mockScore.proof.receipt_expectation.placeholder
    )
      throw new Error("receipt_expectation incomplete");

    console.log(
      "All 5 markers asserted. Mock scoring boundary respected. [PROTOTYPE] [DESIGNED_NOT_LIVE]",
    );
    process.exit(0);
  } catch (e) {
    console.error("Mock scoring self-test FAILED:", e.message);
    process.exit(1);
  }
}
