import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildNetworkRefusalMatrixPreview,
  formatNetworkRefusalMatrixPreview,
} from "../packages/core/src/network-refusal-matrix-preview.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const modulePath = fileURLToPath(
  new URL(
    "../packages/core/src/network-refusal-matrix-preview.js",
    import.meta.url,
  ),
);

const forbiddenAuthorizationPatterns = [
  /\bI authorize\b/i,
  /\bI approve\b/i,
  /--authorize\s+["'][^"']+["']/i,
];

function boundaryKeyFromVerification(verifiedBy) {
  return [...verifiedBy.matchAll(/boundary\.([a-z_]+)/g)].map(
    (match) => match[1],
  );
}

test("buildNetworkRefusalMatrixPreview emits a schema-tagged inert preview", () => {
  const preview = buildNetworkRefusalMatrixPreview();

  assert.equal(
    preview.schema,
    "bizra.dema.network_refusal_matrix_preview.v0.1",
  );
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.fixture.fixture_slot_count, 5);
  assert.equal(preview.fixture.live_nodes, 0);
  assert.equal(preview.fixture.runtime_nodes, 0);
  assert.equal(preview.fixture.topology_claim, "none");
  assert.equal(preview.fixture.named_nodes_introduced, false);
});

test("buildNetworkRefusalMatrixPreview avoids invented topology names", () => {
  const serialized = JSON.stringify(buildNetworkRefusalMatrixPreview());

  assert.doesNotMatch(serialized, /Node3|Node4|peer_alpha|peer_beta|phase_5/);
});

