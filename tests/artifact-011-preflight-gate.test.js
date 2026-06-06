import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA,
  ARTIFACT_011_PREFLIGHT_RELEASE_GATE_SCHEMA,
  validateArtifact011PreflightReleaseGate,
} from "../packages/mission/src/artifact-011-ceremony-preflight.js";

function baseReport(overrides = {}) {
  return {
    schema: ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA,
    truth_label: "PREPARED",
    cleared_for_preview_ceremony: true,
    cleared_for_runtime_ceremony: false,
    operator_runtime_ready: false,
    boundary: {
      runtime_executed: false,
      receipt_minted: false,
      artifact_011_measured: false,
      dema_mission_executes: false,
      governed_node0_invoked: false,
    },
    steps: {
      propose_no_consent: { ok: true },
      propose_with_consent: { ok: true },
    },
    blockers: [],
    ...overrides,
  };
}

test("validateArtifact011PreflightReleaseGate passes preview-only report", () => {
  const gate = validateArtifact011PreflightReleaseGate(baseReport());
  assert.equal(gate.schema, ARTIFACT_011_PREFLIGHT_RELEASE_GATE_SCHEMA);
  assert.equal(gate.ok, true);
  assert.equal(gate.blockers.length, 0);
});

test("validateArtifact011PreflightReleaseGate fails when truth_label is MEASURED", () => {
  const gate = validateArtifact011PreflightReleaseGate(
    baseReport({ truth_label: "MEASURED" }),
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.some((b) => b.code === "truth_label_measured"));
});

test("validateArtifact011PreflightReleaseGate fails when governed Node0 invoked", () => {
  const gate = validateArtifact011PreflightReleaseGate(
    baseReport({
      boundary: {
        ...baseReport().boundary,
        governed_node0_invoked: true,
      },
    }),
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.some((b) => b.code === "governed_node0_invoked"));
});

test("validateArtifact011PreflightReleaseGate fails when runtime ceremony cleared in Dema", () => {
  const gate = validateArtifact011PreflightReleaseGate(
    baseReport({ cleared_for_runtime_ceremony: true }),
  );
  assert.equal(gate.ok, false);
  assert.ok(
    gate.blockers.some((b) => b.code === "runtime_ceremony_cleared_in_dema"),
  );
});

test("validateArtifact011PreflightReleaseGate fails when artifact_011_measured claimed", () => {
  const gate = validateArtifact011PreflightReleaseGate(
    baseReport({
      boundary: {
        ...baseReport().boundary,
        artifact_011_measured: true,
      },
    }),
  );
  assert.equal(gate.ok, false);
  assert.ok(
    gate.blockers.some((b) => b.code === "artifact_011_measured_claim"),
  );
});

test("validateArtifact011PreflightReleaseGate fails when mission executes", () => {
  const gate = validateArtifact011PreflightReleaseGate(
    baseReport({
      boundary: {
        ...baseReport().boundary,
        dema_mission_executes: true,
      },
    }),
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.some((b) => b.code === "dema_mission_executes"));
});

test("validateArtifact011PreflightReleaseGate does not require operator_runtime_ready", () => {
  const gate = validateArtifact011PreflightReleaseGate(
    baseReport({ operator_runtime_ready: false }),
  );
  assert.equal(gate.ok, true);
});
