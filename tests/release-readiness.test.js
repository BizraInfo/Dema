import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildReleaseReadinessReport,
  findActionRefs,
  findNodeMatrix,
  findRunCommands,
  findWorkflowEvents,
  parseWorkflowWorktreeChanges,
  formatReleaseReadinessReport,
  evaluateReleaseReadiness,
  exitCodeFromEvaluation,
  extractReportJson,
} from "../scripts/release-readiness.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/release-readiness.mjs", import.meta.url),
);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixedNow = new Date("2026-05-14T02:14:00.000Z");

function buildCleanReleaseReadinessReport(options = {}) {
  return buildReleaseReadinessReport({ workflowStatusText: "", ...options });
}

function hasRisk(report, code) {
  return report.risks.some((risk) => risk.code === code);
}

test("buildReleaseReadinessReport emits schema-tagged PMBOK release status", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });

  assert.equal(report.schema, "bizra.dema.release_readiness.v0.1");
  assert.equal(report.generated_at, fixedNow.toISOString());
  assert.equal(report.mode, "READ_ONLY_AUDIT");
  assert.equal(report.boundary.external_deploy_performed, false);
  assert.equal(report.boundary.secrets_accessed, false);
  assert.equal(report.management_bok.domains.length, 10);
  assert.ok(
    report.management_bok.domains.includes("communications_management"),
  );
  assert.equal(
    report.ci_cd_maturity.model,
    "advisory_pmbok_aligned_maturity_v1",
  );
  assert.equal(report.ci_cd_maturity.current_level.id, "level_3_defined");
  assert.equal(
    report.pipeline_automation.posture,
    "advisory_read_only_pipeline_audit",
  );
  assert.equal(
    report.rollout_rollback.rollout.deployment_performed_by_audit,
    false,
  );
  assert.equal(
    report.traceability.evidence_scope,
    "repository_files_only_no_secrets_no_external_deploy",
  );
  assert.ok(report.pipeline.gates.some((gate) => gate.command === "npm test"));
  assert.ok(
    report.pipeline.gates.some((gate) => gate.command === "npm run check"),
  );
});

test("buildReleaseReadinessReport exposes ARTIFACT-011 preflight release gate", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });

  assert.ok(report.quality_assurance.artifact_011_preflight);
  assert.equal(
    report.quality_assurance.artifact_011_preflight.posture,
    "preview_only_no_governed_node0_runtime",
  );
  assert.equal(
    report.quality_assurance.artifact_011_preflight
      .requires_operator_runtime_ready,
    false,
  );
  assert.ok(
    report.performance_qa.mechanisms.some(
      (m) => m.id === "artifact_011_ceremony_preflight_gate",
    ),
  );
  assert.ok(
    report.world_class_quality_gates.gates.some(
      (g) => g.id === "artifact_011_ceremony_preflight",
    ),
  );
  assert.equal(hasRisk(report, "artifact_011.preflight_script_missing"), false);
});

test("buildReleaseReadinessReport scores dependency and installer posture", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });

  assert.equal(report.dependency_management.runtime_dependencies, 0);
  assert.equal(report.dependency_management.dev_dependencies, 0);
  assert.equal(
    report.dependency_management.audit_policy.status,
    "not_applicable_zero_dependencies",
  );
  assert.equal(
    report.dependency_management.audit_policy.npm_audit_command,
    "skipped_no_dependencies",
  );
  assert.equal(report.dependency_management.audit_policy.lockfile_required, false);
  assert.equal(report.installer_artifacts.required.length, 5);
  assert.ok(
    report.installer_artifacts.required.every((artifact) => artifact.exists),
  );
  assert.ok(report.installer_artifacts.capabilities.includes("dry-run"));
  assert.ok(report.installer_artifacts.capabilities.includes("check"));
  assert.ok(
    report.installer_artifacts.capabilities.includes("uninstall-exact-consent"),
  );
});

test("release process promotes installer dry-run/check verification into the release candidate checklist", async () => {
  const doc = await readFile(join(repoRoot, "docs/RELEASE_PROCESS.md"), "utf8");

  assert.match(doc, /Installer candidate verification/);
  assert.ok(doc.includes("scripts/install/install.sh --dry-run"));
  assert.ok(doc.includes("scripts/install/install.sh --check"));
  assert.match(doc, /do not publish|does not publish|no deployment|no publish/);

  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });
  assert.equal(
    report.next_actions.some((action) =>
      action.includes("release candidate checklist"),
    ),
    false,
  );
  assert.ok(
    report.next_actions.some((action) =>
      action.includes("installer dry-run/check verification into CI"),
    ),
  );
});

