import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0CiEvidenceAttestation,
  verifyNode0CiEvidenceAttestation,
  ciEvidenceAttestationReadyForReadyLocal,
  mergeCiEvidenceAttestationIntoGatheredInput,
  buildGatheredAuditResultWithCiEvidenceAttestation,
  runNode0CiEvidenceAttestation,
  formatNode0CiEvidenceAttestation,
  CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
  NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
} from "../packages/core/src/node0-ci-evidence-attestation.js";
import { GATHERED_ADVISORY_SNAPSHOT_INPUT } from "../packages/core/src/node0-proof-snapshot-attachment.js";
import { runNode0ProofSnapshotAttachment } from "../packages/core/src/node0-proof-snapshot-attachment.js";

const FIXTURE_COMMIT = "ci-evidence-attestation-test-commit-001";

function passAttestation(commit = FIXTURE_COMMIT) {
  return buildNode0CiEvidenceAttestation({
    commit,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
}

test("CEA-01: emits canonical schema and truth label", () => {
  const attestation = passAttestation();
  assert.equal(attestation.schema, NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA);
  assert.equal(attestation.truth_label, NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL);
  assert.match(attestation.receipt_hash, /^sha256:[a-f0-9]{64}$/);
});

test("CEA-02: verify passes for valid attestation", () => {
  const attestation = passAttestation();
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  assert.equal(verified.ok, true);
});

test("CEA-03: fail-closed on missing commit", () => {
  const attestation = buildNode0CiEvidenceAttestation({ commit: "" });
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("missing_commit"));
});

test("CEA-04: fail-closed on UNKNOWN commit sentinel", () => {
  const attestation = passAttestation("UNKNOWN");
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("commit_unknown_sentinel"));
});

test("CEA-05: fail-closed on receipt_hash mismatch", () => {
  const attestation = passAttestation();
  const tampered = { ...attestation, receipt_hash: "sha256:deadbeef" };
  const verified = verifyNode0CiEvidenceAttestation(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("receipt_hash_mismatch"));
});

test("CEA-06: fail-closed on overclaim READY_REMOTE", () => {
  const attestation = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
    claimed_release_verdict: "READY_REMOTE",
  });
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("overclaim_release_verdict"));
});

test("CEA-07: fail-closed on boundary flag false", () => {
  const attestation = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
    boundary: {
      local_only: false,
      no_network_required: true,
      not_remote_seal: true,
      not_public_safe_claim: true,
    },
  });
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("boundary_local_only"));
});

test("CEA-07b: fail-closed on whitespace-padded overclaim verdict", () => {
  const attestation = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
    claimed_release_verdict: " READY_REMOTE ",
  });
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("overclaim_release_verdict"));
});

test("CEA-08: ready_local rails require all PASS (not UNKNOWN)", () => {
  const attestation = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    rails: { ci_matrix: "PASS", codeql: "UNKNOWN", gitleaks: "PASS" },
  });
  const ready = ciEvidenceAttestationReadyForReadyLocal(attestation);
  assert.equal(ready.ok, false);
  assert.ok(ready.blocked_by.some((code) => code.includes("codeql")));
});

test("CEA-09: merge promotes gathered audit to READY_LOCAL when commit matches", () => {
  const attestation = passAttestation();
  const baseInput = {
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit: FIXTURE_COMMIT,
    checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
    workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
    risks: [],
  };
  const audit = buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation);
  assert.equal(audit.attestation_merged, true);
  assert.equal(audit.ledger.release_verdict, "READY_LOCAL");
});

test("CEA-10: merge refuses commit mismatch", () => {
  const attestation = passAttestation("commit-a");
  const baseInput = {
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit: "commit-b",
    checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
    workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
  };
  const merge = mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation);
  assert.equal(merge.merged, false);
  assert.ok(merge.blocked_by.includes("commit_mismatch"));
});

test("CEA-11: attested snapshot attachment is ready_local_eligible", () => {
  const attestation = passAttestation();
  const baseInput = {
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit: FIXTURE_COMMIT,
    checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
    workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
    risks: [],
  };
  const audit = buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation);
  const attachment = runNode0ProofSnapshotAttachment({ auditResult: audit });
  assert.equal(attachment.ok, true);
  assert.equal(attachment.ready_local_eligible, true);
  assert.equal(attachment.release_verdict, "READY_LOCAL");
});

