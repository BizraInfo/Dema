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

test("classifies GitHub Actions billing lock from annotation excerpt", () => {
  const report = diagnoseDemaFailure({
    failed_command: "gh pr checks 312",
    exit_code: 1,
    stdout_excerpt: "jobs: steps=[], runner_id=0, duration 1-2s, log not found",
    stderr_excerpt:
      "The job was not started because your account is locked due to a billing issue.",
    changed_files: [],
    environment: {
      node_version: "22.x",
      os: "linux",
      branch: "feat/node0-spine-runner-cli-1a",
      ci_provider: "github_actions",
      runner_assigned: false,
      runner_id: 0,
    },
    capability_registry_row: "NODE0_SPINE_RUNNER_CLI_1A",
  });

  assert.equal(report.failure_class, "github_actions_billing_lock");
  assert.equal(report.outward_diagnosis.failure_class, "github_actions_billing_lock");
  assert.equal(report.outward_diagnosis.confidence, "high");
  assert.equal(report.code_implicated, false);
  assert.equal(report.operator_action_required, "billing_unlock");
  assert.equal(report.regression_test_required, false);
  assert.equal(report.measured_status, "MEASURED");
  assert.ok(report.minimal_fix_plan.some((step) => step.includes("billing")));
});

test("inner execute consent alone does not classify as billing lock", () => {
  const report = diagnoseDemaFailure({
    failed_command: "dema node0 spine run",
    exit_code: 1,
    stderr_excerpt: "consent_phrase_mismatch",
    stdout_excerpt: "",
    environment: { node_version: "22.x", os: "linux", branch: "local" },
  });

  assert.notEqual(report.failure_class, "github_actions_billing_lock");
});

