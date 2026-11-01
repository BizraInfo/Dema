// DEMA-AX-LIFTOFF-1A — pure companion AX special case.
import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  AX_LIFTOFF_SCHEMA,
  AX_LIFTOFF_TRUTH_LABEL,
  demaAxLiftoffBoundary,
  projectAxLiftoffStrip,
  formatAxLiftoffStrip,
} from "../packages/core/src/dema-ax-liftoff.js";

const faceReady = { ready: true, operational: true, verdict: "ready and consent-gated" };
const soakClean = {
  unit_active: true,
  freeze: { drift_count: 0 },
  samples: { last_ok: true, last_mission_verdict: "CLEAN" },
};

describe("DEMA-AX-LIFTOFF-1A", () => {
  test("AX-01 face ready + soak CLEAN + no gates ⇒ IN_FLOW / FLOW", () => {
    const s = projectAxLiftoffStrip({
      dema_face: faceReady,
      soak_runtime: soakClean,
      halt_gates_exact: [],
      now: "2026-11-01T19:34:00Z",
    });
    assert.equal(s.schema, AX_LIFTOFF_SCHEMA);
    assert.equal(s.truth_label, AX_LIFTOFF_TRUTH_LABEL);
    assert.equal(s.ok, true);
    assert.equal(s.mode, "FLOW");
    assert.equal(s.flow_state, "IN_FLOW");
    assert.equal(s.dema_ready, true);
    assert.equal(s.soak_in_flow, true);
    assert.equal(s.needs_you.length, 0);
    assert.equal(s.authority_delta, 0);
    assert.equal(s.boundary.execution_allowed, false);
  });

  test("AX-02 halt gates ⇒ NEEDS_YOU / BLOCKED (Herdr-shaped)", () => {
    const s = projectAxLiftoffStrip({
      dema_face: faceReady,
      soak_runtime: soakClean,
      halt_gates_exact: [
        "GO push PR slice/health-snapshot-bridge-1a",
        "GO measurement window",
      ],
    });
    assert.equal(s.mode, "NEEDS_YOU");
    assert.equal(s.flow_state, "BLOCKED");
    assert.equal(s.needs_you.length, 2);
    assert.match(s.headline, /Needs you/);
    const text = formatAxLiftoffStrip(s);
    assert.match(text, /GO measurement window/);
    assert.match(text, /NEEDS YOU \(2\)/);
  });

  test("AX-03 face not ready ⇒ HOLD (never false IN_FLOW)", () => {
    const s = projectAxLiftoffStrip({
      dema_face: { ready: false, operational: true, verdict: "awaiting" },
      soak_runtime: soakClean,
      halt_gates_exact: [],
    });
    assert.equal(s.mode, "HOLD");
    assert.equal(s.flow_state, "HOLD");
    assert.equal(s.dema_ready, false);
  });

  test("AX-04 soak active but drifted ⇒ HOLD not FLOW", () => {
    const s = projectAxLiftoffStrip({
      dema_face: faceReady,
      soak_runtime: {
        unit_active: true,
        freeze: { drift_count: 2 },
        samples: { last_ok: true, last_mission_verdict: "CLEAN" },
      },
      halt_gates_exact: [],
    });
    assert.equal(s.flow_state, "HOLD");
    assert.equal(s.soak_in_flow, false);
  });

  test("AX-05 malformed inputs ⇒ UNKNOWN fail-closed", () => {
    const s = projectAxLiftoffStrip({ dema_face: null, halt_gates_exact: "nope" });
    assert.equal(s.ok, false);
    assert.equal(s.mode, "UNKNOWN");
    assert.equal(s.flow_state, "UNKNOWN");
    assert.equal(s.authority_delta, 0);
  });

  test("AX-06 boundary is all-false; strip never claims NODE0_CLOSED", () => {
    const b = demaAxLiftoffBoundary();
    for (const v of Object.values(b)) assert.equal(v, false);
    const s = projectAxLiftoffStrip({
      dema_face: faceReady,
      soak_runtime: soakClean,
      halt_gates_exact: [],
    });
    assert.equal("node0_closed" in s, false);
    assert.match(s.what_this_does_not_prove, /NODE0_CLOSED/);
  });
});