test("buildReleaseReadinessReport keeps zero-dependency audit posture when npm install creates a transient lockfile", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "bizra-release-readiness-transient-lock-"),
  );
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "@bizra/dema-root", scripts: {} }),
    );
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify({ name: "@bizra/dema-root", lockfileVersion: 3 }) + "\n",
    );

    const report = await buildCleanReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });

    assert.equal(
      report.dependency_management.audit_policy.status,
      "not_applicable_zero_dependencies",
    );
    assert.equal(
      report.dependency_management.audit_policy.npm_audit_command,
      "skipped_no_dependencies",
    );
    assert.equal(report.dependency_management.audit_policy.lockfile_required, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildReleaseReadinessReport detects workflow action refs that are not SHA-pinned", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });
  const hasUnpinnedAction = report.ci.workflow.action_refs.some(
    (ref) => ref.pinned === false,
  );

  assert.equal(report.ci.workflow.path, ".github/workflows/check.yml");
  assert.ok(
    report.ci.workflow.scanned_paths.includes(".github/workflows/check.yml"),
  );
  assert.ok(
    report.ci.workflow.scanned_paths.includes(
      ".github/workflows/bizra-review.yml",
    ),
  );
  assert.ok(
    report.ci.workflow.scanned_paths.includes(".github/workflows/codeql.yml"),
  );
  assert.ok(report.ci.workflow.action_refs.length >= 7);
  assert.ok(
    report.ci.workflow.action_refs.every((ref) =>
      ref.workflow?.startsWith(".github/workflows/"),
    ),
  );
  assert.ok(
    report.ci.workflow.action_refs.every(
      (ref) => typeof ref.pinned === "boolean",
    ),
  );
  assert.equal(hasRisk(report, "ci.actions_not_sha_pinned"), hasUnpinnedAction);
});

test("workflow parsers detect pinned refs, Node matrix, events, and run commands", () => {
  const workflow = `
on:
  pull_request:
  push:
steps:
  - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567
  - uses: actions/setup-node@v4
  - run: npm test
  - run: npm run check
strategy:
  matrix:
    node-version: [20.x, 22.x]
`;

  assert.deepEqual(findActionRefs(workflow), [
    {
      ref: "actions/checkout@0123456789abcdef0123456789abcdef01234567",
      pinned: true,
    },
    { ref: "actions/setup-node@v4", pinned: false },
  ]);
  assert.deepEqual(findNodeMatrix(workflow), ["node-20.x", "node-22.x"]);
  assert.deepEqual(findWorkflowEvents(workflow), ["pull_request", "push"]);
  assert.deepEqual(findRunCommands(workflow), ["npm test", "npm run check"]);
});

test("workflow parser detects multiline run blocks under named steps", () => {
  const workflow = `
jobs:
  check:
    steps:
      - name: Install scanner
        run: |
          set -euo pipefail
          curl -fsSL https://example.invalid/tool.tgz -o tool.tgz
          sha256sum -c tool.tgz.sha256
      - name: Run gates
        run: |
          npm test
          npm run check
      - run: node scripts/release-readiness.mjs --json
`;

  assert.deepEqual(findRunCommands(workflow), [
    "set -euo pipefail",
    "curl -fsSL https://example.invalid/tool.tgz -o tool.tgz",
    "sha256sum -c tool.tgz.sha256",
    "npm test",
    "npm run check",
    "node scripts/release-readiness.mjs --json",
  ]);
});

test("workflow parsers fail closed on absent matrices and tolerate empty/commented run blocks", () => {
  const workflow = `
on:
  schedule:
  workflow_dispatch:
steps:
  - uses: local/action
  - run:
  - run: |

      # comment-only command
      npm test
  - name: next step
`;

  assert.deepEqual(findActionRefs(workflow), [
    { ref: "local/action", pinned: false },
  ]);
  assert.deepEqual(findNodeMatrix(workflow), []);
  assert.deepEqual(findRunCommands(workflow), ["npm test"]);
  assert.deepEqual(findRunCommands(null), []);
  assert.deepEqual(findWorkflowEvents(workflow), ["schedule", "workflow_dispatch"]);
  assert.deepEqual(parseWorkflowWorktreeChanges(null), []);
});
test("parseWorkflowWorktreeChanges extracts only workflow YAML changes", () => {
  const changes = parseWorkflowWorktreeChanges(`
 M .github/workflows/check.yml
?? .github/workflows/probe.yaml
R  .github/workflows/old.yml -> .github/workflows/new.yml
 M README.md
`);

  assert.deepEqual(changes, [
    { status: "M", path: ".github/workflows/check.yml" },
    { status: "??", path: ".github/workflows/probe.yaml" },
    { status: "R", path: ".github/workflows/new.yml" },
  ]);
});

