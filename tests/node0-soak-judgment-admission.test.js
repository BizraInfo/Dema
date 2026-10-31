// NODE0-SOAK-JUDGMENT-ADMISSION-1A

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  projectSoakJudgmentToAdmission,
  NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
  NODE0_ENDURANCE_JUDGMENT_SCHEMA,
} from "../packages/core/src/node0-soak-judgment-admission.js";
import {
  buildNode0CloseMeasurementReceipt,
  evaluateSoakAdmission,
  SOAK_OBSERVATION_SCOPE,
  DEFAULT_SOAK_MIN_DURATION_SECONDS,
} from "../packages/core/src/node0-close-measurement-receipt.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

function insufficientJudgment(overrides = {}) {
  return {
    preview_only: true,
    run_id: "soak-72h-fixture",
    schema: NODE0_ENDURANCE_JUDGMENT_SCHEMA,
    target_ms: 86400000,
    sample_count: 135,
    failure_count: 3,
    observed_span_ms: 40217826,
    continuously_observed: true,
    ok: false,
    verdict: "INSUFFICIENT",
    reason: "observed_span_below_target",
    target_met_by_elapsed_run: false,
    chain: {
      head_hash: "sha256:deadbeef",
      chain_state: "SEALED",
      tamper_evident: true,
    },
    ...overrides,
  };
}

describe("node0-soak-judgment-admission", () => {
  test("null judgment ⇒ soak null, ok true (silence stays silence)", () => {
    const p = projectSoakJudgmentToAdmission(null);
    assert.equal(p.schema, NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA);
    assert.equal(p.ok, true);
    assert.equal(p.soak, null);
    assert.equal(p.refuse_reason, "no_judgment");
    assert.equal(p.authority_delta, 0);
    assert.equal(isCanonicalBoundary(p.boundary), true);
  });

  test("wrong schema refused", () => {
    const p = projectSoakJudgmentToAdmission({
      schema: "not.the.endurance.schema",
      observed_span_ms: 999999999,
      ok: true,
    });
    assert.equal(p.ok, false);
    assert.equal(p.soak, null);
    assert.equal(p.refuse_reason, "schema_mismatch");
  });

  test("real insufficient judgment projects duration but not healthy", () => {
    const p = projectSoakJudgmentToAdmission(insufficientJudgment());
    assert.equal(p.ok, true);
    assert.equal(p.soak.observed, false);
    assert.equal(p.soak.scope, SOAK_OBSERVATION_SCOPE);
    assert.equal(p.soak.observed_duration_seconds, 40217);
    assert.match(p.soak.source, /^node0_endurance_judge:soak-72h-fixture:/);
    assert.equal(p.projection.healthy, false);

    const admission = evaluateSoakAdmission(p.soak);
    assert.equal(admission.status, "VIOLATED");
    assert.equal(admission.reason, "soak_duration_below_minimum");
  });

  test("sufficient healthy judgment maps to SATISFIED soak admission shape", () => {
    const p = projectSoakJudgmentToAdmission(
      insufficientJudgment({
        failure_count: 0,
        observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
        ok: true,
        verdict: "SUFFICIENT",
        target_met_by_elapsed_run: true,
      }),
    );
    assert.equal(p.soak.observed, true);
    assert.equal(
      p.soak.observed_duration_seconds,
      DEFAULT_SOAK_MIN_DURATION_SECONDS,
    );
    const admission = evaluateSoakAdmission(p.soak);
    assert.equal(admission.status, "SATISFIED");
  });

  test("failures block healthy even when span ≥ 72h", () => {
    const p = projectSoakJudgmentToAdmission(
      insufficientJudgment({
        failure_count: 1,
        observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
        ok: false,
        verdict: "SUFFICIENT",
        target_met_by_elapsed_run: true,
      }),
    );
    assert.equal(p.soak.observed, false);
    const admission = evaluateSoakAdmission(p.soak);
    // Duration OK but observed false ⇒ soak_not_healthy / VIOLATED
    assert.equal(admission.status, "VIOLATED");
    assert.equal(admission.reason, "soak_not_healthy");
  });

  test("projected soak feeds measurement receipt without inventing CLOSED", () => {
    const p = projectSoakJudgmentToAdmission(insufficientJudgment());
    const receipt = buildNode0CloseMeasurementReceipt({
      soak: p.soak,
      head_sha: "test",
      measured_at: "2026-10-31T00:00:00.000Z",
    });
    assert.equal(receipt.ok, true);
    assert.equal(receipt.measurement_admits_closed, false);
    assert.equal(receipt.admission_verdict, "OPEN");
    const soakBlock = receipt.blocked_by.find((b) => b.id === "soak");
    assert.ok(soakBlock);
    assert.notEqual(soakBlock.reason, "no_evidence");
  });
});
