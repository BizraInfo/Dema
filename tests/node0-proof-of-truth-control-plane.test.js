import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNode0ProofOfTruthControlPlane,
  verifyNode0ProofOfTruthControlPlane,
  runNode0ProofOfTruthControlPlane,
  detectEconomicOverclaim,
  computeReleaseVerdict,
  HERMETIC_CONTROL_PLANE_FIXTURE,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";

const baseInput = {
  commit: "abc123def456",
  checks: {
    schema: true,
    invariants: true,
    fail_closed: true,
    test: true,
    coverage: true,
    check: true,
    perf: true,
    delivery: true,
    sha256: true,
    codeql: "PASS",
    gitleaks: "PASS",
    bizra_review_gate: "PASS",
  },
  workflows: {
    ci_matrix: "PASS",
    local_operator_seal: "PASS",
    ci_remote_seal: "PENDING",
    codeql: "PASS",
    gitleaks: "PASS",
  },
  coverage: { present: true, lines: 95, threshold: 80 },
  perf: { present: true, boot_latency_ms: 120, ceiling: 150 },
  claims: [],
  risks: [],
  boundaries: {
    no_token_mint: true,
    no_wallet_action: true,
    no_node1_activation: true,
    no_urp_publication: true,
    no_autonomous_runtime: true,
  },
};

test("happy path hermetic fixture → READY_LOCAL", () => {
  const result = runNode0ProofOfTruthControlPlane({ ...HERMETIC_CONTROL_PLANE_FIXTURE });
  assert.equal(result.ok, true);
  assert.equal(result.ledger.release_verdict, "READY_LOCAL");
  assert.equal(result.ledger.schema, NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA);
  assert.equal(result.ledger.truth_label, NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL);
  assert.match(result.ledger.receipt_hash, /^sha256:[a-f0-9]{64}$/);
});

test("BLOCKED when tests fail", () => {
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...baseInput,
    checks: { ...baseInput.checks, test: false },
  });
  assert.equal(ledger.release_verdict, "BLOCKED");
  assert.equal(ledger.empirical.tests_pass, false);
});

test("BLOCKED when coverage rail missing", () => {
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...baseInput,
    coverage: { present: false },
  });
  assert.equal(ledger.release_verdict, "BLOCKED");
  assert.equal(ledger.empirical.coverage_present, false);
});

test("BLOCKED when perf rail missing", () => {
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...baseInput,
    perf: { present: false },
  });
  assert.equal(ledger.release_verdict, "BLOCKED");
  assert.equal(ledger.empirical.perf_present, false);
});

test("BLOCKED when delivery_check fails", () => {
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...baseInput,
    checks: { ...baseInput.checks, delivery: false },
  });
  assert.equal(ledger.release_verdict, "BLOCKED");
  const verified = verifyNode0ProofOfTruthControlPlane(ledger);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("delivery_check_failed"));
});

test("BLOCKED on economic overclaim", () => {
  assert.equal(detectEconomicOverclaim(["LIVE_TOKEN_ACTIVE"]), true);
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...baseInput,
    claims: ["LIVE_TOKEN_ACTIVE"],
  });
  assert.equal(ledger.economic.status, "OVERCLAIMED");
  assert.equal(ledger.release_verdict, "BLOCKED");
});

test("verifier rejects READY_REMOTE overclaim verdict", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(baseInput);
  const tampered = { ...ledger, release_verdict: "READY_REMOTE" };
  const verified = verifyNode0ProofOfTruthControlPlane(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("overclaim_verdict"));
});

test("verifier rejects PUBLIC_SAFE overclaim verdict", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(baseInput);
  const tampered = { ...ledger, release_verdict: "PUBLIC_SAFE" };
  const verified = verifyNode0ProofOfTruthControlPlane(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("overclaim_verdict"));
});

test("boundary tamper fails verify", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(baseInput);
  const tampered = {
    ...ledger,
    boundary: { ...ledger.boundary, no_token_mint: false },
  };
  const verified = verifyNode0ProofOfTruthControlPlane(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("boundary_no_token_mint"));
});

test("receipt_hash is deterministic", () => {
  const a = buildNode0ProofOfTruthControlPlane(baseInput);
  const b = buildNode0ProofOfTruthControlPlane(baseInput);
  assert.equal(a.receipt_hash, b.receipt_hash);
});

test("ledger output is frozen", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(baseInput);
  assert.equal(Object.isFrozen(ledger), true);
  assert.equal(Object.isFrozen(ledger.formal), true);
  assert.equal(Object.isFrozen(ledger.boundary), true);
});

test("missing commit throws", () => {
  assert.throws(
    () => buildNode0ProofOfTruthControlPlane({ ...baseInput, commit: "" }),
    /commit hash required/,
  );
});

test("verify fails on missing schema and truth_label", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(baseInput);
  const bad = { ...ledger, schema: "wrong", truth_label: "wrong" };
  const verified = verifyNode0ProofOfTruthControlPlane(bad);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("missing_schema"));
  assert.ok(verified.blocked_by.includes("missing_truth_label"));
});

test("release_mode blocks on unknown CodeQL", () => {
  const verdict = computeReleaseVerdict({
    checks: baseInput.checks,
    workflows: { ...baseInput.workflows, codeql: "UNKNOWN", gitleaks: "PASS" },
    coverage: baseInput.coverage,
    perf: baseInput.perf,
    claims: [],
    release_mode: true,
  });
  assert.equal(verdict, "BLOCKED");
});

test("MEASURED economic claim does not overclaim", () => {
  const ledger = buildNode0ProofOfTruthControlPlane({
    ...baseInput,
    claims: ["ECONOMY_SIMULATION_MEASURED"],
  });
  assert.equal(ledger.economic.status, "BLOCKED_UNLESS_MEASURED");
  assert.equal(ledger.release_verdict, "READY_LOCAL");
});
