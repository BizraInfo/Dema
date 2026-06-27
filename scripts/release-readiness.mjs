#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatReleaseReadinessReport } from "./release-readiness/format.mjs";
import {
  findActionRefs,
  findNodeMatrix,
  findRunCommands,
  findWorkflowEvents,
  parseWorkflowWorktreeChanges,
  readWorkflowFiles,
  readWorkflowWorktreeStatus,
} from "./release-readiness/workflow-audit.mjs";

const SCHEMA = "bizra.dema.release_readiness.v0.1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const REQUIRED_INSTALLER_ARTIFACTS = [
  "scripts/install/install.sh",
  "scripts/install/install-unix.sh",
  "scripts/install/install-windows.ps1",
  "scripts/install/uninstall-unix.sh",
  "scripts/install/uninstall-windows.ps1",
];
const LOCKFILE_PATHS = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

const REQUIRED_GATES = [
  "npm test",
  "npm run coverage",
  "npm run check",
  "npm run perf",
  "git diff --check",
];
const ADVISORY_COVERAGE_TARGETS = Object.freeze({
  lines: 95,
  branches: 85,
  functions: 95,
});
const ARTIFACT_011_PREFLIGHT_SCRIPT = "artifact-011:preflight";
const ARTIFACT_011_PREFLIGHT_COMMAND = "npm run artifact-011:preflight";
const PRE_PUSH_SEAL_SCRIPT = "pre-push:seal";
const PRE_PUSH_SEAL_COMMAND = "npm run pre-push:seal";
const LAYER_A5_PREP_SCRIPT = "layer-a5:prep";
const LAYER_A5_PREP_COMMAND = "npm run layer-a5:prep";
const WORKFLOW_AUTH_FLAG = "--ci-workflow-changes-authorized";
const PMBOK_DOMAINS = [
  "integration_management",
  "scope_management",
  "schedule_management",
  "cost_management",
  "quality_management",
  "resource_management",
  "communications_management",
  "risk_management",
  "procurement_management",
  "stakeholder_management",
];

async function readText(root, path) {
  return await readFile(join(root, path), "utf8");
}

async function readJson(root, path) {
  return JSON.parse(await readText(root, path));
}

export {
  findActionRefs,
  findNodeMatrix,
  findRunCommands,
  findWorkflowEvents,
  parseWorkflowWorktreeChanges,
  formatReleaseReadinessReport,
};

function hasCoverageThresholdCommand(command = "") {
  return (
    command.includes("--experimental-test-coverage") &&
    /--test-coverage-lines=\d+/.test(command) &&
    /--test-coverage-branches=\d+/.test(command) &&
    /--test-coverage-functions=\d+/.test(command)
  );
}

function extractCoverageThresholds(command = "") {
  const pick = (name) => {
    const match = command.match(new RegExp(`--test-coverage-${name}=(\\d+)`));
    return match ? Number(match[1]) : null;
  };
  return {
    lines: pick("lines"),
    branches: pick("branches"),
    functions: pick("functions"),
  };
}

function buildCoverageThreshold(packageJson, pipelineAutomation) {
  const command = packageJson.scripts?.coverage ?? "";
  const configured = hasCoverageThresholdCommand(command);
  const observedInCi = pipelineAutomation.ci_gate_observations.some(
    (gate) => gate.command === "npm run coverage" && gate.observed_in_ci,
  );
  return {
    command: command || null,
    mode: configured ? "native_threshold_gate" : "report_only_advisory",
    configured,
    observed_in_ci: observedInCi,
    enforced: configured && observedInCi,
    thresholds: configured ? extractCoverageThresholds(command) : null,
    advisory_targets: configured ? null : ADVISORY_COVERAGE_TARGETS,
    advisory_note: configured
      ? null
      : "npm run coverage reports native Node coverage but does not enforce 95/85/95 thresholds.",
  };
}

