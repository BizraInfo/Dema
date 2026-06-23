import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRsiProposalPreview,
  RSI_PROPOSAL_PREVIEW_SCHEMA,
} from "../packages/core/src/rsi-proposal-preview.js";

function safeCandidate() {
  return {
    name: "quality metrics next slice",
    proposed_action: "add a deterministic preview-only quality metric proposal",
    rationale: "The candidate is evidence-backed and narrows a measured documentation drift gap.",
    expected_outcome: "A reviewer can decide the next safe micro-slice without executing it.",
  };
}

function safeEvidence() {
  return [
    "docs/audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md",
    "docs/02-architecture/NODE0_ROSETTA_CONSTITUTION_v0_1.md",
    { id: "sat_step7", path: "packages/perf/src/perf-improvement.js", status: "merged" },
  ];
}

function safeEvents() {
  return [
    { type: "clean_commit" },
    { type: "gate_passed" },
    { type: "stable_receipts" },
    { type: "blocker_reduced" },
  ];
}

test("builds a deterministic frozen RSI proposal preview", () => {
  const input = {
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "SNR", "Ihsan", "Giants"],
    processEvents: safeEvents(),
    currentScores: { v2_framework: 2.48, operational: 85 },
  };
  const a = buildRsiProposalPreview(input);
  const b = buildRsiProposalPreview(input);
  assert.equal(a.schema, RSI_PROPOSAL_PREVIEW_SCHEMA);
  assert.equal(a.truth_label, "RSI_PROPOSAL_PREVIEW_ONLY");
  assert.equal(a.mode, "PREVIEW_ONLY");
  assert.equal(a.certifies, false);
  assert.equal(a.recommendation, "PROPOSE");
  assert.equal(a.executed_action, null);
  assert.equal(a.action_executed_by_preview, false);
  assert.match(a.proposal_hash, /^[a-f0-9]{64}$/);
  assert.equal(a.proposal_hash, b.proposal_hash);
  assert.equal(Object.isFrozen(a), true);
});

test("rejects missing evidence rather than inventing proof", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: [],
    candidate: safeCandidate(),
    targetFrameworks: ["RSI"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "REJECT");
  assert.equal(out.recommendation_reason, "missing_evidence");
  assert.equal(out.checks.find((item) => item.check === "evidence_present").pass, false);
});

test("rejects live-loop and forbidden authority claims", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: {
      name: "unsafe rsi activation",
      proposed_action: "activate runtime loop and mint reward token",
      rationale: "This tries to skip preview boundaries.",
      expected_outcome: "Live runtime activation.",
    },
    targetFrameworks: ["RSI"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "REJECT");
  assert.match(out.recommendation_reason, /^forbidden_action_claim:/);
  assert.ok(out.forbidden_claims.includes("live_loop"));
  assert.ok(out.forbidden_claims.includes("economic_activation"));
});

test("holds when signal is too weak", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "SNR"],
    signalEvents: [],
    noiseEvents: ["vague", "unsupported", "overclaim"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "HOLD");
  assert.equal(out.recommendation_reason, "proposal_needs_more_signal_or_proof");
});

test("fails closed on malformed candidate", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: { name: "missing action" },
    targetFrameworks: ["RSI"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "REJECT");
  assert.equal(out.recommendation_reason, "candidate_proposed_action_required");
  assert.equal(out.candidate.malformed, true);
});

test("keeps every boundary effect false", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "Giants"],
    processEvents: safeEvents(),
  });
  for (const [key, value] of Object.entries(out.boundary)) {
    assert.equal(value, false, `${key} must remain false`);
  }
  assert.equal(out.what_this_does_not_prove.some((line) => line.includes("not autonomous")), true);
});

test("normalizes object evidence anchors and target frameworks", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: [{ id: "x", path: "docs/x.md", status: "provided" }],
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "rsi", "SNR"],
    processEvents: safeEvents(),
  });
  assert.equal(out.evidence_anchors[0].anchor, "docs/x.md");
  assert.deepEqual(out.target_frameworks, ["rsi", "snr"]);
});