test("buildReleaseReadinessReport flags dirty workflow files as an authorization gate", async () => {
  const report = await buildReleaseReadinessReport({
    now: fixedNow,
    workflowStatusText:
      " M .github/workflows/check.yml\n?? .github/workflows/probe.yaml\n M README.md\n",
  });

  assert.deepEqual(report.ci.workflow.worktree_changes, [
    { status: "M", path: ".github/workflows/check.yml" },
    { status: "??", path: ".github/workflows/probe.yaml" },
  ]);
  assert.equal(report.ci.workflow.worktree_status_available, true);
  assert.ok(
    report.risks.some(
      (risk) =>
        risk.code === "ci.workflow_worktree_modified_requires_authorization" &&
        risk.severity === "launch_blocker",
    ),
  );
  const cleanReport = await buildCleanReleaseReadinessReport({ now: fixedNow });
  assert.equal(report.readiness_score, cleanReport.readiness_score - 12);
});

test("buildReleaseReadinessReport accepts explicit workflow-change authorization", async () => {
  const report = await buildReleaseReadinessReport({
    now: fixedNow,
    workflowChangesAuthorized: true,
    workflowStatusText:
      " M .github/workflows/check.yml\n?? .github/workflows/probe.yaml\n",
  });

  assert.equal(report.ci.workflow.worktree_changes_authorized, true);
  assert.equal(
    hasRisk(report, "ci.workflow_worktree_modified_requires_authorization"),
    false,
  );
  const cleanReport = await buildCleanReleaseReadinessReport({ now: fixedNow });
  assert.equal(report.readiness_score, cleanReport.readiness_score);
});

test("buildReleaseReadinessReport reports missing primary workflow accurately", async () => {
  const scratchRoot = join(
    repoRoot,
    ".artifacts",
    "release-readiness-test-runs",
  );
  await mkdir(scratchRoot, { recursive: true });
  const root = await mkdtemp(join(scratchRoot, "dema-release-readiness-"));
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ scripts: {} }),
    );

    const report = await buildCleanReleaseReadinessReport({
      root,
      now: fixedNow,
    });

    assert.equal(report.ci.workflow.exists, false);
    assert.equal(report.ci.workflow.scanned_paths.length, 0);
    assert.equal(
      report.risks.some((risk) => risk.code === "ci.primary_workflow_missing"),
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(scratchRoot, { recursive: true, force: true });
  }
});

test("buildReleaseReadinessReport reports unavailable worktree status without a git checkout", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "bizra-release-readiness-no-git-"),
  );
  try {
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: {} }));

    const knownStatusReport = await buildReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });

    const report = await buildReleaseReadinessReport({
      root,
      now: fixedNow,
    });

    assert.equal(report.ci.workflow.worktree_status_available, false);
    assert.deepEqual(report.ci.workflow.worktree_changes, []);
    // SCORE-TEETH-1A: unavailable status is a launch_blocker on the report
    // itself — readiness_score must not stay falsely high without evidence.
    assert.equal(
      hasRisk(report, "ci.workflow_worktree_status_unavailable"),
      true,
    );
    assert.ok(
      report.readiness_score <= 88,
      `expected score penalty for unavailable worktree, got ${report.readiness_score}`,
    );
    assert.equal(
      report.readiness_score,
      knownStatusReport.readiness_score - 12,
    );
    const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reasons.join(" "), /worktree.*unavailable|launch_blocker/);

    // BIZRA-T0-RELEASE-READINESS-TRUTH-1A: human CLI must not say clean/not_required
    // when machine verdict fails closed on unavailable worktree status.
    const output = formatReleaseReadinessReport(report);
    assert.match(output, /workflow worktree: unknown/);
    assert.match(output, /workflow authorization: blocked/);
    assert.doesNotMatch(output, /workflow worktree: clean/);
    assert.doesNotMatch(output, /workflow authorization: not_required/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildReleaseReadinessReport handles a package without a scripts object", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "bizra-release-readiness-no-scripts-"),
  );
  try {
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "empty" }));

    const report = await buildReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });

    assert.equal(report.traceability.package_scripts.length, 0);
    assert.equal(
      report.performance_qa.mechanisms.find((m) => m.id === "zero_build_step")
        .status,
      "observed",
    );
    assert.equal(
      report.performance_qa.mechanisms.find(
        (m) => m.id === "bounded_cli_smoke_checks",
      ).status,
      "missing",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildReleaseReadinessReport keeps coverage advisory when the aggregate owner omits coverage", async () => {
  const scratchRoot = join(
    repoRoot,
    ".artifacts",
    "release-readiness-test-runs",
  );
  await mkdir(scratchRoot, { recursive: true });
  const root = await mkdtemp(join(scratchRoot, "dema-release-readiness-owner-"));
  try {
    await mkdir(join(root, ".github/workflows"), { recursive: true });
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        scripts: {
          check: "node scripts/check.mjs",
          coverage:
            "node --test --experimental-test-coverage --test-coverage-lines=95 --test-coverage-branches=84 --test-coverage-functions=95 tests/*.test.js",
        },
      }),
    );
    await writeFile(
      join(root, ".github/workflows/check.yml"),
      "on:\n  push:\njobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm run check\n",
    );
    await writeFile(join(root, "scripts/check.mjs"), "export function runChecks() {}\n");

    const report = await buildCleanReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });

    assert.equal(report.pipeline_automation.coverage_owner, null);
    assert.equal(report.quality_assurance.coverage_threshold.enforced, false);
    assert.equal(hasRisk(report, "qa.coverage_threshold_missing"), true);
    assert.equal(hasRisk(report, "ci.actions_not_sha_pinned"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(scratchRoot, { recursive: true, force: true });
  }
});