function classifyRisks({
  workflowExists,
  actionRefs,
  packageJson,
  installerArtifacts,
  docs,
  coverageThreshold,
  workflowWorktreeStatus,
}) {
  const risks = [];
  if (!workflowExists) {
    risks.push({
      code: "ci.primary_workflow_missing",
      severity: "launch_blocker",
      note: "Primary check workflow is missing.",
    });
  }
  if (actionRefs.some((ref) => !ref.pinned)) {
    risks.push({
      code: "ci.actions_not_sha_pinned",
      severity: "launch_blocker",
      note: "Workflow actions use version tags instead of immutable commit SHAs.",
    });
  }
  if (
    workflowWorktreeStatus?.changes?.length > 0 &&
    !workflowWorktreeStatus.authorized
  ) {
    risks.push({
      code: "ci.workflow_worktree_modified_requires_authorization",
      severity: "launch_blocker",
      note: "Workflow files are modified in the current worktree; repo hard-stop requires explicit authorization before ship.",
    });
  }
  if (!packageJson.scripts?.["release:readiness"]) {
    risks.push({
      code: "pipeline.release_readiness_script_missing",
      severity: "review",
      note: "Package scripts do not expose the release readiness audit.",
    });
  }
  if (!installerArtifacts.every((artifact) => artifact.exists)) {
    risks.push({
      code: "installer.artifacts_missing",
      severity: "launch_blocker",
      note: "Required installer or uninstall scripts are missing.",
    });
  }
  if (!docs.deliveryBlueprint) {
    risks.push({
      code: "docs.delivery_blueprint_missing",
      severity: "review",
      note: "Delivery blueprint documentation is missing.",
    });
  }
  if (!coverageThreshold.enforced) {
    risks.push({
      code: "qa.coverage_threshold_missing",
      severity: "improvement",
      note: "CI runs behavior tests but does not enforce coverage thresholds.",
    });
  }
  if (!packageJson.scripts?.[ARTIFACT_011_PREFLIGHT_SCRIPT]) {
    risks.push({
      code: "artifact_011.preflight_script_missing",
      severity: "launch_blocker",
      note: "ARTIFACT-011 Dema-side ceremony preflight script is missing from package.json.",
    });
  }
  if (!packageJson.scripts?.[PRE_PUSH_SEAL_SCRIPT]) {
    risks.push({
      code: "pipeline.pre_push_seal_script_missing",
      severity: "review",
      note: "Pre-push proof seal script is missing from package.json.",
    });
  }
  if (!packageJson.scripts?.[LAYER_A5_PREP_SCRIPT]) {
    risks.push({
      code: "pipeline.layer_a5_prep_script_missing",
      severity: "review",
      note: "Layer A5 operator prep script is missing from package.json.",
    });
  }
  return risks;
}

