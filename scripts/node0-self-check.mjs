#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ARTIFACT_FILES,
  canonicalStringify,
  contentHash,
  sha256,
  verifyProofArtifacts
} from "./node0-local-urp-proof.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const PROOF_DIR = "artifacts/proofs/node0-local-urp";
const REPORT_DATE = "2026-05-14";

export const REPORT_FILES = [
  "self_check_report.json",
  "critic_report_001.json"
];

const PHASES = ["UNDERSTAND", "PLAN", "ACT", "VERIFY", "SETTLE"];
const REQUIRED_SAT_ROLES = ["Validator", "Oracle", "Mediator", "Archivist", "Sentinel"];

function withContentHash(value) {
  const copy = { ...value, content_sha256: null };
  copy.content_sha256 = contentHash(copy);
  return copy;
}

function asCheck(id, label, pass, evidence = {}) {
  return {
    id,
    label,
    pass: Boolean(pass),
    evidence
  };
}

async function readJsonFile(path) {
  const body = await readFile(path, "utf8");
  return JSON.parse(body);
}

async function loadProofArtifacts(root) {
  const dir = join(root, PROOF_DIR);
  const entries = {};
  for (const file of ARTIFACT_FILES) {
    const key = file.replace(/\.json$/, "");
    entries[key] = await readJsonFile(join(dir, file));
  }
  return entries;
}

function buildChecks(artifacts, proofVerify) {
  const status = artifacts.node0_local_urp_status;
  const registry = artifacts.urp_local_registry;
  const sat5 = artifacts.sat5_urp_registration;
  const poi = artifacts.poi_sandbox_record;
  const receipts = [
    artifacts.urp_skill_registry_receipt,
    artifacts.urp_knowledge_pack_receipt,
    artifacts.urp_resource_offer_receipt,
    poi
  ];
  const roles = sat5.roles.map((role) => role.name);

  return [
    asCheck("u1.hash_verify", "U1 proof artifacts hash-verify", proofVerify.ok, {
      files_checked: proofVerify.files.length
    }),
    asCheck("u1.truth_label", "URP_LOCAL_ACTIVE truth label is present", status.truth_label === "URP_LOCAL_ACTIVE", {
      truth_label: status.truth_label
    }),
    asCheck("u1.pat7", "PAT count equals 7", status.pat_count === 7, {
      pat_count: status.pat_count
    }),
    asCheck("u1.sat5", "SAT count equals 5", status.sat_count === 5 && roles.length === 5, {
      sat_count: status.sat_count,
      roles
    }),
    asCheck("u1.sat_roles", "SAT roles match local seed list", REQUIRED_SAT_ROLES.every((role) => roles.includes(role)), {
      required_roles: REQUIRED_SAT_ROLES,
      actual_roles: roles
    }),
    asCheck("u1.registry_seed", "Skill, knowledge pack, resource offer, and PoI records exist", (
      registry.skills.length === 1 &&
      registry.knowledge_packs.length === 1 &&
      registry.resource_offers.length === 1 &&
      registry.poi_sandbox_records.length === 1
    ), {
      skills: registry.skills.length,
      knowledge_packs: registry.knowledge_packs.length,
      resource_offers: registry.resource_offers.length,
      poi_sandbox_records: registry.poi_sandbox_records.length
    }),
    asCheck("u1.local_boundary", "No public network, Node1 handshake, raw private data, or token claim", (
      status.public_network === false &&
      status.node1_handshake === false &&
      status.raw_private_data_included === false &&
      status.token_value_claim === false &&
      poi.economic_mode === "sandbox_no_cash_value"
    ), {
      public_network: status.public_network,
      node1_handshake: status.node1_handshake,
      raw_private_data_included: status.raw_private_data_included,
      token_value_claim: status.token_value_claim,
      poi_mode: poi.economic_mode
    }),
    asCheck("u1.receipt_hashes", "Receipts are content-hash backed", receipts.every((receipt) => receipt.content_sha256 === contentHash(receipt)), {
      receipts_checked: receipts.length
    }),
    asCheck("u1.resource_idempotency", "Duplicate local resource offer is declared idempotent", (
      registry.idempotency.duplicate_resource_offer_rejected_or_idempotent === true
    ), {
      duplicate_policy: registry.idempotency.resource_offer_policy
    })
  ];
}

function buildFindings(artifacts, checks) {
  const status = artifacts.node0_local_urp_status;
  const sat5 = artifacts.sat5_urp_registration;
  const poi = artifacts.poi_sandbox_record;
  const failedChecks = checks.filter((check) => !check.pass);
  const findings = failedChecks.map((check) => ({
    code: `check.failed.${check.id}`,
    severity: "blocker",
    message: check.label,
    evidence: check.evidence
  }));

  if (sat5.binding === "non_canonical_local_seed") {
    findings.push({
      code: "sat5.non_canonical_local_seed",
      severity: "review",
      message: "SAT-5 is locally seeded and must not be described as upstream SAT permit authority.",
      evidence: {
        binding: sat5.binding,
        canon_status: sat5.canon_status
      }
    });
  }

  if (poi.status === "pending_verification") {
    findings.push({
      code: "poi.pending_verification",
      severity: "review",
      message: "PoI record is a sandbox pending-verification accounting shape, not a reward or token claim.",
      evidence: {
        status: poi.status,
        economic_mode: poi.economic_mode,
        value_claim: poi.value_claim
      }
    });
  }

  if (status.prereq_checks.node0_standalone_py === "missing_not_in_this_checkout") {
    findings.push({
      code: "node0_standalone_py.missing",
      severity: "info",
      message: "Standalone Node0 Python health checks are outside this checkout.",
      evidence: status.prereq_checks
    });
  }

  return findings;
}

