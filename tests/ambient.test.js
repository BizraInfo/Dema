import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAmbientAuditPreview,
  buildAmbientBoundary,
  formatAmbientAuditPreview,
  formatAmbientBoundary
} from "../packages/core/src/ambient.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("buildAmbientBoundary declares ambient awareness without execution", () => {
  const boundary = buildAmbientBoundary();

  assert.equal(boundary.schema, "bizra.dema.ambient_boundary.v0.1");
  assert.equal(boundary.mode, "PREVIEW_ONLY");
  assert.equal(boundary.execution.enabled, false);
  assert.equal(boundary.execution.repository_role, "product_face_not_runtime");
  assert.deepEqual(boundary.execution.allowed_now, [
    "observe_local_readiness",
    "inventory_local_models",
    "summarize_next_safe_action",
    "prepare_exact_consent_handoff"
  ]);
  assert.ok(boundary.execution.blocked_here.includes("raw_bash_execution"));
  assert.ok(boundary.execution.blocked_here.includes("background_daemon"));
  assert.ok(boundary.execution.blocked_here.includes("artifact_minting"));
  assert.equal(boundary.micro_consent.required_for, "every_effect");
  assert.equal(boundary.actuators.bash.risk, "maximal");
  assert.equal(boundary.proof_of_truth.economic.status, "closed_until_verified_impact");
});

test("formatAmbientBoundary makes the Bash risk and boundary visible", () => {
  const output = formatAmbientBoundary(buildAmbientBoundary());

  assert.match(output, /DEMA Ambient Sovereign Boundary/);
  assert.match(output, /Mode: PREVIEW_ONLY/);
  assert.match(output, /Bash: maximal risk/);
  assert.match(output, /No raw Bash/);
  assert.match(output, /Boundary: preview-only; no execution; no daemon; no receipt minted/);
});

test("dema ambient prints the preview-only ambient boundary", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient"]);

  assert.match(stdout, /DEMA Ambient Sovereign Boundary/);
  assert.match(stdout, /Mode: PREVIEW_ONLY/);
  assert.match(stdout, /raw_bash_execution/);
  assert.match(stdout, /prepare_exact_consent_handoff/);
  assert.match(stdout, /Boundary: preview-only; no execution; no daemon; no receipt minted/);
});

test("dema ambient:json emits a schema-tagged non-executing envelope", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient:json"]);
  const boundary = JSON.parse(stdout);

  assert.equal(boundary.schema, "bizra.dema.ambient_boundary.v0.1");
  assert.equal(boundary.execution.enabled, false);
  assert.equal(boundary.boundary.inference_invoked, false);
  assert.equal(boundary.boundary.mutation_performed, false);
  assert.equal(boundary.boundary.receipt_minted, false);
});

test("buildAmbientAuditPreview captures SNR, SAPE, HHMM, and proof convergence without effects", () => {
  const audit = buildAmbientAuditPreview({
    now: new Date("2026-05-14T08:00:00.000Z")
  });

  assert.equal(audit.schema, "bizra.dema.ambient_audit_preview.v0.1");
  assert.equal(audit.generated_at, "2026-05-14T08:00:00.000Z");
  assert.equal(audit.mode, "PREVIEW_ONLY");
  assert.equal(audit.hidden_flow_pattern, "intent -> micro_consent -> capability -> effect -> evidence -> impact");
  assert.deepEqual(audit.sape_lenses.map((lens) => lens.id), [
    "security",
    "architecture",
    "performance",
    "ethics"
  ]);
  assert.equal(audit.hhmm_phases[0], "UNDERSTAND");
  assert.equal(audit.boundary.execution_enabled, false);
  assert.equal(audit.boundary.mutation_performed, false);
  assert.equal(audit.boundary.receipt_minted, false);
});

test("formatAmbientAuditPreview renders the compliance spine and next implementation step", () => {
  const output = formatAmbientAuditPreview(buildAmbientAuditPreview());

  assert.match(output, /DEMA Ambient Sovereign Execution Audit/);
  assert.match(output, /SNR signal: EffectCap is the only legal side-effect path/);
  assert.match(output, /Hidden flow: intent -> micro_consent -> capability -> effect -> evidence -> impact/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Next implementation: one_node_one_mission_diagnostic/);
  assert.match(output, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
});

test("dema ambient audit prints the ambient sovereign execution audit", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient", "audit"]);

  assert.match(stdout, /DEMA Ambient Sovereign Execution Audit/);
  assert.match(stdout, /micro_consent/);
  assert.match(stdout, /one_node_one_mission_diagnostic/);
  assert.match(stdout, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
});

test("dema ambient audit --json emits a schema-tagged non-executing audit", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient", "audit", "--json"]);
  const audit = JSON.parse(stdout);

  assert.equal(audit.schema, "bizra.dema.ambient_audit_preview.v0.1");
  assert.equal(audit.boundary.execution_enabled, false);
  assert.equal(audit.proof_of_truth.economic.status, "closed_until_verified_impact");
});
