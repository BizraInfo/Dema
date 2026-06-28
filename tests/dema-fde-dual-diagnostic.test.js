import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDemaFdeDualDiagnostic,
  diagnoseDemaFailure,
  verifyDemaFdeDualDiagnostic,
  runDemaFdeDualDiagnosticGate,
  defaultDemaFdeDualDiagnosticFixture,
  DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
  DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL,
  FDE_FAILURE_CLASSES,
  FDE_HHMM_PHASES,
} from "../packages/core/src/dema-fde-dual-diagnostic.js";

test("builds deterministic frozen dual diagnostic envelope", () => {
  const input = defaultDemaFdeDualDiagnosticFixture();
  const first = buildDemaFdeDualDiagnostic(input);
  const second = buildDemaFdeDualDiagnostic(input);

  assert.equal(first.schema, DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA);
  assert.equal(first.truth_label, DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL);
  assert.match(first.diagnostic_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.diagnostic_hash, second.diagnostic_hash);
  assert.ok(Object.isFrozen(first));
  assert.ok(FDE_FAILURE_CLASSES.includes(first.failure_class));
});

test("classifies implementation and test drift from assertion excerpts", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());

  assert.equal(report.failure_class, "implementation_defect");
  assert.ok(report.inward_diagnosis.evidence.includes("registry_hash_mismatch"));
  assert.ok(report.inward_diagnosis.evidence.includes("blocked_by"));
  assert.equal(report.regression_test_required, true);
  assert.equal(report.eligible_for_autopatch, false);
  assert.equal(report.consent_required, true);
});

test("classifies environment gap outward from timeout and node markers", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "npm run check",
    exit_code: 1,
    stdout_excerpt: "node version mismatch on coverage gate",
    stderr_excerpt: "timed out waiting for check step",
    environment: { node_version: "20.x", os: "linux", branch: "main" },
  });

  assert.equal(report.outward_diagnosis.failure_class, "environment_gap");
  assert.equal(report.field_validation_required, true);
});

test("classifies doc drift from doc gate markers", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "node scripts/review/doc-staleness-gate.mjs",
    exit_code: 1,
    stderr_excerpt: "doc-staleness gate failed for docs/TESTING.md",
    stdout_excerpt: "",
    environment: { node_version: "22.x", os: "linux", branch: "feat/x" },
  });

  assert.equal(report.failure_class, "doc_drift");
  assert.equal(report.inward_diagnosis.failure_class, "doc_drift");
});

test("classifies permission gap from EACCES markers", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "npm run proof:export",
    exit_code: 1,
    stderr_excerpt: "Error: EACCES: permission denied, open '/root/.dema/receipts'",
    stdout_excerpt: "",
    environment: { node_version: "22.x", os: "linux", branch: "main" },
  });

  assert.equal(report.failure_class, "permission_gap");
  assert.equal(report.field_validation_required, true);
});

test("separates inward and outward hypotheses honestly", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "node --test tests/kernel-purity-check.test.js",
    exit_code: 1,
    stdout_excerpt: "kernel purity violation node:fs",
    stderr_excerpt: "node version 20.x",
    environment: { node_version: "20.x", os: "linux", branch: "main" },
  });

  assert.notEqual(report.inward_diagnosis.hypothesis, report.outward_diagnosis.hypothesis);
  assert.ok(report.root_cause_hypothesis.includes("failure_class="));
  assert.equal(report.separates_symptom_from_root_cause, true);
});

test("returns unknown with low confidence when excerpts are empty", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "",
    exit_code: null,
    stdout_excerpt: "",
    stderr_excerpt: "",
    environment: {},
  });

  assert.equal(report.failure_class, "unknown");
  assert.equal(report.measured_status, "UNKNOWN");
  assert.equal(report.inward_diagnosis.confidence, "low");
  assert.equal(report.outward_diagnosis.confidence, "low");
  assert.equal(report.separates_symptom_from_root_cause, false);
  assert.ok(report.missing_evidence.includes("stdout_or_stderr_excerpt"));
});

test("references capability registry row from input", () => {
  const report = buildDemaFdeDualDiagnostic({
    ...defaultDemaFdeDualDiagnosticFixture(),
    capability_registry_row: "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
  });

  assert.equal(report.capability_registry_reference, "DEMA_FDE_DUAL_DIAGNOSTIC_1A");
  assert.equal(report.input.capability_registry_row, "DEMA_FDE_DUAL_DIAGNOSTIC_1A");
});

test("defaults capability registry reference to DEMA_FDE_DUAL_DIAGNOSTIC_1A", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "npm test",
    exit_code: 1,
    stdout_excerpt: "AssertionError",
    stderr_excerpt: "",
    environment: { node_version: "22.x", os: "linux", branch: "main" },
  });

  assert.equal(report.capability_registry_reference, "DEMA_FDE_DUAL_DIAGNOSTIC_1A");
});

test("verify rejects autopatch eligibility", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  const tampered = { ...report, eligible_for_autopatch: true };
  const verified = verifyDemaFdeDualDiagnostic(tampered);

  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("autopatch_not_false"));
});

test("verify rejects boundary flips and hash tampering", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  const boundaryFlip = {
    ...report,
    boundaries: { ...report.boundaries, patch_applied: true },
  };
  const boundaryVerified = verifyDemaFdeDualDiagnostic(boundaryFlip);
  assert.equal(boundaryVerified.ok, false);
  assert.ok(boundaryVerified.blocked_by.includes("fde:boundary_not_false:patch_applied"));

  const hashTamper = { ...report, failure_class: "unknown" };
  const hashVerified = verifyDemaFdeDualDiagnostic(hashTamper);
  assert.equal(hashVerified.ok, false);
  assert.ok(hashVerified.blocked_by.includes("diagnostic_hash_mismatch"));
});