function reportEntries(reports) {
  return [
    ["self_check_report.json", reports.self_check_report],
    ["critic_report_001.json", reports.critic_report_001]
  ];
}

async function buildReports(root) {
  const proofVerify = await verifyProofArtifacts({ root });
  const artifacts = await loadProofArtifacts(root);
  const checks = buildChecks(artifacts, proofVerify);
  const source_hashes = proofVerify.files.map((file) => ({
    path: file.path,
    sha256: file.actual_sha256
  }));

  const selfCheck = withContentHash({
    schema: "bizra.dema.urp_local.self_check_report.v0.1",
    report_id: "node0-self-check-report-v0.1",
    mission_id: "node0.self_check.001",
    report_date: REPORT_DATE,
    autonomy_level: "L2",
    phases: PHASES,
    scope: {
      reads_only: [
        "U1 proof artifacts",
        "local receipt artifacts",
        "SAT-5 local seed registry",
        "PoI sandbox record"
      ],
      writes_only: REPORT_FILES,
      excludes: [
        "private raw user data",
        "network calls",
        "Node1 handshake",
        "runtime execution",
        "auto-fix mutation"
      ]
    },
    boundary: {
      network_used: false,
      runtime_execution: false,
      auto_fix_performed: false,
      public_network: false,
      node1_handshake: false,
      token_value_claim: false,
      private_data_scanned: false
    },
    source_artifacts: source_hashes,
    checks,
    verdict: checks.every((check) => check.pass)
      ? "pass_with_review_items"
      : "blocked_pending_failed_checks"
  });

  const findings = buildFindings(artifacts, checks);
  const critic = withContentHash({
    schema: "bizra.dema.urp_local.critic_report.v0.1",
    report_id: "critic-report-node0-local-urp-001",
    report_date: REPORT_DATE,
    agent: "CriticAgent",
    mission_id: selfCheck.mission_id,
    mode: "review_only_no_auto_fix",
    scope: "U1 proof artifacts and self-check report only",
    boundary: {
      mutation_performed: false,
      auto_fix_performed: false,
      network_used: false,
      sat_permit_claimed: false,
      token_or_reward_claimed: false
    },
    self_check_report_sha256: selfCheck.content_sha256,
    finding_summary: {
      blocker: findings.filter((finding) => finding.severity === "blocker").length,
      review: findings.filter((finding) => finding.severity === "review").length,
      info: findings.filter((finding) => finding.severity === "info").length
    },
    findings
  });

  return {
    self_check_report: selfCheck,
    critic_report_001: critic
  };
}

export async function buildSelfCheckReports({ root = REPO_ROOT, write = false } = {}) {
  const reports = await buildReports(root);
  const dir = join(root, PROOF_DIR);
  if (write) await mkdir(dir, { recursive: true });

  const files = [];
  for (const [name, report] of reportEntries(reports)) {
    const body = `${canonicalStringify(report)}\n`;
    if (write) await writeFile(join(dir, name), body, "utf8");
    files.push({
      path: name,
      sha256: sha256(body),
      written: write
    });
  }

  return {
    schema: "bizra.dema.urp_local.self_check_build.v0.1",
    proof_dir: PROOF_DIR,
    files,
    reports,
    boundary: {
      network_used: false,
      runtime_execution: false,
      auto_fix_performed: false,
      private_data_scanned: false
    }
  };
}

export async function verifySelfCheckReports({ root = REPO_ROOT } = {}) {
  const expected = await buildSelfCheckReports({ root, write: false });
  const dir = join(root, PROOF_DIR);
  const files = [];

  for (const [name, report] of reportEntries(expected.reports)) {
    const expectedBody = `${canonicalStringify(report)}\n`;
    let actualBody = null;
    try {
      actualBody = await readFile(join(dir, name), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    files.push({
      path: name,
      exists: actualBody !== null,
      matches: actualBody === expectedBody,
      expected_sha256: sha256(expectedBody),
      actual_sha256: actualBody === null ? null : sha256(actualBody)
    });
  }

  return {
    schema: "bizra.dema.urp_local.self_check_verify.v0.1",
    proof_dir: PROOF_DIR,
    ok: expected.reports.self_check_report.verdict === "pass_with_review_items" &&
      files.every((file) => file.exists && file.matches),
    files,
    boundary: expected.boundary
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const verify = process.argv.includes("--verify");
  const report = verify
    ? await verifySelfCheckReports()
    : await buildSelfCheckReports({ write: true });
  console.log(JSON.stringify(report, null, 2));
  if (verify && !report.ok) process.exitCode = 1;
}
