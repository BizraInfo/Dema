import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = "bizra.dema.safety_report_preview.v0.1";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEMO_LOOP = [
  "dema welcome",
  "dema setup",
  "dema models",
  "dema ambient",
  'dema consent plan "Audit Downloads and send to Slack"',
  "dema status",
  "dema doctor",
  "dema mission propose",
  "dema receipts",
  "dema monetize",
];

const BOUNDARY = {
  scope: "read-only",
  inference_invoked: false,
  execution_enabled: false,
  mutation_performed: false,
  capability_minted: false,
  receipt_minted: false,
  daemon_started: false,
};

const PROOF_OF_TRUTH_CONVERGENCE = {
  formal: {
    label: "Formal",
    status: "schema_preview_only",
    evidence_kind: "static_surface",
    certifies: false,
    claim:
      "Dema can present a schema-tagged safety report shape and explicit blocked-effects boundary.",
  },
  cryptographic: {
    label: "Cryptographic",
    status: "pending_upstream_receipt_or_commitment",
    evidence_kind: "deferred_to_node0",
    certifies: false,
    claim:
      "Hashes, receipt-chain linkage, and SAT-grade commitments remain upstream in Node0 / bizra-omega.",
  },
  empirical: {
    label: "Empirical",
    status: "operator_review_required",
    evidence_kind: "operator_observation",
    certifies: false,
    claim:
      "The operator must inspect the demo loop outputs before treating the safety posture as measured.",
  },
  economic: {
    label: "Economic",
    status: "closed_until_measured_impact",
    evidence_kind: "blocked_claim",
    certifies: false,
    claim:
      "No token, revenue, Proof-of-Impact, or value claim is made from this preview.",
  },
};

const PROACTIVE_ACTIONS = [
  {
    code: "run.demo_loop",
    action:
      "Run the demo loop and capture blocker wording before talking to lighthouse users.",
  },
  {
    code: "narrow.consent_scope",
    action:
      "Use consent planning to narrow any requested effect before Node0 handoff.",
  },
  {
    code: "prepare.report_evidence",
    action:
      "Attach receipt or verifier evidence only after upstream Node0 emits it.",
  },
];

function repoRoot() {
  return join(__dirname, "..", "..", "..");
}

export function probeVerifierEvidence(root = repoRoot()) {
  const checks = {
    sat_modules_exist: false,
    orchestrator_exists: false,
    sat_tests_exist: false,
    cli_wired: false,
  };

  const satFiles = [
    "sat-boundary-verifier.js",
    "sat-consent-auditor.js",
    "sat-doctrine-compliance.js",
    "sat-identity-verifier.js",
    "sat-receipt-chain-verifier.js",
  ];

  const coreSrc = join(root, "packages", "core", "src");
  checks.sat_modules_exist = satFiles.every((f) =>
    existsSync(join(coreSrc, f)),
  );

  checks.orchestrator_exists = existsSync(
    join(coreSrc, "multi-agent-orchestrator.js"),
  );

  const testsDir = join(root, "tests");
  checks.sat_tests_exist =
    existsSync(join(testsDir, "sat-boundary-verifier.test.js")) &&
    existsSync(join(testsDir, "orchestrator-verify-cli.test.js"));

  checks.cli_wired = existsSync(join(root, "apps", "cli", "src", "index.js"));

  const allPass = Object.values(checks).every(Boolean);

  return { verifierWired: allPass, checks };
}

export function probeEvidenceBinding(root = repoRoot()) {
  const checks = {
    test_files_exist: false,
    ci_workflows_exist: false,
    harness_integration_exists: false,
    review_scripts_exist: false,
  };

  const testsDir = join(root, "tests");
  try {
    const entries = readdirSync(testsDir);
    const testFiles = entries.filter((f) => f.endsWith(".test.js"));
    checks.test_files_exist = testFiles.length >= 10;
  } catch {}

  const ciDir = join(root, ".github", "workflows");
  try {
    const entries = readdirSync(ciDir);
    checks.ci_workflows_exist = entries.some((f) => f.endsWith(".yml"));
  } catch {}

  checks.harness_integration_exists = existsSync(
    join(root, "packages", "core", "src", "harness-integration.js"),
  );

  const reviewDir = join(root, "scripts", "review");
  try {
    const entries = readdirSync(reviewDir);
    checks.review_scripts_exist = entries.some((f) => f.endsWith(".mjs"));
  } catch {}

  const allPass = Object.values(checks).every(Boolean);
  return { evidenceBound: allPass, checks };
}

export function probeInstallerPackaging(root = repoRoot()) {
  const checks = {
    setup_module_exists: false,
    check_function_exists: false,
    remove_function_exists: false,
    lifecycle_tests_exist: false,
    cli_commands_wired: false,
  };

  const setupPath = join(root, "packages", "installer", "src", "setup.js");
  checks.setup_module_exists = existsSync(setupPath);

  if (checks.setup_module_exists) {
    try {
      const src = readFileSync(setupPath, "utf8");
      checks.check_function_exists = src.includes(
        "export async function checkSetup",
      );
      checks.remove_function_exists = src.includes(
        "export async function removeSetup",
      );
    } catch {}
  }

  checks.lifecycle_tests_exist = existsSync(
    join(root, "tests", "setup-lifecycle.test.js"),
  );

  try {
    const cliSrc = readFileSync(
      join(root, "apps", "cli", "src", "index.js"),
      "utf8",
    );
    checks.cli_commands_wired =
      cliSrc.includes('"setup-check"') && cliSrc.includes('"uninstall"');
  } catch {}

  const allPass = Object.values(checks).every(Boolean);
  return { installerComplete: allPass, checks };
}