test("buildReleaseReadinessReport recognizes coverage owned by the aggregate check script", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "bizra-release-readiness-owner-positive-"),
  );
  try {
    await mkdir(join(root, ".github/workflows"), { recursive: true });
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        scripts: {
          check: "node scripts/check.mjs",
          coverage:
            "node --test --experimental-test-coverage --test-coverage-lines=95 --test-coverage-branches=84 --test-coverage-functions=95 tests/*.test.js",
        },
      }),
    );
    await writeFile(
      join(root, ".github/workflows/check.yml"),
      "on:\n  push:\njobs:\n  check:\n    steps:\n      - run: npm run check\n",
    );
    await writeFile(
      join(root, "scripts/check.mjs"),
      'const command = ["npm", ["run", "coverage"]];\n',
    );

    const report = await buildCleanReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });

    assert.equal(
      report.pipeline_automation.coverage_owner,
      "scripts/check.mjs via npm run check",
    );
    assert.equal(
      report.pipeline_automation.ci_gate_observations.find(
        (gate) => gate.command === "npm run coverage",
      ).observed_in_ci,
      true,
    );
    assert.equal(report.quality_assurance.coverage_threshold.enforced, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildReleaseReadinessReport distinguishes dependency lockfile states", async () => {
  const scratchRoot = join(
    repoRoot,
    ".artifacts",
    "release-readiness-test-runs",
  );
  await mkdir(scratchRoot, { recursive: true });
  const root = await mkdtemp(join(scratchRoot, "dema-release-readiness-deps-"));
  const packageJson = {
    scripts: {
      check: "node scripts/check.mjs",
      coverage:
        "node --test --experimental-test-coverage --test-coverage-lines=95 --test-coverage-branches=84 --test-coverage-functions=95 tests/*.test.js",
    },
    dependencies: { example: "1.0.0" },
  };
  try {
    await writeFile(join(root, "package.json"), JSON.stringify(packageJson));
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify({ lockfileVersion: 3, packages: {} }),
    );

    const locked = await buildCleanReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });
    assert.equal(
      locked.dependency_management.audit_policy.status,
      "auditable_lockfile_present",
    );
    assert.equal(locked.dependency_management.audit_policy.lockfile_required, true);

    await rm(join(root, "package-lock.json"));
    const unlocked = await buildCleanReleaseReadinessReport({
      root,
      now: fixedNow,
      workflowStatusText: "",
    });
    assert.equal(
      unlocked.dependency_management.audit_policy.status,
      "review_no_lockfile_with_dependencies",
    );
    assert.equal(
      unlocked.dependency_management.audit_policy.npm_audit_command,
      "blocked_requires_lockfile",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(scratchRoot, { recursive: true, force: true });
  }
});
test("buildReleaseReadinessReport models automation and quality gates without overclaiming", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });
  const gates = new Map(
    report.world_class_quality_gates.gates.map((gate) => [gate.id, gate]),
  );
  const dimensions = new Map(
    report.ci_cd_maturity.dimensions.map((item) => [item.id, item]),
  );

  assert.equal(
    report.pipeline_automation.deployment_automation,
    "not_configured_no_external_deploy",
  );
  assert.ok(report.pipeline_automation.workflows.length >= 3);
  assert.ok(
    report.pipeline_automation.workflows.every((workflow) =>
      workflow.path.startsWith(".github/workflows/"),
    ),
  );
  assert.equal(gates.get("behavior_tests").currently_enforced, true);
  assert.equal(gates.get("safety_static_checks").currently_enforced, true);
  assert.equal(gates.get("diff_hygiene").currently_enforced, false);
  assert.equal(
    report.quality_assurance.coverage_threshold.mode,
    "native_threshold_gate",
  );
  assert.equal(report.quality_assurance.coverage_threshold.configured, true);
  assert.equal(report.quality_assurance.coverage_threshold.enforced, true);
  assert.deepEqual(
    report.quality_assurance.coverage_threshold.thresholds,
    {
      lines: 95,
      branches: 84,
      functions: 95,
    },
  );
  assert.equal(
    report.quality_assurance.coverage_threshold.advisory_targets,
    null,
  );
  assert.equal(
    gates.get("coverage_threshold").currently_enforced,
    report.quality_assurance.coverage_threshold.enforced,
  );
  assert.equal(gates.get("coverage_threshold").mode, "native_threshold_gate");
  assert.deepEqual(gates.get("coverage_threshold").thresholds, {
    lines: 95,
    branches: 84,
    functions: 95,
  });
  assert.equal(gates.get("coverage_threshold").risk_code, null);
  assert.equal(hasRisk(report, "qa.coverage_threshold_missing"), false);
  assert.equal(
    dimensions.get("continuous_delivery").status,
    "not_configured_advisory",
  );
  assert.equal(
    hasRisk(report, "ci.workflow_worktree_modified_requires_authorization"),
    false,
  );
});

