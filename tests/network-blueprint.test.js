import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildNetworkBlueprint,
  formatNetworkBlueprint
} from "../packages/core/src/network-blueprint.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const modulePath = fileURLToPath(new URL("../packages/core/src/network-blueprint.js", import.meta.url));
const coreSrcPath = fileURLToPath(new URL("../packages/core/src", import.meta.url));

async function networkPreviewFiles() {
  const entries = await readdir(coreSrcPath);
  return entries
    .filter((entry) => entry.startsWith("network-") && entry.endsWith(".js"))
    .map((entry) => join(coreSrcPath, entry));
}

test("buildNetworkBlueprint emits a schema-tagged preview without effects", () => {
  const blueprint = buildNetworkBlueprint();

  assert.equal(blueprint.schema, "bizra.dema.node_network_blueprint.v0.1");
  assert.equal(blueprint.mode, "PREVIEW_ONLY");
  assert.equal(blueprint.current_state.stage, "node0_plus_dema_local");
  assert.equal(blueprint.boundary.execution_enabled, false);
  assert.equal(blueprint.boundary.mutation_performed, false);
  assert.equal(blueprint.boundary.receipt_minted, false);
  assert.equal(blueprint.boundary.federation_initiated, false);
  assert.equal(blueprint.boundary.node_handshake_performed, false);
  assert.equal(blueprint.boundary.outbound_socket_opened, false);
});

test("buildNetworkBlueprint names Node1 and Node2 readiness gates without inventing nodes", () => {
  const blueprint = buildNetworkBlueprint();
  const serialized = JSON.stringify(blueprint);

  assert.ok(blueprint.related_schemas.includes("bizra.dema.mission_preview.v0.1"));
  assert.ok(blueprint.readiness_gates.some((gate) => (
    gate.target === "Node1" &&
    gate.id === "node1.handoff_contract_defined" &&
    gate.status === "blocked"
  )));
  assert.ok(blueprint.readiness_gates.some((gate) => (
    gate.target === "Node2" &&
    gate.id === "node2.propagation_policy" &&
    gate.status === "blocked"
  )));
  assert.doesNotMatch(serialized, /Node3|Node4/);
  assert.ok(blueprint.canonical_expansion_phases.some((phase) => phase.id === "phase_3"));
  assert.ok(blueprint.canonical_expansion_phases.some((phase) => phase.id === "phase_4"));
  assert.ok(blueprint.gtm_blockers.some((blocker) => blocker.severity === "launch_blocker"));
});

test("buildNetworkBlueprint keeps downstream gates blocked while Node0 proof is blocked", () => {
  const blueprint = buildNetworkBlueprint();
  const node0Repeatability = blueprint.readiness_gates.find(
    (gate) => gate.id === "node0.bounded_receipt_repeatable"
  );

  assert.equal(node0Repeatability.status, "blocked");
  for (const gate of blueprint.readiness_gates) {
    if (["Node1", "Node2", "phase_3", "phase_4"].includes(gate.target)) {
      assert.equal(gate.status, "blocked");
    }
  }
});

test("buildNetworkBlueprint keeps every boundary switch false", () => {
  const blueprint = buildNetworkBlueprint();
  const expectedFalseBoundaries = [
    "execution_enabled",
    "mutation_performed",
    "runtime_started",
    "capability_minted",
    "receipt_minted",
    "daemon_started",
    "network_connection_attempted",
    "federation_initiated",
    "node_handshake_performed",
    "outbound_socket_opened",
    "identity_artifact_issued",
    "downstream_node_started",
    "liveness_probe_implemented",
    "authorization_phrase_emitted"
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(blueprint.boundary[key], false, `${key} must remain false`);
  }
});

test("buildNetworkBlueprint includes preview-only handoff and harness contracts", () => {
  const blueprint = buildNetworkBlueprint();

  assert.ok(blueprint.handoff_contract_preview.some((contract) => (
    contract.id === "handoff.receipt_read_verification" &&
    contract.repo_boundary === "Dema_reads_governed_runtime_issues"
  )));
  assert.ok(blueprint.offline_integration_harness.some((item) => (
    item.id === "matrix.boundary_assertions" &&
    item.status === "preview_ready"
  )));
  assert.equal(blueprint.self_proactive_harness.mode, "deterministic_preview_checks");
});

test("buildNetworkBlueprint emits no reusable operator authorization phrase", () => {
  const serialized = JSON.stringify(buildNetworkBlueprint());

  assert.doesNotMatch(serialized, /\bI authorize\b/i);
  assert.doesNotMatch(serialized, /GO:\s*Step 7/i);
  assert.doesNotMatch(serialized, /--authorize\s+["'][^"']+["']/i);
});

test("buildNetworkBlueprint is deterministic and JSON round-trippable", () => {
  const first = buildNetworkBlueprint();
  const second = buildNetworkBlueprint();

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test("buildNetworkBlueprint returns fresh objects on every call", () => {
  const first = buildNetworkBlueprint();
  first.readiness_gates[0].status = "mutated";
  first.handoff_contract_preview[0].repo_boundary = "mutated";
  first.offline_integration_harness[0].status = "mutated";
  first.self_proactive_harness.checks[0] = "mutated";
  first.self_critique[0].risk = "mutated";
  first.boundary.execution_enabled = true;

  const second = buildNetworkBlueprint();
  assert.equal(second.readiness_gates[0].status, "pending");
  assert.equal(second.handoff_contract_preview[0].repo_boundary, "documented_only_not_executed");
  assert.equal(second.offline_integration_harness[0].status, "preview_ready");
  assert.notEqual(second.self_proactive_harness.checks[0], "mutated");
  assert.notEqual(second.self_critique[0].risk, "mutated");
  assert.equal(second.boundary.execution_enabled, false);
});

test("formatNetworkBlueprint renders full-stack layers, gates, and boundary", () => {
  const output = formatNetworkBlueprint(buildNetworkBlueprint());

  assert.match(output, /DEMA Node Network Blueprint/);
  assert.match(output, /Full-stack layers/);
  assert.match(output, /Canonical expansion phases/);
  assert.match(output, /node1\.handoff_contract_defined/);
  assert.match(output, /node2\.propagation_policy/);
  assert.match(output, /handoff\.receipt_read_verification/);
  assert.match(output, /Offline integration harness/);
  assert.match(output, /Self-critique/);
  assert.match(output, /Boundary: preview-only; no network connection; no federation; no handshake/);
});

test("network preview modules have no network side effects", async () => {
  const files = await networkPreviewFiles();

  assert.ok(files.includes(modulePath));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from "node:(net|http|https|tls|dgram)"/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
});

test("dema network blueprint prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "network", "blueprint"]);

  assert.match(stdout, /DEMA Node Network Blueprint/);
  assert.match(stdout, /node1\.handoff_contract_defined/);
  assert.match(stdout, /phase_3/);
  assert.match(stdout, /no network connection; no federation; no handshake/);
});

test("dema network blueprint --json emits the schema-tagged plan", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "network", "blueprint", "--json"]);
  const blueprint = JSON.parse(stdout);

  assert.equal(blueprint.schema, "bizra.dema.node_network_blueprint.v0.1");
  assert.equal(blueprint.mode, "PREVIEW_ONLY");
  assert.equal(blueprint.boundary.network_connection_attempted, false);
  assert.ok(blueprint.readiness_gates.some((gate) => gate.target === "Node1"));
  assert.ok(blueprint.readiness_gates.some((gate) => gate.target === "phase_3"));
});