test("buildNetworkRefusalMatrixPreview keeps every effect boundary false", () => {
  const preview = buildNetworkRefusalMatrixPreview();
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
    "matrix_file_written",
    "simulation_executed",
    "scenario_emitted_authorization_phrase",
    "topology_claim_made",
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("buildNetworkRefusalMatrixPreview refuses every scenario until gates are measured", () => {
  const preview = buildNetworkRefusalMatrixPreview();
  const expectedIds = [
    "partition_shape",
    "rejoin_shape",
    "adversarial_slot_input_shape",
    "stale_receipt_shape",
    "missing_micro_consent_shape",
    "schema_mismatch_shape",
  ];

  assert.deepEqual(
    preview.matrix.map((entry) => entry.id),
    expectedIds,
  );
  for (const entry of preview.matrix) {
    assert.equal(entry.preview_decision, "describe_refusal_only");
    assert.equal(entry.future_live_decision, "refuse_until_gate_measured");
    assert.equal(entry.executed, false);
    assert.equal(entry.socket_opened, false);
    assert.equal(entry.handshake_performed, false);
    assert.equal(entry.federation_started, false);
    assert.equal(entry.receipt_minted, false);
    assert.ok(entry.refusal_reasons.length > 0);
    assert.ok(
      entry.required_gates_before_live_action.includes(
        "step7_capability_anchor_minted",
      ),
    );
  }
});

test("buildNetworkRefusalMatrixPreview self-proactive checks are computed and pass", () => {
  const preview = buildNetworkRefusalMatrixPreview();

  assert.equal(preview.self_proactive_harness.mode, "computed_preview_checks");
  assert.ok(preview.self_proactive_harness.checks.length >= 4);
  assert.ok(
    preview.self_proactive_harness.checks.every((item) => item.passed === true),
  );
});

test("buildNetworkRefusalMatrixPreview maps micro-compliance to real false boundaries", () => {
  const preview = buildNetworkRefusalMatrixPreview();

  for (const control of preview.micro_compliance) {
    const keys = boundaryKeyFromVerification(control.verified_by);
    for (const key of keys) {
      assert.equal(
        preview.boundary[key],
        false,
        `${control.control} references missing/true ${key}`,
      );
    }
  }
});

test("buildNetworkRefusalMatrixPreview emits micro-consent requirements without approval", () => {
  const preview = buildNetworkRefusalMatrixPreview();

  assert.equal(
    preview.micro_consent.preview_scope,
    "partition rejoin refusal matrix preview only",
  );
  assert.equal(
    preview.micro_consent.current_preview_requires_operator_authorization,
    false,
  );
  assert.equal(
    preview.micro_consent
      .future_live_probe_requires_fresh_current_operator_turn,
    true,
  );
  assert.equal(preview.micro_consent.phrase_emitted, false);
  assert.equal(preview.micro_consent.approval_recorded, false);
  assert.equal(preview.micro_consent.reusable_authorization_created, false);
  assert.equal(preview.micro_consent.broad_consent_allowed, false);
});

test("buildNetworkRefusalMatrixPreview uses a non-live analogy", () => {
  const preview = buildNetworkRefusalMatrixPreview();

  assert.equal(
    preview.analogical_model.analogy,
    "paper truth table for a circuit breaker",
  );
  assert.equal(
    preview.analogical_model.boundary,
    "paper_matrix_not_running_system",
  );
  assert.ok(preview.analogical_model.not_analogous_to.includes("live network"));
  assert.ok(
    preview.analogical_model.not_analogous_to.includes("security testbed"),
  );
});

test("buildNetworkRefusalMatrixPreview emits no reusable authorization phrase", () => {
  const outputs = [
    JSON.stringify(buildNetworkRefusalMatrixPreview()),
    formatNetworkRefusalMatrixPreview(buildNetworkRefusalMatrixPreview()),
  ];

  for (const output of outputs) {
    for (const pattern of forbiddenAuthorizationPatterns) {
      assert.doesNotMatch(output, pattern);
    }
  }
});

test("buildNetworkRefusalMatrixPreview is deterministic and returns fresh objects", () => {
  const first = buildNetworkRefusalMatrixPreview();
  const second = buildNetworkRefusalMatrixPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);

  first.matrix[0].preview_decision = "mutated";
  first.micro_compliance[0].verified_by = "mutated";
  first.boundary.outbound_socket_opened = true;

  const third = buildNetworkRefusalMatrixPreview();
  assert.equal(third.matrix[0].preview_decision, "describe_refusal_only");
  assert.notEqual(third.micro_compliance[0].verified_by, "mutated");
  assert.equal(third.boundary.outbound_socket_opened, false);
});

test("network refusal matrix module has no execution or nondeterministic imports", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process)["']/,
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(
    source,
    /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/,
  );
  assert.doesNotMatch(source, /\bwriteFile\b|\bappendFile\b|\bmkdir\b/);
});

test("formatNetworkRefusalMatrixPreview renders the safety posture", () => {
  const output = formatNetworkRefusalMatrixPreview(
    buildNetworkRefusalMatrixPreview(),
  );

  assert.match(output, /DEMA Network Refusal Matrix Preview/);
  assert.match(output, /0 live nodes; 0 sockets; 0 receipts minted/);
  assert.match(output, /partition_shape/);
  assert.match(output, /rejoin_shape/);
  assert.match(output, /Micro-compliance/);
  assert.match(output, /Micro-consent/);
  assert.match(output, /paper truth table for a circuit breaker/);
  assert.match(output, /no partition executed; no rejoin executed; no sockets/);
});

test("dema network refusal preview prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "network",
    "refusal",
    "preview",
  ]);

  assert.match(stdout, /DEMA Network Refusal Matrix Preview/);
  assert.match(stdout, /partition_shape/);
  assert.match(stdout, /future=refuse_until_gate_measured/);
});

test("dema network refusal preview --json emits the schema-tagged preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "network",
    "refusal",
    "preview",
    "--json",
  ]);
  const preview = JSON.parse(stdout);

  assert.equal(
    preview.schema,
    "bizra.dema.network_refusal_matrix_preview.v0.1",
  );
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.fixture.fixture_slot_count, 5);
  assert.equal(preview.fixture.live_nodes, 0);
  assert.equal(preview.boundary.outbound_socket_opened, false);
});