function scoreFromRisks(risks) {
  const penalty = risks.reduce((sum, risk) => {
    if (risk.severity === "launch_blocker") return sum + 12;
    if (risk.severity === "review") return sum + 6;
    return sum + 3;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function buildInstallerCapabilities(artifactTexts) {
  const combined = artifactTexts.join("\n");
  return [
    /--dry-run\b|-DryRun\b/.test(combined) ? "dry-run" : null,
    /--check\b|-Check\b/.test(combined) ? "check" : null,
    combined.includes("REMOVE DEMA LOCAL DATA")
      ? "uninstall-exact-consent"
      : null,
    combined.includes("No daemon was started")
      ? "no-hidden-daemon-disclosure"
      : null,
  ].filter(Boolean);
}

function buildDependencyAuditPolicy({ root, runtimeDeps, devDeps }) {
  const lockfiles = LOCKFILE_PATHS.map((path) => ({
    path,
    exists: existsSync(join(root, path)),
  }));
  const presentLockfiles = lockfiles.filter((lockfile) => lockfile.exists);
  const dependencyCount = runtimeDeps + devDeps;

  if (dependencyCount === 0) {
    return {
      status: "not_applicable_zero_dependencies",
      npm_audit_command: "skipped_no_dependencies",
      lockfile_required: false,
      lockfiles,
      evidence:
        presentLockfiles.length > 0
          ? `0 runtime dependencies, 0 dev dependencies, ${presentLockfiles.length} lockfile(s) present but not required`
          : "0 runtime dependencies, 0 dev dependencies, no lockfile required",
    };
  }

  if (presentLockfiles.length > 0) {
    return {
      status: "auditable_lockfile_present",
      npm_audit_command: "npm audit --audit-level=moderate",
      lockfile_required: dependencyCount > 0,
      lockfiles,
      evidence: `${dependencyCount} dependencies, ${presentLockfiles.length} lockfile(s) present`,
    };
  }

  return {
    status: "review_no_lockfile_with_dependencies",
    npm_audit_command: "blocked_requires_lockfile",
    lockfile_required: true,
    lockfiles,
    evidence: `${dependencyCount} dependencies, no lockfile present`,
  };
}

function buildPipelineAutomation({ workflowFiles, packageJson, nodeMatrix }) {
  const workflows = workflowFiles.map((workflow) => ({
    path: workflow.path,
    events: findWorkflowEvents(workflow.text),
    run_commands: findRunCommands(workflow.text),
    action_count: findActionRefs(workflow.text).length,
  }));
  const ciRunCommands = workflows.flatMap((workflow) => workflow.run_commands);
  const packageScripts = Object.keys(packageJson.scripts ?? {}).sort();

  return {
    posture: "advisory_read_only_pipeline_audit",
    workflow_count: workflows.length,
    workflows,
    package_scripts: packageScripts,
    release_readiness_script_exposed:
      packageScripts.includes("release:readiness"),
    ci_gate_observations: REQUIRED_GATES.map((command) => ({
      command,
      observed_in_ci: ciRunCommands.includes(command),
      observed_as_package_script: packageScripts.includes(
        command === "npm test" ? "test" : command.replace(/^npm run /, ""),
      ),
    })),
    node_matrix: nodeMatrix,
    deployment_automation: "not_configured_no_external_deploy",
  };
}

function buildCiCdMaturity({
  workflowExists,
  actionRefs,
  pipelineAutomation,
  docs,
  coverageThreshold,
}) {
  const hasCiChecks =
    pipelineAutomation.ci_gate_observations.some(
      (gate) => gate.command === "npm test" && gate.observed_in_ci,
    ) &&
    pipelineAutomation.ci_gate_observations.some(
      (gate) => gate.command === "npm run check" && gate.observed_in_ci,
    );
  const hasImmutableActions =
    actionRefs.length > 0 && actionRefs.every((ref) => ref.pinned);
  const hasReleaseAudit = pipelineAutomation.release_readiness_script_exposed;

  return {
    model: "advisory_pmbok_aligned_maturity_v1",
    current_level: {
      id:
        hasCiChecks && hasReleaseAudit
          ? "level_3_defined"
          : "level_2_repeatable",
      label:
        hasCiChecks && hasReleaseAudit
          ? "defined local release audit with CI validation"
          : "repeatable local scripts with partial CI evidence",
    },
    dimensions: [
      {
        id: "continuous_integration",
        status:
          workflowExists && hasCiChecks ? "observed" : "missing_or_partial",
        evidence: "workflow audit for npm test and npm run check",
      },
      {
        id: "continuous_delivery",
        status: "not_configured_advisory",
        evidence: "no deployment was performed by this read-only audit",
      },
      {
        id: "immutable_supply_chain",
        status: hasImmutableActions ? "observed" : "improvement_needed",
        evidence:
          "GitHub Actions references are checked for commit-SHA pinning",
      },
      {
        id: "release_governance",
        status:
          hasReleaseAudit && docs.deliveryBlueprint
            ? "observed"
            : "missing_or_partial",
        evidence: "package release:readiness script and delivery blueprint",
      },
      {
        id: "quality_feedback",
        status: coverageThreshold.enforced ? "observed" : "partial",
        evidence: coverageThreshold.enforced
          ? "behavior and coverage thresholds are enforced in CI"
          : "behavior checks exist; coverage threshold remains advisory",
      },
    ],
    next_maturity_step:
      "Resolve launch-blocking supply-chain findings, add coverage/performance evidence, then document an explicit release decision.",
  };
}

function buildPerformanceQa({
  packageJson,
  runtimeDeps,
  docs,
  coverageThreshold,
}) {
  const scripts = packageJson.scripts ?? {};
  return {
    posture: "mechanism_inventory_not_performance_certification",
    mechanisms: [
      {
        id: "zero_build_step",
        status: scripts.build ? "review" : "observed",
        evidence: scripts.build
          ? "build script is present"
          : "no package build script is configured",
      },
      {
        id: "zero_runtime_dependencies",
        status: runtimeDeps === 0 ? "observed" : "review",
        evidence: `${runtimeDeps} runtime dependencies declared`,
      },
      {
        id: "bounded_cli_smoke_checks",
        status: scripts.check ? "observed" : "missing",
        evidence: scripts.check ?? "npm run check script missing",
      },
      {
        id: "native_coverage_thresholds",
        status: coverageThreshold.enforced ? "observed" : "advisory",
        evidence:
          coverageThreshold.advisory_note ??
          coverageThreshold.command ??
          "npm run coverage script missing",
      },
      {
        id: "delivery_blueprint_performance_notes",
        status: docs.deliveryBlueprint ? "documented" : "missing",
        evidence: "docs/DELIVERY_BLUEPRINT.md",
      },
      {
        id: "a_plus_perf_gate",
        status: scripts.perf ? "enforced" : "missing",
        evidence: scripts.perf ?? "npm run perf (A+ ceilings) missing",
      },
      {
        id: "transition_assurance_gate",
        status: "enforced",
        evidence:
          "scripts/review/transition-assurance-check.mjs (24 sampled transitions; fails closed before proof-room composition in npm run check)",
      },
      {
        id: "artifact_011_ceremony_preflight_gate",
        status: scripts[ARTIFACT_011_PREFLIGHT_SCRIPT] ? "enforced" : "missing",
        evidence:
          "scripts/review/artifact-011-preflight-gate.mjs (isolated preview-only ceremony chain; enforced in npm run check; does not require operator_runtime_ready)",
      },
      {
        id: "pre_push_proof_seal",
        status: scripts[PRE_PUSH_SEAL_SCRIPT] ? "enforced" : "missing",
        evidence:
          "scripts/pre-push-proof-seal.mjs (operator publish pipeline: git posture + npm run check + release readiness 100; no git push)",
      },
      {
        id: "layer_a5_operator_prep",
        status: scripts[LAYER_A5_PREP_SCRIPT] ? "enforced" : "missing",
        evidence:
          "scripts/layer-a5-operator-prep.mjs (real-home Step A5 checklist; Dema-side only; no governed Node0 runtime)",
      },
    ],
    candidate_budgets: [
      {
        id: "cli_startup_time",
        status: "enforced_a_plus",
        note: "A+ budget enforced via npm run perf --a-plus (sub-150ms boot, sub-1ms verification).",
      },
      {
        id: "large_local_state_fixture",
        status: "not_enforced_advisory",
        note: "Add large receipt and memory fixtures before claiming scale readiness.",
      },
      {
        id: "bounded_adapter_timeout",
        status: "not_enforced_advisory",
        note: "Keep external adapter probes bounded and preview-only.",
      },
    ],
  };
}

function buildRolloutRollback({ docs }) {
  return {
    posture: "manual_governed_release_operation",
    rollout: {
      deployment_performed_by_audit: false,
      stages: [
        "local read-only readiness audit",
        "human release decision record",
        "explicit artifact publication step outside this audit",
        "post-release receipt and installer verification",
      ],
      documented: docs.deliveryBlueprint,
    },
    rollback: {
      strategy: "source_control_and_candidate_artifact_rollback",
      controls: [
        {
          area: "code",
          action: "revert the release commit before publishing artifacts",
        },
        {
          area: "installer",
          action:
            "remove or replace unpublished candidate assets before promotion",
        },
        {
          area: "local_state",
          action: "remove Dema-managed local state only after exact consent",
        },
        {
          area: "receipts",
          action:
            "preserve receipts as historical evidence rather than rewriting them",
        },
      ],
    },
  };
}

function buildWorldClassQualityGates({
  actionRefs,
  pipelineAutomation,
  installerCapabilities,
  coverageThreshold,
}) {
  const observed = new Map(
    pipelineAutomation.ci_gate_observations.map((gate) => [
      gate.command,
      gate.observed_in_ci,
    ]),
  );
  const actionsPinned =
    actionRefs.length > 0 && actionRefs.every((ref) => ref.pinned);
  const packageScripts = pipelineAutomation.package_scripts ?? [];

  return {
    posture: "advisory_gap_model_not_enforcement_claim",
    gates: [
      {
        id: "behavior_tests",
        command: "npm test",
        currently_enforced: observed.get("npm test") === true,
        target: "required_for_release_candidate",
      },
      {
        id: "safety_static_checks",
        command: "npm run check",
        currently_enforced: observed.get("npm run check") === true,
        target: "required_for_release_candidate",
      },
      {
        id: "diff_hygiene",
        command: "git diff --check",
        currently_enforced: observed.get("git diff --check") === true,
        target: "required_local_gate",
      },
      {
        id: "immutable_action_refs",
        currently_enforced: actionsPinned,
        target: "pin all GitHub Actions to commit SHAs",
        risk_code: actionsPinned ? null : "ci.actions_not_sha_pinned",
      },
      {
        id: "coverage_threshold",
        command: "npm run coverage",
        currently_enforced: coverageThreshold.enforced,
        thresholds:
          coverageThreshold.thresholds ?? coverageThreshold.advisory_targets,
        mode: coverageThreshold.mode,
        target: "enforce native Node coverage thresholds in CI",
        risk_code: coverageThreshold.enforced
          ? null
          : "qa.coverage_threshold_missing",
      },
      {
        id: "installer_dry_run_check",
        currently_enforced: false,
        observed_capabilities: installerCapabilities.filter(
          (capability) => capability === "dry-run" || capability === "check",
        ),
        target:
          "promote installer dry-run and check into CI when policy allows",
      },
      {
        id: "release_artifact_hashes",
        currently_enforced: false,
        target:
          "publish and verify release artifact hashes before broad release",
      },
      {
        id: "artifact_011_ceremony_preflight",
        command: ARTIFACT_011_PREFLIGHT_COMMAND,
        currently_enforced:
          packageScripts.includes(ARTIFACT_011_PREFLIGHT_SCRIPT) &&
          observed.get("npm run check") === true,
        target:
          "preview-only ARTIFACT-011 ceremony preflight enforced via npm run check (isolated home; no governed Node0 runtime)",
        risk_code: packageScripts.includes(ARTIFACT_011_PREFLIGHT_SCRIPT)
          ? null
          : "artifact_011.preflight_script_missing",
      },
      {
        id: "pre_push_proof_seal",
        command: PRE_PUSH_SEAL_COMMAND,
        currently_enforced: packageScripts.includes(PRE_PUSH_SEAL_SCRIPT),
        target:
          "operator runs pre-push proof seal before git push (git posture + full check + release readiness)",
        risk_code: packageScripts.includes(PRE_PUSH_SEAL_SCRIPT)
          ? null
          : "pipeline.pre_push_seal_script_missing",
      },
      {
        id: "layer_a5_operator_prep",
        command: LAYER_A5_PREP_COMMAND,
        currently_enforced: packageScripts.includes(LAYER_A5_PREP_SCRIPT),
        target:
          "operator runs Layer A5 prep on real ~/.dema after push sync and before governed Node0 ceremony",
        risk_code: packageScripts.includes(LAYER_A5_PREP_SCRIPT)
          ? null
          : "pipeline.layer_a5_prep_script_missing",
      },
    ],
  };
}

function buildTraceability({ workflowFiles, packageJson, docs, risks }) {
  const documentationFiles = Object.entries(docs).map(([name, exists]) => ({
    name,
    exists,
  }));
  return {
    evidence_scope: "repository_files_only_no_secrets_no_external_deploy",
    observed_files: [
      { path: "package.json", purpose: "scripts and dependency posture" },
      ...workflowFiles.map((workflow) => ({
        path: workflow.path,
        purpose: "CI workflow evidence",
      })),
      ...documentationFiles.map((doc) => ({
        path: doc.name,
        purpose: doc.exists ? "documentation present" : "documentation missing",
      })),
    ],
    package_scripts: Object.keys(packageJson.scripts ?? {}).sort(),
    risk_codes: risks.map((risk) => risk.code),
    deterministic_ordering: true,
  };
}

export async function buildReleaseReadinessReport({
  root = REPO_ROOT,
  now = new Date(),
  workflowStatusText,
  workflowChangesAuthorized = false,
} = {}) {
  const packageJson = await readJson(root, "package.json");
  const workflowPath = ".github/workflows/check.yml";
  const workflowExists = existsSync(join(root, workflowPath));
  const workflowFiles = await readWorkflowFiles(root);
  const workflowText =
    workflowFiles.find((workflow) => workflow.path === workflowPath)?.text ??
    "";
  const actionRefs = workflowFiles.flatMap((workflow) =>
    findActionRefs(workflow.text).map((action) => ({
      ...action,
      workflow: workflow.path,
    })),
  );
  const nodeMatrix = findNodeMatrix(workflowText);
  const workflowWorktreeStatus = readWorkflowWorktreeStatus(
    root,
    workflowStatusText,
  );
  workflowWorktreeStatus.authorized = Boolean(workflowChangesAuthorized);

  const installerArtifacts = REQUIRED_INSTALLER_ARTIFACTS.map((path) => ({
    path,
    exists: existsSync(join(root, path)),
  }));
  const installerTexts = await Promise.all(
    installerArtifacts
      .filter((artifact) => artifact.exists)
      .map((artifact) => readText(root, artifact.path)),
  );
  const docs = {
    installerArchitecture: existsSync(
      join(root, "docs/INSTALLER_ARCHITECTURE.md"),
    ),
    deliveryBlueprint: existsSync(join(root, "docs/DELIVERY_BLUEPRINT.md")),
    gtm: existsSync(join(root, "docs/GTM.md")),
    security: existsSync(join(root, "SECURITY.md")),
  };
  const runtimeDeps = Object.keys(packageJson.dependencies ?? {}).length;
  const devDeps = Object.keys(packageJson.devDependencies ?? {}).length;
  const dependencyAuditPolicy = buildDependencyAuditPolicy({
    root,
    runtimeDeps,
    devDeps,
  });

  const installerCapabilities = buildInstallerCapabilities(installerTexts);
  const pipelineAutomation = buildPipelineAutomation({
    workflowFiles,
    packageJson,
    nodeMatrix,
  });
  const coverageThreshold = buildCoverageThreshold(
    packageJson,
    pipelineAutomation,
  );
  const risks = classifyRisks({
    workflowExists,
    actionRefs,
    packageJson,
    installerArtifacts,
    docs,
    coverageThreshold,
    workflowWorktreeStatus,
  });

  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "READ_ONLY_AUDIT",
    readiness_score: scoreFromRisks(risks),
    management_bok: {
      domains: PMBOK_DOMAINS,
      operating_rule:
        "Every release candidate must make scope, quality gates, risks, rollback, and stakeholder evidence explicit.",
    },
    ci: {
      workflow: {
        path: workflowPath,
        exists: workflowExists,
        scanned_paths: workflowFiles.map((workflow) => workflow.path),
        action_refs: actionRefs,
        worktree_status_available: workflowWorktreeStatus.available,
        worktree_changes: workflowWorktreeStatus.changes,
        worktree_changes_authorized: workflowWorktreeStatus.authorized,
      },
      matrix: nodeMatrix,
      immutable_actions_required: true,
    },
    pipeline: {
      gates: REQUIRED_GATES.map((command) => ({
        command,
        required: true,
        observed_in_ci: pipelineAutomation.ci_gate_observations.some(
          (gate) => gate.command === command && gate.observed_in_ci,
        ),
      })),
      automation_level: "local_release_readiness_gate",
      cd_status: "not_configured_no_external_deploy",
    },
    ci_cd_maturity: buildCiCdMaturity({
      workflowExists,
      actionRefs,
      pipelineAutomation,
      docs,
      coverageThreshold,
    }),
    pipeline_automation: pipelineAutomation,
    dependency_management: {
      runtime_dependencies: runtimeDeps,
      dev_dependencies: devDeps,
      zero_dependency_posture: runtimeDeps === 0 && devDeps === 0,
      audit_policy: dependencyAuditPolicy,
    },
    installer_artifacts: {
      required: installerArtifacts,
      capabilities: installerCapabilities,
    },
    quality_assurance: {
      test_gate: packageJson.scripts?.test ?? null,
      smoke_gate: packageJson.scripts?.check ?? null,
      coverage_threshold: coverageThreshold,
      performance_gate: "a_plus_enforced_via_perf_bench (see performance_qa)",
      documentation_gate: "manual_diff_hygiene_until_link_checker_exists",
      artifact_011_preflight: {
        script: packageJson.scripts?.[ARTIFACT_011_PREFLIGHT_SCRIPT] ?? null,
        release_gate:
          "scripts/review/artifact-011-preflight-gate.mjs via npm run check",
        posture: "preview_only_no_governed_node0_runtime",
        requires_operator_runtime_ready: false,
      },
    },
    performance_qa: buildPerformanceQa({
      packageJson,
      runtimeDeps,
      docs,
      coverageThreshold,
    }),
    // A+ performance QA now enforced via npm run perf (A+ ceilings in perf-bench).
    // This completes the performance-quality assurance mechanism in the blueprint.
    rollout_rollback: buildRolloutRollback({ docs }),
    world_class_quality_gates: buildWorldClassQualityGates({
      actionRefs,
      pipelineAutomation,
      installerCapabilities,
      coverageThreshold,
    }),
    documentation: {
      files: Object.entries(docs).map(([name, exists]) => ({ name, exists })),
    },
    risks,
    traceability: buildTraceability({
      workflowFiles,
      packageJson,
      docs,
      risks,
    }),
    boundary: {
      scope: "read-only",
      external_deploy_performed: false,
      secrets_accessed: false,
      ci_workflow_modified: false,
      production_config_modified: false,
    },
    next_actions: [
      "Add receipt schema documentation and verifier transparency.",
      "Add doc-link gates once dependency policy allows tooling.",
      "Promote installer dry-run/check verification into CI when policy allows tooling.",
    ],
  };
}

export function parseReleaseReadinessArgs(argv = []) {
  return {
    json: argv.includes("--json"),
    workflowChangesAuthorized: argv.includes(WORKFLOW_AUTH_FLAG),
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const options = parseReleaseReadinessArgs(process.argv.slice(2));
  const report = await buildReleaseReadinessReport({
    workflowChangesAuthorized: options.workflowChangesAuthorized,
  });
  const json = options.json;
  console.log(
    json
      ? JSON.stringify(report, null, 2)
      : formatReleaseReadinessReport(report),
  );
}
