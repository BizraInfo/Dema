import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildSafetyReportPreview,
  formatSafetyReportPreview,
  detectSelfCritiqueGaps,
  probeVerifierEvidence,
} from "../packages/core/src/safety-report.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const fixedNow = new Date("2026-05-14T01:42:00.000Z");

test("buildSafetyReportPreview emits a schema-tagged preview with no effects", () => {
  const report = buildSafetyReportPreview({ now: fixedNow });

  assert.equal(report.schema, "bizra.dema.safety_report_preview.v0.1");
  assert.equal(report.generated_at, fixedNow.toISOString());
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.boundary.inference_invoked, false);
  assert.equal(report.boundary.execution_enabled, false);
  assert.equal(report.boundary.mutation_performed, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.deepEqual(Object.keys(report.proof_of_truth_convergence), [
    "formal",
    "cryptographic",
    "empirical",
    "economic",
  ]);
  assert.equal(report.truth_spine_previews.ihsan_floor.certifies, false);
  assert.equal(
    report.truth_spine_previews.ihsan_floor.schema,
    "bizra.dema.ihsan_floor_preview.v0.1",
  );
  assert.equal(
    report.truth_spine_previews.evidence_receipt.receipt_minted,
    false,
  );
  assert.equal(
    report.truth_spine_previews.evidence_receipt.schema,
    "bizra.dema.evidence_receipt_preview.v0.1",
  );
  assert.equal(
    report.truth_spine_previews.evidence_receipt.digest_algo,
    "sha256",
  );
  assert.equal(
    report.truth_spine_previews.behavioral_modulation.schema,
    "bizra.dema.behavioral_modulation_preview.v0.1",
  );
  assert.equal(
    report.truth_spine_previews.behavioral_modulation.behavior_changed,
    false,
  );
});

test("buildSafetyReportPreview keeps convergence claims evidence-tagged and non-certified", () => {
  const report = buildSafetyReportPreview({ now: fixedNow });
  const pillars = Object.values(report.proof_of_truth_convergence);

  assert.ok(pillars.every((pillar) => pillar.evidence_kind));
  assert.ok(pillars.every((pillar) => pillar.status !== "PERMIT"));
  assert.ok(pillars.every((pillar) => pillar.certifies === false));
  assert.equal(
    report.proof_of_truth_convergence.cryptographic.certifies,
    false,
  );
  assert.equal(
    report.truth_spine_previews.evidence_receipt.chain_id,
    "preview-only-no-chain",
  );
  assert.equal(
    report.truth_spine_previews.behavioral_modulation.certifies,
    false,
  );
  const reportNoVerifier = buildSafetyReportPreview({
    now: fixedNow,
    verifierWired: false,
  });
  assert.ok(
    reportNoVerifier.self_critique.gaps.some(
      (gap) => gap.code === "sat.real_verifier_pending",
    ),
  );
  assert.ok(
    report.proactive_harness.next_actions.some(
      (action) => action.code === "run.demo_loop",
    ),
  );
});

test("formatSafetyReportPreview renders convergence, critique, and boundary", () => {
  const output = formatSafetyReportPreview(
    buildSafetyReportPreview({ now: fixedNow }),
  );

  assert.match(output, /DEMA Safety Report Preview/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Formal/);
  assert.match(output, /Cryptographic/);
  assert.match(output, /Empirical/);
  assert.match(output, /Economic/);
  assert.match(output, /Truth spine previews/);
  assert.match(output, /preview_only_no_chain/);
  assert.match(output, /Self-critique/);
  assert.match(output, /No proof is computed/);
  assert.match(
    output,
    /Boundary: preview-only; no model inference; no execution; no mutation; no receipt minted/,
  );
});

test("dema report safety prints the non-technical preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "report", "safety"]);

  assert.match(stdout, /DEMA Safety Report Preview/);
  assert.match(stdout, /Proof-of-Truth Convergence/);
  assert.match(stdout, /Truth spine previews/);
  assert.match(stdout, /Self-critique/);
  assert.match(
    stdout,
    /Boundary: preview-only; no model inference; no execution; no mutation; no receipt minted/,
  );
});

