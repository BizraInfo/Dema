import test from "node:test";
import assert from "node:assert/strict";

import { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE } from "../packages/core/src/diagnostic-consent.js";
import {
  LAYER_A5_ROADMAP_STEP,
  buildLayerA5Checklist,
  buildLayerA5OperatorPrepReport,
} from "../packages/core/src/layer-a5-operator-prep.js";

function makePreflight(overrides = {}) {
  return {
    schema: "bizra.dema.artifact_011_ceremony_preflight.v0.1",
    truth_label: "PREPARED",
    artifact_id: "ARTIFACT-011",
    dema_home: "/home/op/.dema",
    cleared_for_preview_ceremony: true,
    operator_runtime_ready: false,
    steps: {
      setup: { ok: true },
      setup_check: { ok: true },
      status: {
        ok: true,
        parsed: {
          ready: true,
          consoleReady: true,
          activationGate: "EXPLICIT_GO_REQUIRED",
          daemonStatus: "stopped",
        },
      },
      doctor: { ok: true, exitCode: 1 },
      propose_no_consent: { ok: true },
      propose_with_consent: { ok: true },
    },
    blockers: [],
    boundary: {
      runtime_executed: false,
      receipt_minted: false,
      artifact_011_measured: false,
      dema_mission_executes: false,
      governed_node0_invoked: false,
    },
    ...overrides,
  };
}

test("buildLayerA5Checklist marks doctor exit non-zero as not ready", () => {
  const checklist = buildLayerA5Checklist(makePreflight());
  const doctorItem = checklist.find((c) => c.id === "doctor_exit_zero");
  assert.equal(doctorItem.ok, false);
});

test("buildLayerA5OperatorPrepReport stays preview-only and names consent phrase", () => {
  const readyPreflight = makePreflight({
    operator_runtime_ready: true,
    steps: {
      ...makePreflight().steps,
      doctor: { ok: true, exitCode: 0 },
    },
  });
  const report = buildLayerA5OperatorPrepReport(readyPreflight);

  assert.equal(report.road_map_step, LAYER_A5_ROADMAP_STEP);
  assert.equal(report.operator_runtime_ready, true);
  assert.equal(report.cleared_for_governed_runtime, false);
  assert.equal(report.boundary.artifact_011_measured, false);
  assert.equal(report.consent_phrase, BOUNDED_DIAGNOSTIC_CONSENT_PHRASE);
  assert.match(report.recommended_next, /governed Node0 runtime ceremony/);
});

test("buildLayerA5OperatorPrepReport surfaces operator setup gap", () => {
  const report = buildLayerA5OperatorPrepReport(makePreflight());
  assert.equal(report.operator_runtime_ready, false);
  assert.match(report.recommended_next, /operator_runtime_ready=true/);
});
