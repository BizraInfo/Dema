import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildSafetyReportPreview,
  formatSafetyReportPreview
} from "../packages/core/src/safety-report.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
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
    "economic"
  ]);
});

test("buildSafetyReportPreview keeps convergence claims evidence-tagged and non-certified", () => {
  const report = buildSafetyReportPreview({ now: fixedNow });
  const pillars = Object.values(report.proof_of_truth_convergence);

  assert.ok(pillars.every((pillar) => pillar.evidence_kind));
  assert.ok(pillars.every((pillar) => pillar.status !== "PERMIT"));
  assert.ok(pillars.every((pillar) => pillar.certifies === false));
  assert.ok(report.self_critique.gaps.some((gap) => gap.code === "sat.real_verifier_pending"));
  assert.ok(report.proactive_harness.next_actions.some((action) => action.code === "run.demo_loop"));
});

test("formatSafetyReportPreview renders convergence, critique, and boundary", () => {
  const output = formatSafetyReportPreview(buildSafetyReportPreview({ now: fixedNow }));

  assert.match(output, /DEMA Safety Report Preview/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Formal/);
  assert.match(output, /Cryptographic/);
  assert.match(output, /Empirical/);
  assert.match(output, /Economic/);
  assert.match(output, /Self-critique/);
  assert.match(output, /No proof is computed/);
  assert.match(output, /Boundary: preview-only; no model inference; no execution; no mutation; no receipt minted/);
});

test("dema report safety prints the non-technical preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "report", "safety"]);

  assert.match(stdout, /DEMA Safety Report Preview/);
  assert.match(stdout, /Proof-of-Truth Convergence/);
  assert.match(stdout, /Self-critique/);
  assert.match(stdout, /Boundary: preview-only; no model inference; no execution; no mutation; no receipt minted/);
});

test("dema report safety --json emits a schema-tagged convergence preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "report", "safety", "--json"]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.safety_report_preview.v0.1");
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.boundary.execution_enabled, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.proof_of_truth_convergence.economic.certifies, false);
});