test("buildReleaseReadinessReport inventories performance QA and rollback controls", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });
  const mechanisms = new Map(
    report.performance_qa.mechanisms.map((item) => [item.id, item]),
  );
  const rollbackAreas = report.rollout_rollback.rollback.controls.map(
    (control) => control.area,
  );

  assert.equal(
    report.performance_qa.posture,
    "mechanism_inventory_not_performance_certification",
  );
  assert.equal(mechanisms.get("zero_runtime_dependencies").status, "observed");
  assert.equal(mechanisms.get("bounded_cli_smoke_checks").status, "observed");
  assert.equal(
    mechanisms.get("native_coverage_thresholds").status,
    "observed",
  );
  // A+ perf now enforced
  assert.equal(mechanisms.get("a_plus_perf_gate").status, "enforced");
  assert.ok(
    report.performance_qa.candidate_budgets.some(
      (budget) => budget.status === "enforced_a_plus",
    ),
  );
  assert.deepEqual(rollbackAreas, [
    "code",
    "installer",
    "local_state",
    "receipts",
  ]);
});

test("formatReleaseReadinessReport renders executive DevOps output", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });
  const output = formatReleaseReadinessReport(report);

  assert.match(output, /DEMA Release Readiness/);
  assert.match(output, /Management BoK/);
  assert.match(output, /CI\/CD/);
  assert.match(output, /Performance QA/);
  assert.match(output, /Dependency audit/);
  assert.match(output, /not_applicable_zero_dependencies/);
  assert.match(output, /World-class gate posture/);
  assert.match(output, /Rollout \/ rollback/);
  assert.match(output, /Traceability evidence/);
  assert.match(
    output,
    /Boundary: read-only audit; no deployment; no secrets accessed/,
  );
});

test("formatReleaseReadinessReport names dirty workflow changes", async () => {
  const report = await buildReleaseReadinessReport({
    now: fixedNow,
    workflowStatusText: " M .github/workflows/check.yml\n",
  });
  const output = formatReleaseReadinessReport(report);

  assert.match(output, /workflow worktree: dirty/);
  assert.match(output, /workflow authorization: required/);
  assert.match(output, /Workflow worktree changes:/);
  assert.match(output, /M .github\/workflows\/check\.yml/);
});

