// NODE0-CLOSE-MEASUREMENT-RECEIPT-1A — soak + remote_write admission overlay.

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateNode0ClosureInvariants,
  CLOSURE_INVARIANTS,
  REMOTE_WRITE_OBSERVATION_SCOPE,
} from "../packages/core/src/node0-closure-invariants.js";
import {
  buildNode0CloseMeasurementReceipt,
  evaluateSoakAdmission,
  NODE0_CLOSE_MEASUREMENT_RECEIPT_SCHEMA,
  SOAK_OBSERVATION_SCOPE,
  DEFAULT_SOAK_MIN_DURATION_SECONDS,
} from "../packages/core/src/node0-close-measurement-receipt.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

function obs(invariant, observed) {
  return {
    observed,
    source: `test-fixture:${invariant.id}`,
    scope: invariant.required_scope,
  };
}

function allSatisfiedEvidence({ remoteWriteObserved = false } = {}) {
  const evidence = {};
  for (const inv of CLOSURE_INVARIANTS) {
    evidence[inv.id] = obs(inv, inv.required);
  }
  evidence.remote_write = obs(
    CLOSURE_INVARIANTS.find((i) => i.id === "remote_write"),
    remoteWriteObserved,
  );
  return evidence;
}

function healthySoak(overrides = {}) {
  return {
    observed: true,
    source: "test-fixture:soak",
    scope: SOAK_OBSERVATION_SCOPE,
    observed_duration_seconds: DEFAULT_SOAK_MIN_DURATION_SECONDS,
    ...overrides,
  };
}

describe("node0-close-measurement-receipt", () => {
  test("empty evidence ⇒ usable OPEN receipt with NODE0_CLOSED false", () => {
    const r = buildNode0CloseMeasurementReceipt({
      head_sha: "abc",
      measured_at: "2026-10-31T00:00:00.000Z",
    });
    assert.equal(r.schema, NODE0_CLOSE_MEASUREMENT_RECEIPT_SCHEMA);
    assert.equal(r.ok, true);
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.admission_verdict, "OPEN");
    assert.equal(r.authority_delta, 0);
    assert.equal(isCanonicalBoundary(r.boundary), true);
    assert.equal(r.admission.soak_satisfied, false);
    assert.equal(r.admission.remote_write_satisfied, false);
    assert.ok(r.blocked_by.some((b) => b.id === "soak"));
    assert.ok(r.blocked_by.some((b) => b.id === "remote_write"));
  });

  test("ten satisfied without soak still refuses NODE0_CLOSED", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    assert.equal(ledger.verdict, "CLOSED");
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      // soak omitted
    });
    assert.equal(r.ok, true);
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.admission.ledger_claims_closed, true);
    assert.equal(r.admission.remote_write_satisfied, true);
    assert.equal(r.admission.soak_satisfied, false);
    assert.ok(r.blocked_by.some((b) => b.id === "soak"));
  });

  test("soak short of 72h refuses even with closed ledger", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak({ observed_duration_seconds: 3600 }),
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.soak.status, "VIOLATED");
    assert.equal(r.soak.reason, "soak_duration_below_minimum");
  });

  test("closed ledger + healthy soak + remote_write ⇒ NODE0_CLOSED true", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak(),
    });
    assert.equal(r.ok, true);
    assert.equal(r.measurement_admits_closed, true);
    assert.equal(r.admission_verdict, "ADMITTED");
    assert.equal(r.blocked_by.length, 0);
  });

  test("remote_write VIOLATED (external path) blocks admission", () => {
    const ledger = evaluateNode0ClosureInvariants(
      allSatisfiedEvidence({ remoteWriteObserved: true }),
    );
    assert.equal(ledger.verdict, "OPEN");
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak(),
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.remote_write.status, "VIOLATED");
  });

  test("forged CLOSED ledger fails verify ⇒ ok false, NODE0_CLOSED false", () => {
    const open = evaluateNode0ClosureInvariants({});
    const forged = {
      ...open,
      verdict: "CLOSED",
    };
    Object.defineProperty(forged, "node0_closed", {
      value: true,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: forged,
      soak: healthySoak(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.measurement_admits_closed, false);
  });

  test("evaluateSoakAdmission rejects wrong scope", () => {
    const s = evaluateSoakAdmission({
      observed: true,
      source: "x",
      scope: "wrong",
      observed_duration_seconds: DEFAULT_SOAK_MIN_DURATION_SECONDS,
    });
    assert.equal(s.status, "UNKNOWN");
    assert.equal(s.reason, "observation_scope_mismatch");
    assert.equal(s.required_scope, SOAK_OBSERVATION_SCOPE);
  });


  test("cannot lower soak floor below 72h via min_soak_duration_seconds", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak({ observed_duration_seconds: 1 }),
      min_soak_duration_seconds: 1,
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.admission.soak_min_duration_seconds, DEFAULT_SOAK_MIN_DURATION_SECONDS);
    assert.equal(r.soak.status, "VIOLATED");
  });
  test("soak scope constant is not the remote_write scope", () => {
    assert.notEqual(SOAK_OBSERVATION_SCOPE, REMOTE_WRITE_OBSERVATION_SCOPE);
  });
});
