import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAmbientAuditPreview,
  buildAmbientBoundary,
  buildAmbientManifestPreview,
  formatAmbientAuditPreview,
  formatAmbientBoundary,
  formatAmbientManifestPreview
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
  assert.equal(audit.agent_topology.pat.alignment, "user_aligned");
  assert.equal(audit.agent_topology.pat.residence, "user_node_only");
  assert.ok(audit.agent_topology.pat.roles.includes("execute"));
  assert.equal(audit.agent_topology.sat.alignment, "system_aligned");
  assert.equal(audit.agent_topology.sat.residence, "urp_control_plane_only");
  assert.ok(audit.agent_topology.sat.roles.includes("resource_scheduler"));
  assert.equal(audit.agent_topology.boundary, "SAT are not cloud PAT and do not live inside user nodes");
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
  assert.match(output, /PAT-7: local, user-aligned, user-node-only mission party/);
  assert.match(output, /SAT-5: system-owned, system-aligned URP control plane/);
  assert.match(output, /SAT are not cloud PAT/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Next implementation: one_node_one_mission_diagnostic/);
  assert.match(output, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
});

test("dema ambient audit prints the ambient sovereign execution audit", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient", "audit"]);

  assert.match(stdout, /DEMA Ambient Sovereign Execution Audit/);
  assert.match(stdout, /micro_consent/);
  assert.match(stdout, /SAT-5: system-owned, system-aligned URP control plane/);
  assert.match(stdout, /one_node_one_mission_diagnostic/);
  assert.match(stdout, /Boundary: preview-only; no execution; no mutation; no receipt minted/);
});

test("dema ambient audit --json emits a schema-tagged non-executing audit", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient", "audit", "--json"]);
  const audit = JSON.parse(stdout);

  assert.equal(audit.schema, "bizra.dema.ambient_audit_preview.v0.1");
  assert.equal(audit.agent_topology.sat.residence, "urp_control_plane_only");
  assert.equal(audit.boundary.execution_enabled, false);
  assert.equal(audit.proof_of_truth.economic.status, "closed_until_verified_impact");
});

test("buildAmbientManifestPreview declares a hashable zero-trust capability manifest", () => {
  const manifest = buildAmbientManifestPreview({
    now: new Date("2026-05-14T08:00:00.000Z")
  });

  assert.equal(manifest.schema, "bizra.dema.ambient_manifest_preview.v0.1");
  assert.equal(manifest.generated_at, "2026-05-14T08:00:00.000Z");
  assert.equal(manifest.node_id, "node0");
  assert.equal(manifest.mode, "PREVIEW_ONLY");
  assert.deepEqual(manifest.sovereign_boundary.executable_commands, []);
  assert.deepEqual(manifest.sovereign_boundary.writable_paths, []);
  assert.equal(manifest.sovereign_boundary.network_access, false);
  assert.equal(manifest.urp_share_policy.no_foreign_personal_data, true);
  assert.match(manifest.manifest_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(manifest.signature.status, "deferred_to_node0");
  assert.equal(manifest.boundary.execution_enabled, false);
  assert.equal(manifest.boundary.identity_artifact_issued, false);
});

test("formatAmbientManifestPreview renders the manifest hash and no-execution boundary", () => {
  const output = formatAmbientManifestPreview(buildAmbientManifestPreview());

  assert.match(output, /DEMA Ambient Capability Manifest Preview/);
  assert.match(output, /Node: node0/);
  assert.match(output, /Manifest hash: sha256:/);
  assert.match(output, /Network access: false/);
  assert.match(output, /Signature: deferred_to_node0/);
  assert.match(output, /Boundary: preview-only; no execution; no mutation; no identity artifact issued/);
});

test("dema ambient --manifest prints the ambient manifest preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient", "--manifest"]);

  assert.match(stdout, /DEMA Ambient Capability Manifest Preview/);
  assert.match(stdout, /Manifest hash: sha256:/);
  assert.match(stdout, /No foreign personal data: true/);
  assert.match(stdout, /Boundary: preview-only; no execution; no mutation; no identity artifact issued/);
});

test("dema ambient --manifest --json emits a schema-tagged non-executing manifest", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "ambient", "--manifest", "--json"]);
  const manifest = JSON.parse(stdout);

  assert.equal(manifest.schema, "bizra.dema.ambient_manifest_preview.v0.1");
  assert.equal(manifest.sovereign_boundary.network_access, false);
  assert.equal(manifest.signature.status, "deferred_to_node0");
  assert.equal(manifest.boundary.execution_enabled, false);
});