test("missing wrapper consent on spine run stays inward/unknown not billing lock", () => {
  const report = diagnoseDemaFailure({
    failed_command: "dema node0 spine run",
    exit_code: 1,
    stderr_excerpt: "consent_phrase_mismatch blocked_by",
    stdout_excerpt: "",
    environment: { node_version: "22.x", os: "linux", branch: "local" },
  });

  assert.notEqual(report.failure_class, "github_actions_billing_lock");
  assert.equal(report.code_implicated, null);
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

// ---------------------------------------------------------------------------
// DEMA-FDE-SEMANTIC-REDERIVATION-1B — the proof must be truer than the claim.
// A diagnosis is a pure function of its carried input; verify re-derives it and
// rejects any body whose classification does not match its own input. Closes
// the forge-and-recompute authority hole and the billing-lock over-trigger.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import {
  buildCiVendorAvailabilityMarker,
  defaultGithubActionsBillingLockFdeFixture,
} from "../packages/core/src/node0-ci-vendor-availability.js";

// Mirrors the kernel's private serializer so a test forge produces the exact
// diagnostic_hash the real verifier computes (proves the forge is internally
// consistent — the only thing semantic re-derivation catches that the internal
// hash check does not). Kept in lock-step with dema-fde-dual-diagnostic.js.
function kernelStableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => kernelStableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const s = kernelStableStringify(value[key]);
        return s === undefined ? [] : [`${JSON.stringify(key)}:${s}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
function kernelDiagnosticHash(body) {
  return `sha256:${createHash("sha256").update(kernelStableStringify(body), "utf8").digest("hex")}`;
}

test("verify rejects a forged-and-rehashed classification (semantic re-derivation)", () => {
  // Honest report from a plainly inward failure.
  const honest = diagnoseDemaFailure({
    failed_command: "npm test",
    exit_code: 1,
    stdout_excerpt: "not ok 1 - AssertionError: expected true",
    stderr_excerpt: "assertion failed",
    changed_files: ["packages/core/src/x.js"],
    environment: { os: "linux" },
  });
  assert.notEqual(honest.failure_class, "github_actions_billing_lock");
  assert.equal(verifyDemaFdeDualDiagnostic(honest).ok, true);

  // Forge: flip to the authority-bearing class, make the body internally
  // self-consistent (rule-consistent dependent fields + a RECOMPUTED hash),
  // but leave the carried input untouched — so it still derives to the honest
  // class. The old internal-hash check passes; re-derivation must not.
  const { diagnostic_hash: _drop, ...body } = honest;
  const forgedBody = {
    ...body,
    failure_class: "github_actions_billing_lock",
    separates_symptom_from_root_cause: true,
    code_implicated: false,
    operator_action_required: "billing_unlock",
    outward_diagnosis: {
      ...body.outward_diagnosis,
      failure_class: "github_actions_billing_lock",
      confidence: "high",
      hypothesis: "forged billing lock",
      evidence: ["forged"],
    },
  };
  const forged = { ...forgedBody, diagnostic_hash: kernelDiagnosticHash(forgedBody) };

  const verified = verifyDemaFdeDualDiagnostic(forged);
  assert.equal(verified.ok, false, "forged+rehashed report must be rejected");
  assert.ok(
    verified.blocked_by.includes("semantic_rederivation_mismatch"),
    `expected semantic_rederivation_mismatch, got ${verified.blocked_by.join(", ")}`,
  );
});

test("verify rejects a report that carries no input to re-derive from", () => {
  const honest = diagnoseDemaFailure(defaultDemaFdeDualDiagnosticFixture());
  const { input: _stripped, ...noInput } = honest;
  const verified = verifyDemaFdeDualDiagnostic(noInput);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("input_missing_for_rederivation"));
});

test("forged billing-lock report cannot open the local proof lane end-to-end", () => {
  // The actual exploit: a forged billing-lock diagnosis routed into the
  // CI-vendor consumer must NOT flip local_proof_lane true.
  const honest = diagnoseDemaFailure({
    failed_command: "npm test",
    exit_code: 1,
    stdout_excerpt: "not ok 1 - AssertionError",
    stderr_excerpt: "boom",
    changed_files: ["a.js"],
    environment: { os: "linux" },
  });
  const { diagnostic_hash: _d, ...body } = honest;
  const forgedBody = {
    ...body,
    failure_class: "github_actions_billing_lock",
    separates_symptom_from_root_cause: true,
    code_implicated: false,
    operator_action_required: "billing_unlock",
    outward_diagnosis: {
      ...body.outward_diagnosis,
      failure_class: "github_actions_billing_lock",
      confidence: "high",
      hypothesis: "forged",
      evidence: ["forged"],
    },
  };
  const forged = { ...forgedBody, diagnostic_hash: kernelDiagnosticHash(forgedBody) };
  const marker = buildCiVendorAvailabilityMarker({ fde_report: forged, operator_declared: true });
  assert.equal(marker.availability, "UNKNOWN");
  assert.equal(marker.local_proof_lane, false);
  assert.ok(marker.blocked_by.includes("semantic_rederivation_mismatch"));
});

test("generic billing prose without GitHub context is NOT a github_actions_billing_lock", () => {
  const generic = diagnoseDemaFailure({
    failed_command: "deploy",
    exit_code: 1,
    stdout_excerpt: "account locked due to a billing issue",
    stderr_excerpt: "billing",
    changed_files: [],
    environment: { os: "linux" }, // no ci_provider, no gh command
  });
  assert.notEqual(
    generic.failure_class,
    "github_actions_billing_lock",
    "generic billing prose must not manufacture the GitHub-specific class",
  );
});

test("genuine GitHub Actions billing-lock still classifies and verifies (regression)", () => {
  const real = diagnoseDemaFailure(defaultGithubActionsBillingLockFdeFixture());
  assert.equal(real.failure_class, "github_actions_billing_lock");
  assert.equal(verifyDemaFdeDualDiagnostic(real).ok, true);
  const marker = buildCiVendorAvailabilityMarker({ fde_report: real, operator_declared: true });
  assert.equal(marker.availability, "GITHUB_ACTIONS_BILLING_LOCK");
  assert.equal(marker.local_proof_lane, true);
});

// Card §6 — per-field adversarial matrix. The single full-body re-derivation
// guard must catch a change to ANY authority-relevant derived field (each
// mutated to an in-domain but wrong value + a recomputed hash, so ONLY
// semantic re-derivation can catch it — not a schema/domain check).
test("re-derivation rejects a change-and-rehash of any authority field", () => {
  const honest = diagnoseDemaFailure({
    failed_command: "npm test",
    exit_code: 1,
    stdout_excerpt: "not ok 1 - AssertionError: expected true to equal false",
    stderr_excerpt: "assertion failed",
    changed_files: ["packages/core/src/x.js"],
    environment: { os: "linux" },
  });
  assert.equal(verifyDemaFdeDualDiagnostic(honest).ok, true, "precondition: honest verifies");

  const flip = (v, ...opts) => opts.find((o) => JSON.stringify(o) !== JSON.stringify(v)) ?? v;
  const mutations = {
    "confidence (inward)": (b) => {
      b.inward_diagnosis = { ...b.inward_diagnosis, confidence: flip(b.inward_diagnosis.confidence, "low", "high") };
    },
    "evidence (inward)": (b) => {
      b.inward_diagnosis = { ...b.inward_diagnosis, evidence: [...b.inward_diagnosis.evidence, "injected_marker"] };
    },
    measured_status: (b) => {
      b.measured_status = flip(b.measured_status, "MEASURED", "UNKNOWN", "PARTIALLY_MEASURED");
    },
    minimal_fix_plan: (b) => {
      b.minimal_fix_plan = Array.isArray(b.minimal_fix_plan) ? [...b.minimal_fix_plan, "injected step"] : "forged plan";
    },
    terminal_state: (b) => {
      b.terminal_state = flip(b.terminal_state, "MEASURED_DIAGNOSIS", "ESCALATE_TO_HUMAN", "INSUFFICIENT_EVIDENCE");
    },
    missing_evidence: (b) => {
      b.missing_evidence = Array.isArray(b.missing_evidence) ? [...b.missing_evidence, "forced_gap"] : ["forced_gap"];
    },
    regression_test_required: (b) => {
      b.regression_test_required = !b.regression_test_required;
    },
    operator_action_required: (b) => {
      b.operator_action_required = "forged_action";
    },
  };

  for (const [field, mutate] of Object.entries(mutations)) {
    const { diagnostic_hash: _drop, ...body } = honest;
    const forgedBody = JSON.parse(JSON.stringify(body));
    mutate(forgedBody);
    // recompute the hash so the body is internally self-consistent — the old
    // internal-hash check would pass; only re-derivation can reject it.
    const forged = { ...forgedBody, diagnostic_hash: kernelDiagnosticHash(forgedBody) };
    const verified = verifyDemaFdeDualDiagnostic(forged);
    assert.equal(verified.ok, false, `${field}: forged+rehashed must be rejected`);
    assert.ok(
      verified.blocked_by.includes("semantic_rederivation_mismatch"),
      `${field}: expected semantic_rederivation_mismatch, got ${verified.blocked_by.join(", ")}`,
    );
  }
});

test("re-derivation still accepts untouched builder output across failure classes", () => {
  const inputs = [
    { failed_command: "npm test", exit_code: 1, stdout_excerpt: "not ok AssertionError", stderr_excerpt: "x", changed_files: ["a.js"], environment: { os: "linux" } },
    { failed_command: "npm install", exit_code: 1, stdout_excerpt: "npm err! enoent", stderr_excerpt: "cannot find module", changed_files: [], environment: { os: "linux" } },
    { failed_command: "gh pr checks 1", exit_code: 1, stdout_excerpt: "runner_id=0 log not found", stderr_excerpt: "account is locked due to a billing issue", changed_files: [], environment: { ci_provider: "github_actions", runner_assigned: false } },
  ];
  for (const input of inputs) {
    const report = diagnoseDemaFailure(input);
    assert.equal(verifyDemaFdeDualDiagnostic(report).ok, true, `honest ${report.failure_class} must verify`);
  }
});