test("formatReleaseReadinessReport renders explicit workflow authorization", async () => {
  const report = await buildReleaseReadinessReport({
    now: fixedNow,
    workflowChangesAuthorized: true,
    workflowStatusText: " M .github/workflows/check.yml\n",
  });
  const output = formatReleaseReadinessReport(report);

  assert.match(output, /workflow worktree: dirty/);
  assert.match(output, /workflow authorization: explicit/);
});

test("formatReleaseReadinessReport: missing/false worktree status → unknown+blocked; true clean/dirty agree", async () => {
  const base = await buildCleanReleaseReadinessReport({ now: fixedNow });
  assert.equal(base.ci.workflow.worktree_status_available, true);

  const missing = structuredClone(base);
  delete missing.ci.workflow.worktree_status_available;
  missing.ci.workflow.worktree_changes = [];
  const missingOut = formatReleaseReadinessReport(missing);
  assert.match(missingOut, /workflow worktree: unknown/);
  assert.match(missingOut, /workflow authorization: blocked/);
  assert.doesNotMatch(missingOut, /workflow worktree: clean/);
  assert.equal(
    evaluateReleaseReadiness(missing, { minScore: 80 }).ok,
    false,
  );

  const unavailable = structuredClone(base);
  unavailable.ci.workflow.worktree_status_available = false;
  unavailable.ci.workflow.worktree_changes = [];
  const unavailableOut = formatReleaseReadinessReport(unavailable);
  assert.match(unavailableOut, /workflow worktree: unknown/);
  assert.match(unavailableOut, /workflow authorization: blocked/);
  assert.doesNotMatch(unavailableOut, /workflow worktree: clean/);
  assert.equal(
    evaluateReleaseReadiness(unavailable, { minScore: 80 }).ok,
    false,
  );

  const cleanOut = formatReleaseReadinessReport(base);
  assert.match(cleanOut, /workflow worktree: clean/);
  assert.match(cleanOut, /workflow authorization: not_required/);

  const dirty = await buildReleaseReadinessReport({
    now: fixedNow,
    workflowStatusText: " M .github/workflows/check.yml\n",
  });
  assert.equal(dirty.ci.workflow.worktree_status_available, true);
  const dirtyOut = formatReleaseReadinessReport(dirty);
  assert.match(dirtyOut, /workflow worktree: dirty/);
  assert.match(dirtyOut, /workflow authorization: required/);
});

test("formatReleaseReadinessReport: available true with malformed worktree_changes must not render clean", async () => {
  const base = await buildCleanReleaseReadinessReport({ now: fixedNow });
  assert.equal(base.ci.workflow.worktree_status_available, true);
  assert.ok(Array.isArray(base.ci.workflow.worktree_changes));

  for (const malformed of [undefined, null, "dirty", { path: "x" }, 1]) {
    const report = structuredClone(base);
    report.ci.workflow.worktree_status_available = true;
    report.ci.workflow.worktree_changes = malformed;
    const output = formatReleaseReadinessReport(report);
    assert.match(
      output,
      /workflow worktree: unknown/,
      `expected unknown for malformed changes=${JSON.stringify(malformed)}`,
    );
    assert.match(output, /workflow authorization: blocked/);
    assert.doesNotMatch(output, /workflow worktree: clean/);
    assert.doesNotMatch(output, /workflow authorization: not_required/);
  }
});

test("malformed worktree_changes: format, evaluate, and exit code agree blocked", async () => {
  const base = await buildCleanReleaseReadinessReport({ now: fixedNow });
  assert.equal(evaluateReleaseReadiness(base, { minScore: 80 }).ok, true);
  assert.equal(exitCodeFromEvaluation(evaluateReleaseReadiness(base)), 0);

  for (const malformed of [undefined, null, "dirty", { path: "x" }, 1]) {
    const report = structuredClone(base);
    report.ci.workflow.worktree_status_available = true;
    report.ci.workflow.worktree_changes = malformed;

    const output = formatReleaseReadinessReport(report);
    const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
    const exitCode = exitCodeFromEvaluation(verdict);

    assert.match(output, /workflow worktree: unknown/);
    assert.match(output, /workflow authorization: blocked/);
    assert.doesNotMatch(output, /workflow worktree: clean/);
    assert.equal(
      verdict.ok,
      false,
      `evaluate must fail for malformed changes=${JSON.stringify(malformed)}; reasons=${verdict.reasons}`,
    );
    assert.match(
      verdict.reasons.join(" "),
      /worktree_changes_malformed|worktree.*unavailable/,
    );
    assert.equal(exitCode, 1);
  }
});

