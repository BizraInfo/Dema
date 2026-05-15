import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  buildNetworkBlueprint,
  formatNetworkBlueprint
} from "../packages/core/src/network-blueprint.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const modulePath = fileURLToPath(new URL("../packages/core/src/network-blueprint.js", import.meta.url));

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

test("buildNetworkBlueprint names Node1 and Node2 readiness gates", () => {
  const blueprint = buildNetworkBlueprint();

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
  assert.ok(blueprint.gtm_blockers.some((blocker) => blocker.severity === "launch_blocker"));
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
  first.boundary.execution_enabled = true;

  const second = buildNetworkBlueprint();
  assert.equal(second.readiness_gates[0].status, "pending");
  assert.equal(second.boundary.execution_enabled, false);
});

test("formatNetworkBlueprint renders full-stack layers, gates, and boundary", () => {
  const output = formatNetworkBlueprint(buildNetworkBlueprint());

  assert.match(output, /DEMA Node Network Blueprint/);
  assert.match(output, /Full-stack layers/);
  assert.match(output, /node1\.handoff_contract_defined/);
  assert.match(output, /node2\.propagation_policy/);
  assert.match(output, /Boundary: preview-only; no network connection; no federation; no handshake/);
});

test("network blueprint module has no network side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from "node:(net|http|https|tls|dgram)"/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("dema network blueprint prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "network", "blueprint"]);

  assert.match(stdout, /DEMA Node Network Blueprint/);
  assert.match(stdout, /node1\.handoff_contract_defined/);
  assert.match(stdout, /no network connection; no federation; no handshake/);
});

test("dema network blueprint --json emits the schema-tagged plan", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "network", "blueprint", "--json"]);
  const blueprint = JSON.parse(stdout);

  assert.equal(blueprint.schema, "bizra.dema.node_network_blueprint.v0.1");
  assert.equal(blueprint.mode, "PREVIEW_ONLY");
  assert.equal(blueprint.boundary.network_connection_attempted, false);
  assert.ok(blueprint.readiness_gates.some((gate) => gate.target === "Node1"));
});
