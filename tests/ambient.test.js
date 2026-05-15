import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAmbientBoundary,
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
  assert.match(boundary.proof_of_truth.formal.proof, /actuator-check/);
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
