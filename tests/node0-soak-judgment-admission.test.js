// NODE0-SOAK-JUDGMENT-ADMISSION-1A

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  projectSoakJudgmentToAdmission,
  NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
  NODE0_ENDURANCE_JUDGMENT_SCHEMA,
  NODE0_RUN_RECEIPT_SCHEMA,
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

  test("missing schema refused (not projected as soak evidence)", () => {
    const p = projectSoakJudgmentToAdmission({
      observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
      failure_count: 0,
      continuously_observed: true,
      ok: true,
      verdict: "SUFFICIENT",
      target_met_by_elapsed_run: true,
    });
    assert.equal(p.ok, false);
    assert.equal(p.soak, null);
    assert.equal(p.refuse_reason, "schema_missing");
  });

  test("null failure_count refused (Number(null) must not become 0)", () => {
    const p = projectSoakJudgmentToAdmission(
      insufficientJudgment({
        failure_count: null,
        observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
        ok: true,
        verdict: "SUFFICIENT",
        target_met_by_elapsed_run: true,
      }),
    );
    assert.equal(p.ok, false);
    assert.equal(p.soak, null);
    assert.equal(p.refuse_reason, "invalid_failure_count");
  });

  test("null observed_span_ms refused (Number(null) must not become 0)", () => {
    const p = projectSoakJudgmentToAdmission(
      insufficientJudgment({
        failure_count: 0,
        observed_span_ms: null,
        ok: true,
        verdict: "SUFFICIENT",
        target_met_by_elapsed_run: true,
      }),
    );
    assert.equal(p.ok, false);
    assert.equal(p.soak, null);
    assert.equal(p.refuse_reason, "missing_observed_span_ms");
  });

  test("INSUFFICIENT verdict not overridden by target_met_by_elapsed_run", () => {
    const p = projectSoakJudgmentToAdmission(
      insufficientJudgment({
        failure_count: 0,
        observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
        ok: true,
        verdict: "INSUFFICIENT",
        target_met_by_elapsed_run: true,
      }),
    );
    assert.equal(p.ok, true);
    assert.equal(p.soak.observed, false);
    const admission = evaluateSoakAdmission(p.soak);
    assert.equal(admission.status, "VIOLATED");
    assert.equal(admission.reason, "soak_not_healthy");
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

  test("HEALTHY (live endurance kernel verdict) maps to SATISFIED soak shape", () => {
    const p = projectSoakJudgmentToAdmission(
      insufficientJudgment({
        failure_count: 0,
        observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
        ok: true,
        verdict: "HEALTHY",
        target_met_by_elapsed_run: true,
      }),
    );
    assert.equal(p.ok, true);
    assert.equal(p.soak.observed, true);
    assert.equal(p.projection.verdict, "HEALTHY");
    const admission = evaluateSoakAdmission(p.soak);
    assert.equal(admission.status, "SATISFIED");
  });

  test("sealed node0 run receipt unwraps .verdict and carries run_id", () => {
    const nested = insufficientJudgment({
      failure_count: 0,
      observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
      ok: true,
      verdict: "HEALTHY",
      target_met_by_elapsed_run: true,
    });
    delete nested.run_id;
    const receipt = {
      schema: NODE0_RUN_RECEIPT_SCHEMA,
      run_id: "soak-72h-from-receipt",
      target_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
      verdict: nested,
    };
    const p = projectSoakJudgmentToAdmission(receipt);
    assert.equal(p.ok, true);
    assert.equal(p.soak.observed, true);
    assert.equal(p.projection.run_id, "soak-72h-from-receipt");
    assert.match(p.soak.source, /^node0_endurance_judge:soak-72h-from-receipt:/);
    const admission = evaluateSoakAdmission(p.soak);
    assert.equal(admission.status, "SATISFIED");
  });

  test("short HEALTHY run receipt projects duration but fails 72h admission", () => {
    const receipt = {
      schema: NODE0_RUN_RECEIPT_SCHEMA,
      run_id: "probe-short",
      target_ms: 8000,
      verdict: {
        schema: NODE0_ENDURANCE_JUDGMENT_SCHEMA,
        observed_span_ms: 8554,
        failure_count: 0,
        continuously_observed: true,
        ok: true,
        verdict: "HEALTHY",
        target_met_by_elapsed_run: true,
        chain: { head_hash: "sha256:probe" },
      },
    };
    const p = projectSoakJudgmentToAdmission(receipt);
    assert.equal(p.ok, true);
    assert.equal(p.soak.observed, true);
    assert.equal(p.soak.observed_duration_seconds, 8);
    const admission = evaluateSoakAdmission(p.soak);
    assert.equal(admission.status, "VIOLATED");
    assert.equal(admission.reason, "soak_duration_below_minimum");
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
