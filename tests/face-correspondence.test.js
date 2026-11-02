import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessFaceCorrespondence,
  formatReadyForFace,
  FACE_CORRESPONDENCE_SCHEMA,
} from "../packages/core/src/face-correspondence.js";
import {
  evaluatePredicates,
  doctorVerdict,
  doctorState,
} from "../packages/core/src/doctor-dashboard.js";
import { formatStatus } from "../packages/core/src/status.js";

function okRuntime() {
  return {
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    findings: [],
    gateway: { reachable: true },
  };
}

describe("FACE-CORRESPONDENCE-1A", () => {
  it("refuses runtime Ready + PARTIAL_NODE as a ready face", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: true,
      node_state: "PARTIAL_NODE",
    });
    assert.equal(c.schema, FACE_CORRESPONDENCE_SCHEMA);
    assert.equal(c.ok, false);
    assert.equal(c.face_ready, false);
    assert.equal(c.ceiling_label, "RUNTIME_READY_FACE_INCOMPLETE");
    assert.ok(c.reasons.includes("runtime_ready_with_incomplete_profile"));
  });

  it("allows FACE_READY only when runtime ready and EXISTING_NODE", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: true,
      node_state: "EXISTING_NODE",
    });
    assert.equal(c.ok, true);
    assert.equal(c.face_ready, true);
    assert.equal(c.ceiling_label, "FACE_READY");
  });

  it("UNBOUND when node_state omitted — does not invent completeness", () => {
    const c = assessFaceCorrespondence({ runtime_ready: true });
    assert.equal(c.binding, "UNBOUND");
    assert.equal(c.face_ready, false);
  });

  it("doctor never verdicts ready-and-consent-gated under PARTIAL_NODE", () => {
    const preds = evaluatePredicates(okRuntime(), {
      node_state: "PARTIAL_NODE",
    });
    const profile = preds.find((p) => p.key === "operatorProfile");
    assert.equal(profile.status, "fail");
    assert.equal(profile.value, "PARTIAL_NODE");
    assert.match(doctorVerdict(preds), /profile incomplete/i);
    assert.notEqual(doctorVerdict(preds), "ready and consent-gated");
    assert.equal(doctorState(preds).operational, false);
    assert.equal(doctorState(preds).reason, "profile_incomplete");
    assert.equal(doctorState(preds).preview_environment_valid, true);
  });

  it("legacy evaluatePredicates without node_state stays all-ok for ok runtime", () => {
    const preds = evaluatePredicates(okRuntime());
    assert.equal(
      preds.some((p) => p.key === "operatorProfile"),
      false,
    );
    assert.equal(doctorVerdict(preds), "ready and consent-gated");
  });

  it("formatStatus qualifies Ready when profile is PARTIAL_NODE", () => {
    const out = formatStatus(
      { ...okRuntime(), human: "Mumu", node: "Node0" },
      { color: false, node_state: "PARTIAL_NODE" },
    );
    assert.match(out, /Profile: PARTIAL_NODE/);
    assert.match(out, /Ready: true \(runtime only — profile PARTIAL_NODE/);
    assert.doesNotMatch(out, /^  Ready: true$/m);
  });

  it("formatReadyForFace stays plain true when unbound", () => {
    assert.equal(
      formatReadyForFace({ runtime_ready: true, node_state: null }),
      "true",
    );
  });
});