// WORKFLOW-EVIDENCE-ADMISSION-1A — Array.isArray([null]) and unauthorized dirty
// rows with emptied risks[] must not evaluate ok (bizra-omni-auditor MEASURED).
test("release readiness rejects contradictory workflow evidence", () => {
  const report = {
    schema: "bizra.dema.release_readiness.v0.1",
    readiness_score: 100,
    risks: [],
    ci: {
      workflow: {
        worktree_status_available: true,
        worktree_changes: [],
        worktree_changes_authorized: false,
      },
    },
  };

  assert.equal(evaluateReleaseReadiness(report).ok, true);
  assert.equal(exitCodeFromEvaluation(evaluateReleaseReadiness(report)), 0);

  for (const changes of [
    [{ status: "M", path: ".github/workflows/check.yml" }],
    [null],
  ]) {
    const candidate = structuredClone(report);
    candidate.ci.workflow.worktree_changes = changes;
    const verdict = evaluateReleaseReadiness(candidate);
    assert.equal(
      verdict.ok,
      false,
      `expected reject for changes=${JSON.stringify(changes)}; reasons=${verdict.reasons}`,
    );
    assert.equal(exitCodeFromEvaluation(verdict), 1);
  }

  const authorizedDirty = structuredClone(report);
  authorizedDirty.ci.workflow.worktree_changes = [
    { status: "M", path: ".github/workflows/check.yml" },
  ];
  authorizedDirty.ci.workflow.worktree_changes_authorized = true;
  assert.equal(
    evaluateReleaseReadiness(authorizedDirty).ok,
    true,
    "authorized nonempty changes remain admitted when risks/score allow",
  );
});

test("formatReleaseReadinessReport renders sparse and missing evidence states", async () => {
  const report = await buildCleanReleaseReadinessReport({ now: fixedNow });
  report.ci.matrix = [];
  report.dependency_management.audit_policy.lockfile_required = true;
  report.installer_artifacts.required = [
    { path: "scripts/install/missing.sh", exists: false },
  ];
  report.installer_artifacts.capabilities = [];
  report.risks = [];
  report.next_actions = [];

  const output = formatReleaseReadinessReport(report);

  assert.match(output, /node matrix: $/m);
  assert.match(output, /lockfile required: yes/);
  assert.match(output, /missing: scripts\/install\/missing\.sh/);
  assert.match(output, /capabilities: none/);
});

test("release-readiness script supports --json", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--json"]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.release_readiness.v0.1");
  assert.equal(report.boundary.external_deploy_performed, false);
  assert.equal(
    report.pipeline_automation.deployment_automation,
    "not_configured_no_external_deploy",
  );
  assert.equal(
    typeof report.quality_assurance.coverage_threshold.enforced,
    "boolean",
  );
  assert.ok(
    report.pipeline.gates.some((gate) => gate.command === "npm run check"),
  );
});

