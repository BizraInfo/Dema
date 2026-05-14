#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const REQUIRED_SCRIPTS = ["test", "check"];
const REQUIRED_NODE_MATRIX = ["20.x", "22.x"];
const REQUIRED_REVIEW_SCRIPTS = [
  "scripts/review/pr-class.mjs",
  "scripts/review/proof-scope.mjs",
  "scripts/review/no-overclaim.mjs",
  "scripts/review/receipt-integrity.mjs"
];
const EXPECTED_INSTALLER_ARTIFACTS = [
  "scripts/install/install-unix.sh",
  "scripts/install/install-windows.ps1",
  "scripts/install/uninstall-unix.sh",
  "scripts/install/uninstall-windows.ps1"
];

async function readText(root, relativePath, required = true) {
  try {
    return await readFile(join(root, relativePath), "utf8");
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

async function readJson(root, relativePath) {
  return JSON.parse(await readText(root, relativePath));
}

export function findActionRefs(workflowText) {
  return [...workflowText.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
}

export function isPinnedActionRef(ref) {
  return /@[0-9a-f]{40}$/i.test(ref);
}

export function findNodeMatrix(workflowText) {
  const inline = workflowText.match(/node-version:\s*\[([^\]]+)\]/);
  if (inline) {
    return inline[1].split(",").map((value) => value.trim()).filter(Boolean);
  }

  const block = workflowText.match(/node-version:\s*\n((?:\s+-\s*.+\n?)+)/);
  if (!block) return [];
  return block[1]
    .split("\n")
    .map((line) => line.match(/-\s*(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function risk(code, severity, message, evidence = {}) {
  return { code, severity, message, evidence };
}

function scoreFromRisks(risks) {
  const penalty = risks.reduce((sum, item) => {
    if (item.severity === "fail") return sum + 35;
    if (item.severity === "review") return sum + 8;
    return sum + 4;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function scoreBand(score, gateOk) {
  if (!gateOk) return "not_ready";
  if (score >= 90) return "ready_with_advisories";
  if (score >= 70) return "conditional";
  return "needs_work";
}

function installerCapabilities(text) {
  if (!text) return [];
  const capabilities = [];
  if (text.includes("--dry-run")) capabilities.push("dry-run");
  if (text.includes("--check")) capabilities.push("check");
  if (text.includes("No daemon was started")) capabilities.push("no-hidden-daemon-disclosure");
  if (text.includes("REMOVE DEMA LOCAL DATA")) capabilities.push("uninstall-exact-consent");
  return capabilities;
}

function nextActions(risks) {
  const actions = [];
  if (risks.some((item) => item.code === "ci.actions_not_sha_pinned")) {
    actions.push("Pin GitHub Actions to immutable commit SHAs before broad release.");
  }
  if (risks.some((item) => item.code === "qa.coverage_threshold_missing")) {
    actions.push("Add coverage/doc-link gates once dependency policy allows tooling.");
  }
  if (risks.some((item) => item.code === "installer.expected_artifact_missing")) {
    actions.push("Restore expected installer artifacts or document the release-surface change.");
  }
  if (actions.length === 0) actions.push("Keep release gate outputs attached to release-candidate review.");
  return actions;
}

export async function buildReleaseReadinessReport({
  root = REPO_ROOT,
  now = new Date().toISOString()
} = {}) {
  const packageJson = await readJson(root, "package.json");
  const checkWorkflow = await readText(root, ".github/workflows/check.yml", false);
  const bizraReviewWorkflow = await readText(root, ".github/workflows/bizra-review.yml", false);
  const checkScript = await readText(root, "scripts/check.mjs", false);
  const installUnix = await readText(root, "scripts/install/install-unix.sh", false);
  const uninstallUnix = await readText(root, "scripts/install/uninstall-unix.sh", false);

  const risks = [];
  const scripts = packageJson.scripts ?? {};
  for (const script of REQUIRED_SCRIPTS) {
    if (!scripts[script]) risks.push(risk("package.required_script_missing", "fail", `Missing npm script: ${script}`));
  }

  const dependencies = Object.keys(packageJson.dependencies ?? {});
  if (dependencies.length > 0) {
    risks.push(risk("dependencies.runtime_not_zero", "fail", "Runtime dependencies are not zero.", {
      dependencies
    }));
  }

  const actionRefs = checkWorkflow === null ? [] : findActionRefs(checkWorkflow);
  const unpinnedActions = actionRefs.filter((ref) => !isPinnedActionRef(ref));
  if (checkWorkflow === null) {
    risks.push(risk("ci.workflow_missing", "fail", "Primary check workflow is missing."));
  } else if (unpinnedActions.length > 0) {
    risks.push(risk("ci.actions_not_sha_pinned", "review", "Workflow actions use version tags instead of immutable commit SHAs.", {
      unpinned_actions: unpinnedActions
    }));
  }

  const nodeMatrix = checkWorkflow === null ? [] : findNodeMatrix(checkWorkflow);
  const missingNodeVersions = REQUIRED_NODE_MATRIX.filter((version) => !nodeMatrix.includes(version));
  if (missingNodeVersions.length > 0) {
    risks.push(risk("ci.node_matrix_incomplete", "fail", "Node matrix does not include required versions.", {
      required: REQUIRED_NODE_MATRIX,
      actual: nodeMatrix
    }));
  }

  if (bizraReviewWorkflow === null) {
    risks.push(risk("review.bizra_gate_missing", "fail", "BIZRA Review Gate workflow is missing."));
  }

  const missingReviewScripts = REQUIRED_REVIEW_SCRIPTS.filter((file) => !existsSync(join(root, file)));
  if (missingReviewScripts.length > 0) {
    risks.push(risk("review.script_missing", "fail", "BIZRA review scripts are missing.", {
      missing: missingReviewScripts
    }));
  }

  if (!checkScript?.includes("scripts/node0-self-check.mjs")) {
    risks.push(risk("proof.self_check_not_enforced", "fail", "npm run check does not enforce Node0 self-check verification."));
  }

  if (!existsSync(join(root, "artifacts/proofs/node0-local-urp/self_check_report.json")) ||
      !existsSync(join(root, "artifacts/proofs/node0-local-urp/critic_report_001.json"))) {
    risks.push(risk("proof.u1_reports_missing", "fail", "U1 self-check or critic report is missing."));
  }

  const missingInstallerArtifacts = EXPECTED_INSTALLER_ARTIFACTS.filter((file) => !existsSync(join(root, file)));
  if (missingInstallerArtifacts.length > 0) {
    risks.push(risk("installer.expected_artifact_missing", "review", "Expected installer artifact is missing.", {
      missing: missingInstallerArtifacts
    }));
  }

  if (!existsSync(join(root, "coverage")) && !existsSync(join(root, ".nycrc")) && !existsSync(join(root, "c8.config.js"))) {
    risks.push(risk("qa.coverage_threshold_missing", "improvement", "Behavior tests run, but no coverage threshold is enforced."));
  }

  const gateOk = !risks.some((item) => item.severity === "fail");
  const score = scoreFromRisks(risks);

  return {
    schema: "bizra.dema.release_readiness.v0.1",
    generated_at: now,
    mode: "READ_ONLY_AUDIT",
    gate_ok: gateOk,
    readiness_score: score,
    score_band: scoreBand(score, gateOk),
    management_bok: {
      domains: [
        "integration_management",
        "scope_management",
        "schedule_management",
        "cost_management",
        "quality_management",
        "resource_management",
        "communications_management",
        "risk_management",
        "procurement_management",
        "stakeholder_management"
      ],
      rule: "Every release candidate must make scope, gates, risks, rollback, and stakeholder evidence explicit."
    },
    ci_cd: {
      primary_workflow: ".github/workflows/check.yml",
      bizra_review_gate: bizraReviewWorkflow !== null,
      node_matrix: nodeMatrix,
      action_refs: actionRefs,
      deployment_status: "not_configured_no_external_deploy"
    },
    quality_assurance: {
      npm_test: scripts.test ?? null,
      npm_check: scripts.check ?? null,
      self_check_enforced: Boolean(checkScript?.includes("scripts/node0-self-check.mjs")),
      release_readiness_script: "node scripts/release-readiness.mjs",
      review_scripts: REQUIRED_REVIEW_SCRIPTS
    },
    dependency_posture: {
      runtime_dependencies: dependencies.length,
      zero_runtime_dependencies: dependencies.length === 0
    },
    installer_posture: {
      expected_artifacts: EXPECTED_INSTALLER_ARTIFACTS.map((file) => ({
        path: file,
        present: existsSync(join(root, file))
      })),
      capabilities: [...new Set([
        ...installerCapabilities(installUnix),
        ...installerCapabilities(uninstallUnix)
      ])].sort()
    },
    risks,
    next_actions: nextActions(risks),
    boundary: {
      read_only: true,
      deployment_performed: false,
      secrets_accessed: false,
      infrastructure_changed: false,
      external_network_required: false
    }
  };
}

export function formatReleaseReadinessReport(report) {
  const lines = [
    "DEMA Release Readiness",
    "",
    `Mode: ${report.mode}`,
    `Gate: ${report.gate_ok ? "PASS" : "FAIL"}`,
    `Readiness score: ${report.readiness_score}/100 (${report.score_band})`,
    "",
    "Management BoK:",
    `  domains: ${report.management_bok.domains.join(", ")}`,
    `  rule: ${report.management_bok.rule}`,
    "",
    "CI/CD:",
    `  primary workflow: ${report.ci_cd.primary_workflow}`,
    `  BIZRA Review Gate: ${report.ci_cd.bizra_review_gate ? "present" : "missing"}`,
    `  node matrix: ${report.ci_cd.node_matrix.join(", ") || "unknown"}`,
    `  deployment: ${report.ci_cd.deployment_status}`,
    "",
    "Quality assurance:",
    `  npm test: ${report.quality_assurance.npm_test}`,
    `  npm check: ${report.quality_assurance.npm_check}`,
    `  self-check enforced: ${report.quality_assurance.self_check_enforced ? "yes" : "no"}`,
    "",
    "Installer posture:",
    ...report.installer_posture.expected_artifacts.map((artifact) =>
      `  - ${artifact.present ? "present" : "missing"}: ${artifact.path}`
    ),
    `  capabilities: ${report.installer_posture.capabilities.join(", ") || "none detected"}`,
    "",
    "Risks:",
    ...(report.risks.length === 0
      ? ["  - none"]
      : report.risks.map((item) => `  - ${item.severity}: ${item.code} - ${item.message}`)),
    "",
    "Next actions:",
    ...report.next_actions.map((action) => `  - ${action}`),
    "",
    "Boundary: read-only audit; no deployment; no secrets accessed; no infrastructure changed."
  ];

  return lines.join("\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const report = await buildReleaseReadinessReport();
  console.log(process.argv.includes("--json")
    ? JSON.stringify(report, null, 2)
    : formatReleaseReadinessReport(report));
  if (!report.gate_ok) process.exitCode = 1;
}
