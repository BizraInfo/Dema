import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildRsiProposalPreview,
  RSI_PROPOSAL_PREVIEW_SCHEMA,
  RSI_SNR_NOT_SUPPLIED_VERDICT,
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

test("builds a deterministic frozen RSI proposal preview with supplied SNR telemetry", () => {
  const input = {
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "SNR", "Ihsan", "Giants"],
    processEvents: safeEvents(),
    signalEvents: ["audit", "receipt", "gate"],
    noiseEvents: [],
    currentScores: { v2_framework: 2.48, operational: 85 },
  };
  const a = buildRsiProposalPreview(input);
  const b = buildRsiProposalPreview(input);
  assert.equal(a.schema, RSI_PROPOSAL_PREVIEW_SCHEMA);
  assert.equal(a.truth_label, "RSI_PROPOSAL_PREVIEW_ONLY");
  assert.equal(a.mode, "PREVIEW_ONLY");
  assert.equal(a.certifies, false);
  assert.equal(a.recommendation, "PROPOSE");
  assert.equal(a.snr.telemetry_supplied, true);
  assert.equal(a.executed_action, null);
  assert.equal(a.action_executed_by_preview, false);
  assert.match(a.proposal_hash, /^[a-f0-9]{64}$/);
  assert.equal(a.proposal_hash, b.proposal_hash);
  assert.equal(Object.isFrozen(a), true);
});

test("does not fabricate SNR from evidence anchors when telemetry is absent", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "SNR", "Ihsan", "Giants"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "PROPOSE");
  assert.equal(out.snr.verdict, RSI_SNR_NOT_SUPPLIED_VERDICT);
  assert.equal(out.snr.score, null);
  assert.equal(out.snr.telemetry_supplied, false);
  assert.equal(out.checks.find((item) => item.check === "snr_not_fabricated").pass, true);
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

test("holds when supplied signal telemetry is too weak", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI", "SNR"],
    signalEvents: [],
    noiseEvents: ["vague", "unsupported", "overclaim"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "HOLD");
  assert.equal(out.recommendation_reason, "proposal_needs_more_signal");
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

test("proposal_hash changes when the unsigned body changes", () => {
  const base = {
    evidenceAnchors: safeEvidence(),
    candidate: safeCandidate(),
    targetFrameworks: ["RSI"],
    processEvents: safeEvents(),
  };
  const a = buildRsiProposalPreview(base);
  const b = buildRsiProposalPreview({
    ...base,
    candidate: {
      ...safeCandidate(),
      rationale: "Different bounded rationale changes the proposal body.",
    },
  });
  assert.notEqual(a.proposal_hash, b.proposal_hash);
});

test("rejects autonomy-overclaim phrasing that dodges the legacy exact terms", () => {
  const out = buildRsiProposalPreview({
    evidenceAnchors: safeEvidence(),
    candidate: {
      name: "sneaky autonomy proposal",
      proposed_action:
        "Activate the autonomous self-improvement loop so the system evolves itself continuously without review",
      rationale: "Phrasing deliberately dodges every legacy exact substring in the gate.",
      expected_outcome: "The forbidden-term gate must still catch it.",
    },
    targetFrameworks: ["RSI"],
    processEvents: safeEvents(),
  });
  assert.equal(out.recommendation, "REJECT");
  assert.match(out.recommendation_reason, /^forbidden_action_claim:/);
  assert.ok(
    out.forbidden_claims.includes("live_loop") || out.forbidden_claims.includes("self_change"),
  );
});

test("kernel stays pure: no fs/network/process/clock/random imports or calls", async () => {
  const src = await readFile(new URL("../packages/core/src/rsi-proposal-preview.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:fs|node:net|node:http|node:https|child_process/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /Date\.now|new Date\s*\(|Math\.random/);
});
