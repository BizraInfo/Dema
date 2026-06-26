import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0ProofSnapshotAttachment,
  verifyNode0ProofSnapshotAttachment,
  runNode0ProofSnapshotAttachment,
  computeReadyLocalEligible,
  buildGatheredAdvisoryAuditResult,
  formatNode0ProofSnapshotAttachment,
  GATHERED_ADVISORY_SNAPSHOT_INPUT,
  NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
  NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL,
} from "../packages/core/src/node0-proof-snapshot-attachment.js";
import {
  buildNode0ProofOfTruthControlPlane,
  runNode0ProofOfTruthControlPlane,
  HERMETIC_CONTROL_PLANE_FIXTURE,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";

const readyLocalInput = {
  commit: "abc123def45678901234567890123456789012",
  checks: {
    schema: true,
    invariants: true,
    fail_closed: true,
    test: true,
    coverage: true,
    check: true,
    perf: true,
    delivery: true,
    sha256: true,
    codeql: "PASS",
    gitleaks: "PASS",
    bizra_review_gate: "PASS",
  },
  workflows: {
    ci_matrix: "PASS",
    local_operator_seal: "PASS",
    ci_remote_seal: "PENDING",
    codeql: "PASS",
    gitleaks: "PASS",
  },
  coverage: { present: true, lines: 95, threshold: 80 },
  perf: { present: true, boot_latency_ms: 120, ceiling: 150 },
  claims: [],
  risks: [],
};

test("PSA-01: emits canonical schema and truth label", () => {
  const audit = buildGatheredAdvisoryAuditResult();
  const attachment = buildNode0ProofSnapshotAttachment({ auditResult: audit });
  assert.equal(attachment.schema, NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA);
  assert.equal(attachment.truth_label, NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL);
});

test("PSA-02: gathered advisory fixture reports UNKNOWN rails and BLOCKED verdict", () => {
  const audit = buildGatheredAdvisoryAuditResult();
  const attachment = buildNode0ProofSnapshotAttachment({ auditResult: audit });
  assert.equal(attachment.snapshot_source, "gathered");
  assert.equal(attachment.advisory_rails.codeql, "UNKNOWN");
  assert.equal(attachment.advisory_rails.gitleaks, "UNKNOWN");
  assert.equal(attachment.ledger_summary.release_verdict, "BLOCKED");
  assert.equal(attachment.ready_local_eligible, false);
});

test("PSA-03: structural verify passes for gathered advisory BLOCKED snapshot", () => {
  const result = runNode0ProofSnapshotAttachment({
    auditResult: buildGatheredAdvisoryAuditResult(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.release_verdict, "BLOCKED");
});

test("PSA-04: ready_local_eligible true when control plane verifies READY_LOCAL", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(readyLocalInput);
  const audit = { ledger, hermetic: false };
  const attachment = buildNode0ProofSnapshotAttachment({ auditResult: audit });
  assert.equal(attachment.ready_local_eligible, true);
  const eligible = computeReadyLocalEligible(ledger);
  assert.equal(eligible.eligible, true);
});

test("PSA-05: verify fails on UNKNOWN commit sentinel", () => {
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit: "UNKNOWN",
  });
  const attachment = buildNode0ProofSnapshotAttachment({
    auditResult: { ledger, hermetic: false },
  });
  const verified = verifyNode0ProofSnapshotAttachment(attachment);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("commit_unknown_sentinel"));
});

test("PSA-06: hermetic audit marks snapshot_source hermetic", () => {
  const audit = runNode0ProofOfTruthControlPlane({ ...HERMETIC_CONTROL_PLANE_FIXTURE });
  const attachment = buildNode0ProofSnapshotAttachment({
    auditResult: { ledger: audit.ledger, hermetic: true },
  });
  assert.equal(attachment.snapshot_source, "hermetic");
  assert.match(attachment.ledger_summary.receipt_hash, /^sha256:[a-f0-9]{64}$/);
});

test("PSA-07: format renders human summary", () => {
  const attachment = buildNode0ProofSnapshotAttachment({
    auditResult: buildGatheredAdvisoryAuditResult(),
  });
  const text = formatNode0ProofSnapshotAttachment(attachment);
  assert.match(text, /proof snapshot attachment/i);
  assert.match(text, /ready_local_eligible: false/);
});

test("PSA-08: review gate script passes gathered attachment check", async () => {
  const { runNode0ProofSnapshotAttachmentCheck } = await import(
    "../scripts/review/node0-proof-snapshot-attachment-check.mjs"
  );
  const result = runNode0ProofSnapshotAttachmentCheck();
  assert.equal(result.ok, true);
});
