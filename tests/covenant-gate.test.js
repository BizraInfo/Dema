/**
 * Covenant Gate v0.1 tests (PROTOTYPE)
 *
 * [PROTOTYPE] — Exercises the minimal screening + micro-consent + receipt flow from the Omnidirectional Audit.
 * No production claims.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as covenant from "../packages/covenant/src/covenant-gate.js";

const { screenProposal, signReceipt } = covenant;

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

function withFixedTime(epochSeconds, fn) {
  const originalNow = Date.now;
  Date.now = () => epochSeconds * 1000;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

function screenAt(proposal, epochSeconds = 1770000000) {
  return withFixedTime(epochSeconds, () => screenProposal(proposal));
}

function expectedConsentPhrase(decision) {
  assert.equal(typeof covenant.expectedConsentPhrase, "function");
  return covenant.expectedConsentPhrase(decision);
}

test("CovenantGate screens a clean proposal and requires micro-consent", () => {
  const decision = screenProposal(EXAMPLE_PROPOSAL);

  assert.equal(decision.schema, "bizra.dema.graduation_decision.v0.1");
  assert.equal(decision.project_id, "ocean-cleanup-dao");
  assert.equal(decision.status, "needs_human_consent"); // partial evidence → needs consent
  assert.match(decision.proposal_hash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Array.isArray(decision.thought_packets));
  assert.ok(decision.thought_packets.length > 0);
  assert.ok(Array.isArray(decision.proof_gap));
  assert.ok(decision.claim_labels);

  // No guaranteed APR → verification packet exists
  const hasVerification = decision.thought_packets.some(p => p.type === "verification" && /No guaranteed APR/.test(p.claim));
  assert.equal(hasVerification, true);
});

test("C2: same proposal and createdAt produce the same decision ID", () => {
  const reorderedProposal = {
    impact_evidence: [
      {
        hash: "sha256:demo",
        source: "demo_oracle_1",
        type: "oracle_attestation",
      },
    ],
    debt_ratio: 0.05,
    guaranteed_apr: false,
    team_disclosure: true,
    sector: "environmental",
    project_id: "ocean-cleanup-dao",
  };

  const a = screenAt(EXAMPLE_PROPOSAL);
  const b = screenAt(reorderedProposal);

  assert.equal(a.proposal_hash, b.proposal_hash);
  assert.equal(a.decision_id, b.decision_id);
});

test("C2: changed project_id changes decision ID", () => {
  const a = screenAt(EXAMPLE_PROPOSAL);
  const b = screenAt({ ...EXAMPLE_PROPOSAL, project_id: "mangrove-restoration-dao" });

  assert.notEqual(a.decision_id, b.decision_id);
});

test("C2: changed debt_ratio changes decision ID", () => {
  const a = screenAt(EXAMPLE_PROPOSAL);
  const b = screenAt({ ...EXAMPLE_PROPOSAL, debt_ratio: 0.06 });

  assert.notEqual(a.decision_id, b.decision_id);
});

test("C2: changed nested evidence hash changes decision ID", () => {
  const a = screenAt(EXAMPLE_PROPOSAL);
  const b = screenAt({
    ...EXAMPLE_PROPOSAL,
    impact_evidence: [
      {
        type: "oracle_attestation",
        source: "demo_oracle_1",
        hash: "sha256:changed",
      },
    ],
  });

  assert.notEqual(a.decision_id, b.decision_id);
});

test("C3: the same decision content in the same second yields the same decision ID", () => {
  // decision_id addresses the DECISION, not the occurrence. A human is shown
  // `GO: SIGN COVENANT RECEIPT <id>` in the proposal run and types it back in a
  // later consent run; if the id carried entropy or sub-second resolution, exact
  // string consent could never validate. This is the contract CSJ-03 used to deny.
  const a = screenAt(EXAMPLE_PROPOSAL);
  const b = screenAt(EXAMPLE_PROPOSAL);

  assert.equal(a.created_at, b.created_at);
  assert.equal(a.decision_id, b.decision_id);
  assert.equal(expectedConsentPhrase(a), expectedConsentPhrase(b));
});

test("C3: the next second yields a different decision ID for the same proposal", () => {
  const a = screenAt(EXAMPLE_PROPOSAL, 1770000000);
  const b = screenAt(EXAMPLE_PROPOSAL, 1770000001);

  assert.equal(b.created_at, a.created_at + 1);
  assert.notEqual(a.decision_id, b.decision_id);
  assert.equal(a.proposal_hash, b.proposal_hash, "the proposal itself did not change");
});

test("C2: missing proposal still screens as unknown with a proposal hash", () => {
  const decision = screenAt(undefined);

  assert.equal(decision.project_id, "unknown");
  assert.match(decision.proposal_hash, /^sha256:[a-f0-9]{64}$/);
});

test("signReceipt requires decision-bound exact micro-consent and produces a demo receipt", () => {
  const decision = screenAt(EXAMPLE_PROPOSAL);
  const phrase = expectedConsentPhrase(decision);

  assert.equal(phrase, `GO: SIGN COVENANT RECEIPT ${decision.decision_id}`);
  assert.throws(() => signReceipt(decision, "GO"), /Micro-consent failed/);
  assert.throws(() => signReceipt(decision, `${phrase} `), /Micro-consent failed/);

  const receipt = signReceipt(decision, phrase, "test-only-covenant-key");
  assert.equal(receipt.payload.schema, "bizra.dema.consent_receipt.v0.1");
  assert.equal(receipt.payload.micro_consent.decision_id, decision.decision_id);
  assert.equal(receipt.payload.micro_consent.expected_phrase, phrase);
  assert.ok(receipt.receipt_id.startsWith("sha256:"));
  assert.ok(receipt.signature);
  assert.ok(/DEMO signature only/.test(receipt.warning));
});

test("S1: signReceipt fails closed when no signing key is provided (demo fallback removed)", () => {
  const decision = screenAt(EXAMPLE_PROPOSAL);
  const phrase = expectedConsentPhrase(decision);

  assert.throws(() => signReceipt(decision, phrase), /signing key missing/i);
  assert.throws(() => signReceipt(decision, phrase, ""), /signing key missing/i);
  assert.throws(() => signReceipt(decision, phrase, "   "), /signing key missing/i);
  assert.throws(() => signReceipt(decision, phrase, Buffer.alloc(0)), /signing key missing/i);
});

test("C2: malformed decision ID cannot produce consent phrase or receipt", () => {
  const malformedDecision = {
    status: "needs_human_consent",
    decision_id: "",
  };

  assert.throws(() => covenant.expectedConsentPhrase(malformedDecision), /invalid Covenant decision_id/i);
  assert.throws(() => signReceipt(malformedDecision, "GO: SIGN COVENANT RECEIPT "), /invalid Covenant decision_id/i);
});

test("blocked on prohibited sector", () => {
  const bad = { ...EXAMPLE_PROPOSAL, sector: "gambling" };
  const decision = screenProposal(bad);
  assert.equal(decision.status, "blocked");
  const hasObjection = decision.thought_packets.some(p => p.type === "objection" && /prohibited/.test(p.claim));
  assert.equal(hasObjection, true);
});

test("C2: blocked decision cannot be signed", () => {
  const decision = screenAt({ ...EXAMPLE_PROPOSAL, sector: "gambling" });

  assert.equal(decision.status, "blocked");
  assert.throws(() => signReceipt(decision, "GO"), /blocked Covenant decision/i);
});