test("all FDE boundaries remain false", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  for (const [key, value] of Object.entries(report.boundaries)) {
    assert.equal(value, false, `${key} must remain false`);
  }
});

test("gate passes against canonical fixture", () => {
  const gate = runDemaFdeDualDiagnosticGate();

  assert.equal(gate.ok, true);
  assert.equal(gate.eligible_for_autopatch, false);
  assert.match(gate.diagnostic_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(gate.verified.blocked_by, []);
});

test("minimal fix plan is non-empty for classified failures", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  assert.ok(report.minimal_fix_plan.length > 0);
  for (const step of report.minimal_fix_plan) {
    assert.ok(typeof step === "string" && step.length > 0);
  }
});

test("diagnoses missing capability registry evidence as proof_gap", () => {
  const report = diagnoseDemaFailure({
    failed_command:
      "node scripts/review/dema-capability-truth-registry-check.mjs --json",
    exit_code: 1,
    stdout_excerpt: JSON.stringify({
      ok: false,
      blockers: [
        {
          capability_id: "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
          reason: "missing_source_file",
          path: "packages/core/src/dema-fde-dual-diagnostic.js",
        },
      ],
    }),
    stderr_excerpt: "",
    environment: {
      node_version: "22.x",
      os: "linux",
      branch: "main",
    },
    capability_registry_row: "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
  });

  assert.equal(report.failure_class, "proof_gap");
  assert.notEqual(report.failure_class, "unknown");
  assert.notEqual(report.failure_class, "implementation_defect");
  assert.equal(report.inward_diagnosis.failure_class, "proof_gap");
  assert.equal(report.eligible_for_autopatch, false);
  assert.equal(report.consent_required, true);
  assert.ok(report.missing_evidence.length > 0);
});

test("classifies proof gap from registry evidence markers", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "node scripts/review/dema-capability-truth-registry-check.mjs",
    exit_code: 1,
    stderr_excerpt: "missing_test:DEMA_FDE_DUAL_DIAGNOSTIC_1A",
    stdout_excerpt: "required_capability_not_measured_repo",
    environment: { node_version: "22.x", os: "linux", branch: "main" },
  });

  assert.equal(report.failure_class, "proof_gap");
  assert.equal(report.inward_diagnosis.failure_class, "proof_gap");
});

test("classifies boundary violation from blocked live-surface markers", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "dema urp launch",
    exit_code: 1,
    stderr_excerpt: "live urp federation started without consent",
    stdout_excerpt: "wallet_accessed token mint requested",
    environment: { node_version: "22.x", os: "linux", branch: "main" },
  });

  assert.equal(report.failure_class, "boundary_violation");
  assert.equal(report.eligible_for_autopatch, false);
});

test("does not treat eligible_for_autopatch false field text as boundary violation", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "node scripts/review/dema-fde-dual-diagnostic-check.mjs",
    exit_code: 1,
    stdout_excerpt:
      "eligible_for_autopatch: false\nconsent_required: true\ndiagnostic_hash_mismatch blocked_by",
    stderr_excerpt: "invalid_schema blocked_by",
    environment: { node_version: "22.x", os: "linux", branch: "main" },
  });

  assert.notEqual(report.failure_class, "boundary_violation");
});

test("classifies verifier boundary blockers from gate excerpts", () => {
  const report = buildDemaFdeDualDiagnostic({
    failed_command: "node scripts/review/dema-fde-dual-diagnostic-check.mjs --json",
    exit_code: 1,
    stderr_excerpt: "fde:boundary_not_false:push_performed",
    stdout_excerpt: "",
    environment: { node_version: "22.x", os: "linux", branch: "main" },
  });

  assert.equal(report.failure_class, "boundary_violation");
});

test("runDemaFdeDualDiagnosticGate fails closed on malformed explicit report", () => {
  assert.doesNotThrow(() => runDemaFdeDualDiagnosticGate({ report: {} }));
  const gate = runDemaFdeDualDiagnosticGate({ report: {} });
  assert.equal(gate.ok, false);
  assert.equal(gate.failure_class, "unknown");
  assert.equal(gate.inward_confidence, "low");
  assert.ok(gate.verified.blocked_by.includes("invalid_schema"));
});

test("malformed input does not throw and returns unknown diagnosis", () => {
  assert.doesNotThrow(() => buildDemaFdeDualDiagnostic(null));
  assert.doesNotThrow(() => buildDemaFdeDualDiagnostic("bad"));
  const report = buildDemaFdeDualDiagnostic(undefined);
  assert.equal(report.failure_class, "unknown");
  assert.equal(report.measured_status, "UNKNOWN");
});

test("diagnoseDemaFailure alias matches buildDemaFdeDualDiagnostic", () => {
  const input = defaultDemaFdeDualDiagnosticFixture();
  assert.deepEqual(diagnoseDemaFailure(input), buildDemaFdeDualDiagnostic(input));
});

test("emits bounded HHMM lifecycle phases without ML claims", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  assert.equal(report.lifecycle_phases.length, FDE_HHMM_PHASES.length);
  assert.equal(report.lifecycle_phases.at(-1).phase, "S8_BLOCK_AUTOPATCH");
  assert.equal(report.terminal_state, "PARTIALLY_MEASURED_DIAGNOSIS");
});

test("verify rejects unsupported failure_class", () => {
  const report = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  const tampered = { ...report, failure_class: "AUTO_PATCH_EXECUTED" };
  const verified = verifyDemaFdeDualDiagnostic(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("unsupported_failure_class"));
});