test("dema report safety --json emits a schema-tagged convergence preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "report",
    "safety",
    "--json",
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.safety_report_preview.v0.1");
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.boundary.execution_enabled, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.proof_of_truth_convergence.economic.certifies, false);
  assert.equal(
    report.proof_of_truth_convergence.cryptographic.certifies,
    false,
  );
  assert.equal(report.truth_spine_previews.evidence_receipt.certifies, false);
});

test("detectSelfCritiqueGaps returns all 3 gaps with default params", () => {
  const gaps = detectSelfCritiqueGaps();
  assert.equal(gaps.length, 3);
  assert.ok(gaps.some((g) => g.code === "installer.packaging_pending"));
  assert.ok(gaps.some((g) => g.code === "sat.real_verifier_pending"));
  assert.ok(gaps.some((g) => g.code === "report.evidence_pending"));
});

test("detectSelfCritiqueGaps drops verifier gap when verifierWired=true", () => {
  const gaps = detectSelfCritiqueGaps({ verifierWired: true });
  assert.ok(!gaps.some((g) => g.code === "sat.real_verifier_pending"));
  assert.ok(gaps.some((g) => g.code === "installer.packaging_pending"));
  assert.ok(gaps.some((g) => g.code === "report.evidence_pending"));
});

test("detectSelfCritiqueGaps drops evidence gap when evidenceBound=true", () => {
  const gaps = detectSelfCritiqueGaps({ evidenceBound: true });
  assert.ok(!gaps.some((g) => g.code === "report.evidence_pending"));
  assert.ok(gaps.some((g) => g.code === "installer.packaging_pending"));
  assert.ok(gaps.some((g) => g.code === "sat.real_verifier_pending"));
});

test("detectSelfCritiqueGaps returns only installer gap when both wired", () => {
  const gaps = detectSelfCritiqueGaps({
    verifierWired: true,
    evidenceBound: true,
  });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].code, "installer.packaging_pending");
  assert.equal(gaps[0].severity, "launch_blocker");
});

test("buildSafetyReportPreview with verifierWired=true omits verifier gap", () => {
  const report = buildSafetyReportPreview({
    now: fixedNow,
    verifierWired: true,
  });
  assert.ok(
    !report.self_critique.gaps.some(
      (g) => g.code === "sat.real_verifier_pending",
    ),
  );
  assert.equal(report.self_critique.status, "open_gaps_visible");
});

test("buildSafetyReportPreview self_critique.status reflects gap count", () => {
  const report = buildSafetyReportPreview({
    now: fixedNow,
    verifierWired: true,
    evidenceBound: true,
  });
  assert.equal(report.self_critique.gaps.length, 1);
  assert.equal(report.self_critique.status, "open_gaps_visible");
});

test("probeVerifierEvidence returns true on real repo", () => {
  const probe = probeVerifierEvidence();
  assert.equal(probe.verifierWired, true);
  assert.equal(probe.checks.sat_modules_exist, true);
  assert.equal(probe.checks.orchestrator_exists, true);
  assert.equal(probe.checks.sat_tests_exist, true);
  assert.equal(probe.checks.cli_wired, true);
});

test("probeVerifierEvidence returns false on nonexistent root", () => {
  const probe = probeVerifierEvidence("/nonexistent/repo");
  assert.equal(probe.verifierWired, false);
  assert.equal(probe.checks.sat_modules_exist, false);
});

test("buildSafetyReportPreview auto-detects verifier without explicit param", () => {
  const report = buildSafetyReportPreview({ now: fixedNow });
  assert.ok(
    !report.self_critique.gaps.some(
      (g) => g.code === "sat.real_verifier_pending",
    ),
  );
  assert.equal(report.self_critique.gaps.length, 2);
});

test("buildSafetyReportPreview explicit verifierWired=false overrides probe", () => {
  const report = buildSafetyReportPreview({
    now: fixedNow,
    verifierWired: false,
  });
  assert.ok(
    report.self_critique.gaps.some(
      (g) => g.code === "sat.real_verifier_pending",
    ),
  );
  assert.equal(report.self_critique.gaps.length, 3);
});
