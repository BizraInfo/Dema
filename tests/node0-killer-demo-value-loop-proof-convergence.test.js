import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0KillerDemoValueLoopProofConvergence,
  verifyNode0KillerDemoValueLoopProofConvergence,
  runNode0KillerDemoValueLoopProofConvergence,
  formatNode0KillerDemoValueLoopProofConvergence,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND,
  KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS,
} from "../packages/core/src/node0-killer-demo-value-loop-proof-convergence.js";
import { PROOF_CONVERGENCE_PREVIEW_SCHEMA } from "../packages/core/src/proof-convergence-preview.js";
import {
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
} from "../packages/core/src/node0-killer-demo-value-loop-cli.js";
import {
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
  buildNode0ProofOfTruthControlPlane,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";
import {
  buildGatheredAdvisoryAuditResult,
  GATHERED_ADVISORY_SNAPSHOT_INPUT,
  NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
} from "../packages/core/src/node0-proof-snapshot-attachment.js";
import {
  buildGatheredAuditResultWithCiEvidenceAttestation,
  buildNode0CiEvidenceAttestation,
  CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
} from "../packages/core/src/node0-ci-evidence-attestation.js";

function withGatheredAudit(extra = {}) {
  return {
    proof_snapshot_audit: buildGatheredAdvisoryAuditResult(),
    ...extra,
  };
}

const readyLocalAudit = {
  ledger: buildNode0ProofOfTruthControlPlane({
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
  }),
  hermetic: false,
};

test("PC-01: emits canonical schema and truth label", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  assert.equal(out.schema, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA);
  assert.equal(out.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL);
  assert.equal(out.command, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND);
});

test("PC-02: composes killer-demo CLI, proof convergence, and gathered control plane reference", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  assert.equal(out.killer_demo_cli.schema, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA);
  assert.equal(out.killer_demo_cli.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL);
  assert.equal(out.killer_demo_cli.verified_ok, true);
  assert.equal(out.proof_convergence.schema, PROOF_CONVERGENCE_PREVIEW_SCHEMA);
  assert.equal(out.proof_convergence.summary.total, KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS.length);
  assert.equal(out.proof_snapshot_attachment.schema, NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA);
  assert.equal(out.control_plane_reference.schema, NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA);
  assert.equal(out.control_plane_reference.truth_label, NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL);
  assert.equal(out.control_plane_reference.gathered, true);
  assert.equal(out.control_plane_reference.release_verdict, "BLOCKED");
});

test("PC-03: boundaries are all false and autonomy flags are explicit", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  assert.ok(Object.values(out.boundary).every((v) => v === false));
  assert.ok(Object.values(out.boundaries).every((v) => v === false));
  assert.equal(out.autonomous_rsi.not_autonomous_runtime, true);
  assert.equal(out.autonomous_rsi.not_agent_rl, true);
  assert.equal(out.autonomous_rsi.reward_verified, false);
});

test("PC-04: SNR and process RSI use preview math (not undefined aliases)", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  assert.equal(typeof out.snr_framework.score, "number");
  assert.ok(["signal", "noise"].includes(out.snr_framework.dominant));
  assert.equal(typeof out.process_rsi.score, "number");
  assert.equal(typeof out.autonomous_rsi.process_rsi, "number");
  assert.ok(
    ["CONTINUE_MICRO_SLICE", "HOLD_AND_REDUCE_NOISE"].includes(
      out.autonomous_rsi.merged_verdict,
    ),
  );
});

test("PC-05: proactive ultra-micro self-loop declares consent and compliance", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  assert.ok(out.proactive_self.consent.required_phrase.length > 0);
  assert.equal(out.proactive_self.consent.exact_string, true);
  assert.equal(out.proactive_self.compliance.no_autonomous_runtime, true);
  assert.equal(out.proactive_self.compliance.no_token_mint, true);
  assert.ok(out.proactive_self.harness.active_gates.length >= 4);
});

test("PC-06: verify passes on gathered proof-attached compose envelope", () => {
  const result = runNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  assert.equal(result.ok, true);
  assert.equal(result.verified.ok, true);
  assert.equal(result.compose_status, "PROOF_ATTACHED_ADVISORY_BLOCKED");
  assert.equal(result.ready_local_eligible, false);
});

test("PC-07: verify fails when killer demo CLI is not verified", () => {
  const composed = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  const tampered = {
    ...composed,
    killer_demo_cli: { ...composed.killer_demo_cli, verified_ok: false },
  };
  const verified = verifyNode0KillerDemoValueLoopProofConvergence(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("killer_demo_cli_not_verified"));
});

test("PC-08: format renders human summary", () => {
  const composed = buildNode0KillerDemoValueLoopProofConvergence(withGatheredAudit());
  const text = formatNode0KillerDemoValueLoopProofConvergence(composed);
  assert.match(text, /proof convergence/i);
  assert.match(text, /preview-only/i);
  assert.match(text, /proof_attached: true/);
});

test("PC-09: review gate script passes gathered proof-attached check", async () => {
  const { runNode0KillerDemoValueLoopProofConvergenceCheck } = await import(
    "../scripts/review/node0-killer-demo-value-loop-proof-convergence-check.mjs"
  );
  const result = runNode0KillerDemoValueLoopProofConvergenceCheck();
  assert.equal(result.ok, true);
});

test("PC-10: CLI smoke via apps/cli index", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname } = await import("node:path");
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const out = execFileSync(
    "node",
    ["apps/cli/src/index.js", "demo", "node0-value-loop", "convergence", "--json"],
    { encoding: "utf8", cwd: repoRoot },
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.schema, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA);
  assert.equal(parsed.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL);
  assert.equal(parsed.proof_snapshot_attachment?.schema, NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA);
  assert.equal(parsed.control_plane_reference?.gathered, true);
});

test("PC-11: ready_local_eligible when gathered snapshot verifies READY_LOCAL", () => {
  const result = runNode0KillerDemoValueLoopProofConvergence({
    proof_snapshot_audit: readyLocalAudit,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ready_local_eligible, true);
  assert.equal(result.release_verdict, "READY_LOCAL");
  assert.equal(result.compose_status, "PROOF_ATTACHED_PARTIAL_CONVERGENCE");
});

test("PC-12: verified CI evidence attestation promotes ready_local in convergence", () => {
  const commit = "attestation-convergence-commit-001";
  const attestation = buildNode0CiEvidenceAttestation({
    commit,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  const audit = buildGatheredAuditResultWithCiEvidenceAttestation(
    {
      ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
      commit,
      checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
      workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
      risks: [],
    },
    attestation,
  );
  const result = runNode0KillerDemoValueLoopProofConvergence({ proof_snapshot_audit: audit });
  assert.equal(result.ok, true);
  assert.equal(result.ready_local_eligible, true);
  assert.equal(result.release_verdict, "READY_LOCAL");
  assert.equal(result.attestation_merged, true);
  assert.equal(result.composed.proof_snapshot_attachment?.attestation_merged, true);
  assert.equal(result.composed.proof_snapshot_attachment?.ci_evidence_attestation?.commit, commit);
});
