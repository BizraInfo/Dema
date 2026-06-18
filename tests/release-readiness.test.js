import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    "skipped_no_lockfile_required",
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
    gates.get("coverage_threshold").currently_enforced,
    report.quality_assurance.coverage_threshold.enforced,
  );
  if (report.quality_assurance.coverage_threshold.configured) {
    assert.deepEqual(gates.get("coverage_threshold").thresholds, {
      lines: 95,
      branches: 85,
      functions: 95,
    });
  }
  assert.equal(
    gates.get("coverage_threshold").risk_code,
    report.quality_assurance.coverage_threshold.enforced
      ? null
      : "qa.coverage_threshold_missing",
  );
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
    report.quality_assurance.coverage_threshold.enforced
      ? "observed"
      : "missing",
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

  assert.match(output, /workflow authorization: explicit/);
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
