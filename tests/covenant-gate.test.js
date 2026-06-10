/**
 * Covenant Gate v0.1 tests (PROTOTYPE)
 *
 * [PROTOTYPE] — Exercises the minimal screening + micro-consent + receipt flow from the Omnidirectional Audit.
 * No production claims.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  screenProposal,
  signReceipt,
} from "../packages/covenant/src/covenant-gate.js";

const EXAMPLE_PROPOSAL = {
  project_id: "ocean-cleanup-dao",
  sector: "environmental",
  team_disclosure: true,
  guaranteed_apr: false,
  debt_ratio: 0.05,
  impact_evidence: [
    {
      type: "oracle_attestation",
      source: "demo_oracle_1",
      hash: "sha256:demo",
    },
  ],
};

test("CovenantGate screens a clean proposal and requires micro-consent", () => {
  const decision = screenProposal(EXAMPLE_PROPOSAL);

  assert.equal(decision.schema, "bizra.dema.graduation_decision.v0.1");
  assert.equal(decision.project_id, "ocean-cleanup-dao");
  assert.equal(decision.status, "needs_human_consent"); // partial evidence → needs consent
  assert.ok(Array.isArray(decision.thought_packets));
  assert.ok(decision.thought_packets.length > 0);
  assert.ok(Array.isArray(decision.proof_gap));
  assert.ok(decision.claim_labels);

  // No guaranteed APR → verification packet exists
  const hasVerification = decision.thought_packets.some(
    (p) => p.type === "verification" && /No guaranteed APR/.test(p.claim),
  );
  assert.equal(hasVerification, true);
});

test("signReceipt requires exact 'GO' micro-consent and produces a demo receipt", () => {
  const decision = screenProposal(EXAMPLE_PROPOSAL);

  assert.throws(() => signReceipt(decision, "NO"), /Micro-consent failed/);

  const receipt = signReceipt(decision, "GO");
  assert.equal(receipt.payload.schema, "bizra.dema.consent_receipt.v0.1");
  assert.ok(receipt.receipt_id.startsWith("sha256:"));
  assert.ok(receipt.signature);
  assert.ok(/DEMO signature only/.test(receipt.warning));
});

test("blocked on prohibited sector", () => {
  const bad = { ...EXAMPLE_PROPOSAL, sector: "gambling" };
  const decision = screenProposal(bad);
  assert.equal(decision.status, "blocked");
  const hasObjection = decision.thought_packets.some(
    (p) => p.type === "objection" && /prohibited/.test(p.claim),
  );
  assert.equal(hasObjection, true);
});