function detectSelfCritiqueGaps({
  verifierWired = false,
  evidenceBound = false,
  installerComplete = false,
} = {}) {
  const gaps = [];

  if (!installerComplete) {
    gaps.push({
      code: "installer.packaging_pending",
      severity: "launch_blocker",
      note: "Developer install exists, but broad GTM needs packaged install, hashes, dry-run/check, and uninstall.",
    });
  }

  if (!verifierWired) {
    gaps.push({
      code: "sat.real_verifier_pending",
      severity: "trust_gap",
      note: "Local verifier remains partial until SAT-facing receipt verification is fully wired.",
    });
  }

  if (!evidenceBound) {
    gaps.push({
      code: "report.evidence_pending",
      severity: "review",
      note: "This report is a buyer-facing preview, not a computed proof or canonical receipt.",
    });
  }

  return gaps;
}

const TRUTH_SPINE_PREVIEWS = {
  ihsan_floor: {
    schema: "bizra.dema.ihsan_floor_preview.v0.1",
    status: "preview_only_external_scalar",
    certifies: false,
    note: "Dema can check an externally supplied Ihsan scalar against the upstream floor, but does not compute canonical Ihsan.",
  },
  evidence_receipt: {
    schema: "bizra.dema.evidence_receipt_preview.v0.1",
    status: "preview_only_no_chain",
    certifies: false,
    digest_algo: "sha256",
    chain_id: "preview-only-no-chain",
    receipt_minted: false,
    note: "Dema can derive deterministic preview hashes without minting, signing, or advancing a Node0 chain.",
  },
  behavioral_modulation: {
    schema: "bizra.dema.behavioral_modulation_preview.v0.1",
    status: "preview_only_consent_bound",
    certifies: false,
    receipt_minted: false,
    behavior_changed: false,
    note: "Dema can preview consent-bound behavioral modulation rules, constitutionally reject unsafe shaping, and attach a no-mint receipt preview.",
  },
};

export function buildSafetyReportPreview({
  now = new Date(),
  verifierWired,
  evidenceBound,
  installerComplete,
  repoRoot: root,
} = {}) {
  const resolvedVerifierWired =
    verifierWired !== undefined
      ? verifierWired
      : probeVerifierEvidence(root).verifierWired;
  const resolvedEvidenceBound =
    evidenceBound !== undefined
      ? evidenceBound
      : probeEvidenceBinding(root).evidenceBound;
  const resolvedInstallerComplete =
    installerComplete !== undefined
      ? installerComplete
      : probeInstallerPackaging(root).installerComplete;
  const gaps = detectSelfCritiqueGaps({
    verifierWired: resolvedVerifierWired,
    evidenceBound: resolvedEvidenceBound,
    installerComplete: resolvedInstallerComplete,
  });
  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    audience: "lighthouse_alpha_operator",
    title: "Sovereign Local AI Node Setup + Safety Audit",
    summary: {
      plain_language:
        "Dema can show what is local, what is consent-bound, what is blocked, and what evidence is still missing.",
      no_proof_computed:
        "No proof is computed by this command; it is a preview template for operator review.",
    },
    proof_of_truth_convergence: PROOF_OF_TRUTH_CONVERGENCE,
    proactive_harness: {
      status: "preview",
      next_actions: PROACTIVE_ACTIONS,
    },
    truth_spine_previews: TRUTH_SPINE_PREVIEWS,
    self_critique: {
      status: gaps.length === 0 ? "no_gaps" : "open_gaps_visible",
      gaps,
    },
    demo_loop: DEMO_LOOP,
    boundary: BOUNDARY,
  };
}

function appendBullets(lines, items) {
  for (const item of items) lines.push(`  - ${item}`);
}

export function formatSafetyReportPreview(report) {
  const lines = [
    "DEMA Safety Report Preview",
    "",
    `Mode: ${report.mode}`,
    `Offer: ${report.title}`,
    `Audience: ${report.audience}`,
    `Summary: ${report.summary.plain_language}`,
    `Note: ${report.summary.no_proof_computed}`,
    "",
    "Proof-of-Truth Convergence:",
  ];

  for (const pillar of Object.values(report.proof_of_truth_convergence)) {
    lines.push(
      `  ${pillar.label}: ${pillar.status} (${pillar.evidence_kind}; certifies=${pillar.certifies})`,
    );
    lines.push(`    ${pillar.claim}`);
  }

  lines.push("");
  lines.push("Proactive harness:");
  for (const item of report.proactive_harness.next_actions) {
    lines.push(`  - ${item.code}: ${item.action}`);
  }

  lines.push("");
  lines.push("Truth spine previews:");
  for (const [name, preview] of Object.entries(report.truth_spine_previews)) {
    lines.push(
      `  - ${name}: ${preview.status} (${preview.schema}; certifies=${preview.certifies})`,
    );
    lines.push(`    ${preview.note}`);
  }

  lines.push("");
  lines.push("Self-critique:");
  for (const gap of report.self_critique.gaps) {
    lines.push(`  - ${gap.severity}: ${gap.code} - ${gap.note}`);
  }

  lines.push("");
  lines.push("Demo loop:");
  appendBullets(lines, report.demo_loop);
  lines.push("");
  lines.push(
    "Boundary: preview-only; no model inference; no execution; no mutation; no receipt minted.",
  );

  return lines.join("\n");
}

export { detectSelfCritiqueGaps };