test("release-readiness script supports explicit workflow authorization flag", async () => {
  const { stdout } = await execFileAsync("node", [
    scriptPath,
    "--json",
    "--ci-workflow-changes-authorized",
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.ci.workflow.worktree_changes_authorized, true);
  assert.equal(
    hasRisk(report, "ci.workflow_worktree_modified_requires_authorization"),
    false,
  );
});

// PROOF-GATE-TEETH-HARDENING-1A · defect 1
// The old delivery-check release gate (scripts/delivery-check.mjs:96) was
// tautological: it substring-matched the --json output for 'launch_blocker'
// and 'authorized'. Because the report ALWAYS contains the static key
// `worktree_changes_authorized` (substring 'authorized') and risk objects can
// carry the literal severity 'launch_blocker', the check could never fail.
// evaluateReleaseReadiness parses the report structurally and fails closed.
test("evaluateReleaseReadiness FAILS when a launch_blocker risk is present", () => {
  const report = {
    readiness_score: 100,
    risks: [{ code: "x.broken", severity: "launch_blocker" }],
    ci: { workflow: { worktree_changes_authorized: true } },
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.hasLaunchBlocker, true);
  assert.equal(verdict.ok, false);
});

test("evaluateReleaseReadiness PASSES a clean report with no blocker and score >= threshold", () => {
  const report = {
    schema: "bizra.dema.release_readiness.v0.1",
    readiness_score: 97,
    risks: [{ code: "x.minor", severity: "improvement" }],
    ci: {
      workflow: {
        worktree_status_available: true,
        worktree_changes: [],
        worktree_changes_authorized: true,
      },
    },
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.hasLaunchBlocker, false);
  assert.equal(verdict.ok, true);
});

test("evaluateReleaseReadiness FAILS closed when worktree_changes is malformed", () => {
  const report = {
    schema: "bizra.dema.release_readiness.v0.1",
    readiness_score: 100,
    risks: [],
    ci: {
      workflow: {
        worktree_status_available: true,
        worktree_changes: null,
      },
    },
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /worktree_changes_malformed/);
  assert.equal(exitCodeFromEvaluation(verdict), 1);
});

test("evaluateReleaseReadiness FAILS closed on a missing or unexpected report schema", () => {
  const report = {
    schema: "bizra.dema.other_report.v0.1",
    readiness_score: 100,
    risks: [],
    ci: { workflow: { worktree_status_available: true } },
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /schema/);
});

test("evaluateReleaseReadiness FAILS closed when workflow status was not inspected", () => {
  const report = {
    schema: "bizra.dema.release_readiness.v0.1",
    readiness_score: 100,
    risks: [],
    ci: { workflow: { worktree_status_available: false, worktree_changes: [] } },
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /worktree.*unavailable/);
});

test("evaluateReleaseReadiness FAILS closed when workflow status evidence is missing", () => {
  const report = {
    schema: "bizra.dema.release_readiness.v0.1",
    readiness_score: 100,
    risks: [],
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /worktree.*unavailable/);
});

test("evaluateReleaseReadiness FAILS closed on malformed risk entries", () => {
  const report = {
    schema: "bizra.dema.release_readiness.v0.1",
    readiness_score: 100,
    risks: [null],
    ci: { workflow: { worktree_status_available: true } },
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /malformed_report_risks_entry/);
});

test("evaluateReleaseReadiness FAILS closed on a malformed report (no risks array)", () => {
  const verdict = evaluateReleaseReadiness({ readiness_score: 100 }, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /risks/);
});

test("evaluateReleaseReadiness FAILS closed on a non-object report", () => {
  const verdict = evaluateReleaseReadiness(null, { minScore: 80 });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /not_object/);
});
test("evaluateReleaseReadiness FAILS when readiness_score is below the configured threshold", () => {
  const report = {
    readiness_score: 50,
    risks: [{ code: "x.minor", severity: "review" }],
  };
  const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
  assert.equal(verdict.hasLaunchBlocker, false);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(" "), /readiness_score/);
});

test("extractReportJson recovers the report object even with leading log noise", () => {
  const noisy = "> dema@ release:readiness\n" + JSON.stringify({ readiness_score: 97, risks: [] }) + "\n";
  const parsed = extractReportJson(noisy);
  assert.equal(parsed.readiness_score, 97);
  assert.equal(extractReportJson("no json here"), null);
  assert.equal(extractReportJson('{"broken":}'), null);
});

// CLI-EXIT-TEETH-1A — shell gate must mirror evaluateReleaseReadiness, not always 0.
test("exitCodeFromEvaluation fails closed on malformed evaluation", () => {
  assert.equal(exitCodeFromEvaluation(null), 1);
  assert.equal(exitCodeFromEvaluation(undefined), 1);
  assert.equal(exitCodeFromEvaluation({}), 1);
  assert.equal(exitCodeFromEvaluation({ ok: "yes" }), 1);
  assert.equal(exitCodeFromEvaluation([{ ok: true }]), 1);
  assert.equal(exitCodeFromEvaluation({ ok: true }), 0);
  assert.equal(exitCodeFromEvaluation({ ok: false, reasons: ["x"] }), 1);
});

test("exitCodeFromEvaluation is 1 when unavailable worktree evaluate fails", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "bizra-release-readiness-cli-exit-"),
  );
  try {
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: {} }));
    const report = await buildReleaseReadinessReport({ root, now: fixedNow });
    const verdict = evaluateReleaseReadiness(report, { minScore: 80 });
    assert.equal(verdict.ok, false);
    assert.equal(exitCodeFromEvaluation(verdict), 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release-readiness CLI exit code mirrors evaluateReleaseReadiness on --json", async () => {
  let stdout = "";
  let code = 0;
  try {
    const result = await execFileAsync("node", [scriptPath, "--json"]);
    stdout = result.stdout;
  } catch (error) {
    code = error.code;
    stdout = error.stdout ?? "";
  }
  const report = extractReportJson(stdout);
  assert.ok(report, "CLI must still print a parseable report when blocked");
  const verdict = evaluateReleaseReadiness(report);
  assert.equal(code, exitCodeFromEvaluation(verdict));
});
