import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildOfflineNetworkFixturePreview,
  formatOfflineNetworkFixturePreview
} from "../packages/core/src/network-fixture-preview.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const modulePath = fileURLToPath(new URL("../packages/core/src/network-fixture-preview.js", import.meta.url));

const forbiddenAuthorizationPatterns = [
  /\bI authorize\b/i,
  /GO:\s*/i,
  /--authorize\s+["'][^"']+["']/i
];

test("buildOfflineNetworkFixturePreview emits a schema-tagged inert preview", () => {
  const preview = buildOfflineNetworkFixturePreview();

  assert.equal(preview.schema, "bizra.dema.offline_network_fixture_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.fixture.fixture_slot_count, 5);
  assert.equal(preview.fixture.live_nodes, 0);
  assert.equal(preview.fixture.runtime_nodes, 0);
  assert.equal(preview.fixture.sockets_opened, 0);
  assert.equal(preview.fixture.topology_claim, "none");
  assert.equal(preview.fixture.named_nodes_introduced, false);
});

test("buildOfflineNetworkFixturePreview avoids invented node names", () => {
  const preview = buildOfflineNetworkFixturePreview();
  const serialized = JSON.stringify(preview);

  assert.doesNotMatch(serialized, /Node3|Node4|peer_alpha|peer_beta/);
  assert.equal(preview.slots.length, 5);
  assert.ok(preview.slots.some((slot) => slot.role_target === "Node0"));
  assert.ok(preview.slots.some((slot) => slot.role_target === "Node1"));
  assert.ok(preview.slots.some((slot) => slot.role_target === "Node2"));
  assert.equal(
    preview.slots.filter((slot) => slot.role_target === "phase_3_simulation_slot").length,
    2
  );
  assert.ok(preview.slots.every((slot) => slot.named_identity === null));
});

test("buildOfflineNetworkFixturePreview keeps every effect boundary false", () => {
  const preview = buildOfflineNetworkFixturePreview();
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
    "authorization_phrase_emitted",
    "local_state_written",
    "fixture_file_written",
    "simulation_executed",
    "scenario_emitted_authorization_phrase",
    "topology_claim_made"
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("buildOfflineNetworkFixturePreview scenarios are shape-only and no-mint", () => {
  const preview = buildOfflineNetworkFixturePreview();

  for (const scenario of preview.inert_scenarios) {
    assert.equal(scenario.simulation_status, "describes_shape_only");
    assert.equal(scenario.executed, false);
    assert.equal(scenario.produces_receipt, false);
    assert.equal(scenario.not_executed_because, "no runtime in this repo");
  }
});

test("buildOfflineNetworkFixturePreview maps micro-compliance to falsifiable boundaries", () => {
  const preview = buildOfflineNetworkFixturePreview();
  const controls = preview.micro_compliance.map((item) => item.control);

  assert.ok(controls.includes("no_outbound_sockets"));
  assert.ok(controls.includes("no_runtime_start"));
  assert.ok(controls.includes("no_receipt_or_capability_mint"));
  assert.ok(controls.includes("no_authorization_text"));
  assert.ok(preview.micro_compliance.every((item) => item.verified_by.includes("===")));
});

test("buildOfflineNetworkFixturePreview emits micro-consent requirements without approval", () => {
  const preview = buildOfflineNetworkFixturePreview();

  assert.equal(preview.micro_consent.preview_scope, "offline fixture preview only");
  assert.equal(preview.micro_consent.current_preview_requires_operator_authorization, false);
  assert.equal(preview.micro_consent.future_live_probe_requires_fresh_current_operator_turn, true);
  assert.equal(preview.micro_consent.phrase_emitted, false);
  assert.equal(preview.micro_consent.approval_recorded, false);
  assert.equal(preview.micro_consent.reusable_authorization_created, false);
  assert.equal(preview.micro_consent.broad_consent_allowed, false);
});

test("buildOfflineNetworkFixturePreview uses a non-live analogy", () => {
  const preview = buildOfflineNetworkFixturePreview();

  assert.equal(preview.analogical_model.analogy, "static lab bench schematic");
  assert.equal(preview.analogical_model.boundary, "paper_model_not_running_system");
  assert.ok(preview.analogical_model.not_analogous_to.includes("live network"));
  assert.ok(preview.analogical_model.not_analogous_to.includes("security testbed"));
});

test("buildOfflineNetworkFixturePreview emits no reusable authorization phrase", () => {
  const outputs = [
    JSON.stringify(buildOfflineNetworkFixturePreview()),
    formatOfflineNetworkFixturePreview(buildOfflineNetworkFixturePreview())
  ];

  for (const output of outputs) {
    for (const pattern of forbiddenAuthorizationPatterns) {
      assert.doesNotMatch(output, pattern);
    }
  }
});

test("buildOfflineNetworkFixturePreview is deterministic and returns fresh objects", () => {
  const first = buildOfflineNetworkFixturePreview();
  const second = buildOfflineNetworkFixturePreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);

  first.slots[0].state = "mutated";
  first.micro_compliance[0].verified_by = "mutated";
  first.boundary.outbound_socket_opened = true;

  const third = buildOfflineNetworkFixturePreview();
  assert.equal(third.slots[0].state, "baseline_reference_only");
  assert.notEqual(third.micro_compliance[0].verified_by, "mutated");
  assert.equal(third.boundary.outbound_socket_opened, false);
});

test("network fixture preview module has no execution or nondeterministic imports", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process)["']/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
  assert.doesNotMatch(source, /\bwriteFile\b|\bappendFile\b|\bmkdir\b/);
});

test("formatOfflineNetworkFixturePreview renders the safety posture", () => {
  const output = formatOfflineNetworkFixturePreview(buildOfflineNetworkFixturePreview());

  assert.match(output, /DEMA Offline Network Fixture Preview/);
  assert.match(output, /0 live nodes; 0 sockets/);
  assert.match(output, /Fixture slots: 5/);
  assert.match(output, /Micro-compliance/);
  assert.match(output, /Micro-consent/);
  assert.match(output, /static lab bench schematic/);
  assert.match(output, /no live nodes; no sockets; no federation; no handshake/);
});

test("dema network fixture preview prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "network", "fixture", "preview"]);

  assert.match(stdout, /DEMA Offline Network Fixture Preview/);
  assert.match(stdout, /0 live nodes; 0 sockets/);
  assert.match(stdout, /Topology claim: none/);
});

test("dema network fixture preview --json emits the schema-tagged preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "network", "fixture", "preview", "--json"]);
  const preview = JSON.parse(stdout);

  assert.equal(preview.schema, "bizra.dema.offline_network_fixture_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.fixture.fixture_slot_count, 5);
  assert.equal(preview.fixture.live_nodes, 0);
  assert.equal(preview.boundary.outbound_socket_opened, false);
});