test("CEA-12: format renders human summary", () => {
  const text = formatNode0CiEvidenceAttestation(passAttestation());
  assert.match(text, /CI evidence attestation/i);
  assert.match(text, /ci_matrix=PASS/);
});

test("CEA-13: review gate script passes hermetic check", async () => {
  const { runNode0CiEvidenceAttestationCheck } = await import(
    "../scripts/review/node0-ci-evidence-attestation-check.mjs"
  );
  const result = runNode0CiEvidenceAttestationCheck();
  assert.equal(result.ok, true);
});

test("CEA-14: kernel run reports verified attestation", () => {
  const result = runNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ready_local_rails_eligible, true);
});

// --- CI-ATTEST-NO-SYNTHETIC-REVIEW-1A: the three-rail attestation carries
// ZERO evidence about the BIZRA Review Gate and must have ZERO authority over
// it. Invariant: mergedInput.checks.bizra_review_gate ===
// baseInput.checks.bizra_review_gate, for every rail combination. ---

const RAIL_STATES = ["PASS", "FAIL", "UNKNOWN"];

function baseWithReviewGate(reviewGate) {
  const base = {
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit: FIXTURE_COMMIT,
    checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
    workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
    risks: [],
  };
  if (reviewGate === undefined) delete base.checks.bizra_review_gate;
  else base.checks.bizra_review_gate = reviewGate;
  return base;
}

test("CEA-15: attestation has zero authority over the review gate — prior PASS/FAIL/UNKNOWN/missing all survive an all-PASS merge byte-for-byte", () => {
  for (const prior of ["PASS", "FAIL", "UNKNOWN", undefined]) {
    const merge = mergeCiEvidenceAttestationIntoGatheredInput(baseWithReviewGate(prior), passAttestation());
    assert.equal(merge.merged, true);
    assert.equal(
      merge.input.checks.bizra_review_gate,
      prior,
      `prior=${String(prior)} must be preserved, got ${String(merge.input.checks.bizra_review_gate)}`,
    );
    if (prior === undefined) {
      assert.equal("bizra_review_gate" in merge.input.checks, false, "missing prior must remain missing");
    }
  }
});

test("CEA-16: all 27 rail-state combinations preserve the prior review state (none may synthesize or destroy it)", () => {
  for (const ci of RAIL_STATES) for (const cq of RAIL_STATES) for (const gl of RAIL_STATES) {
    const attestation = buildNode0CiEvidenceAttestation({
      commit: FIXTURE_COMMIT,
      rails: { ci_matrix: ci, codeql: cq, gitleaks: gl },
    });
    for (const prior of ["PASS", "FAIL", "UNKNOWN"]) {
      const merge = mergeCiEvidenceAttestationIntoGatheredInput(baseWithReviewGate(prior), attestation);
      assert.equal(merge.merged, true);
      assert.equal(
        merge.input.checks.bizra_review_gate,
        prior,
        `rails=${ci}/${cq}/${gl} prior=${prior} → got ${merge.input.checks.bizra_review_gate}`,
      );
    }
  }
});

test("CEA-17: a FAILED review gate plus three successful rails cannot produce READY_LOCAL", () => {
  const base = baseWithReviewGate("FAIL");
  // Remove the independent check:true evidence path so the review gate alone decides.
  delete base.checks.check;
  const audit = buildGatheredAuditResultWithCiEvidenceAttestation(base, passAttestation());
  assert.equal(audit.attestation_merged, true);
  assert.notEqual(audit.ledger.release_verdict, "READY_LOCAL");
  assert.equal(audit.ledger.release_verdict, "BLOCKED");
});

test("CEA-18: an UNKNOWN review gate plus three successful rails cannot produce READY_LOCAL", () => {
  const base = baseWithReviewGate("UNKNOWN");
  delete base.checks.check;
  const audit = buildGatheredAuditResultWithCiEvidenceAttestation(base, passAttestation());
  assert.equal(audit.attestation_merged, true);
  assert.equal(audit.ledger.release_verdict, "BLOCKED");
});

test("CEA-19: merge receipt verification stays deterministic and commit mismatch stays fail-closed after the invariant", () => {
  const attestation = passAttestation();
  const again = passAttestation();
  assert.equal(attestation.receipt_hash, again.receipt_hash);
  const mismatch = mergeCiEvidenceAttestationIntoGatheredInput(
    { ...baseWithReviewGate("PASS"), commit: "some-other-commit" },
    attestation,
  );
  assert.equal(mismatch.merged, false);
  assert.ok(mismatch.blocked_by.includes("commit_mismatch"));
});
