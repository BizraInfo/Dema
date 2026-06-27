#!/usr/bin/env node
// NODE0-CI-EVIDENCE-ATTESTATION-EXPORT-1B — write verified attestation JSON from CI context.
//
// I/O boundary only: reads env + git SHA, writes JSON artifact. Core verify stays pure.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildNode0CiEvidenceAttestation,
  verifyNode0CiEvidenceAttestation,
  CI_EVIDENCE_RAIL_STATUSES,
  CI_EVIDENCE_REQUIRED_RAILS,
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
  NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
} from "../../packages/core/src/node0-ci-evidence-attestation.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(SCRIPT_DIR));

const JSON_MODE = process.argv.includes("--json");
const DEFAULT_OUT = resolve(REPO_ROOT, "node0-ci-evidence-attestation.json");

function parseArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function readCommit(explicit) {
  if (explicit) return String(explicit).trim();
  const fromGithub = process.env.GITHUB_SHA;
  if (fromGithub && String(fromGithub).trim()) return String(fromGithub).trim();
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function readRailFromEnv(rail) {
  const key = `NODE0_CI_EVIDENCE_RAIL_${rail.toUpperCase()}`;
  const raw = process.env[key];
  if (raw == null || String(raw).trim() === "") return null;
  const value = String(raw).trim().toUpperCase();
  return CI_EVIDENCE_RAIL_STATUSES.includes(value) ? value : null;
}

function resolveRails() {
  const rails = {};
  for (const rail of CI_EVIDENCE_REQUIRED_RAILS) {
    const fromEnv = readRailFromEnv(rail);
    if (fromEnv) {
      rails[rail] = fromEnv;
      continue;
    }
    if (rail === "ci_matrix" && process.env.NODE0_CI_EVIDENCE_EXPORT_CONTEXT === "post_check") {
      rails[rail] = "PASS";
      continue;
    }
    rails[rail] = "UNKNOWN";
  }
  return rails;
}

function resolveEvidenceSource() {
  const explicit = process.env.NODE0_CI_EVIDENCE_EVIDENCE_SOURCE;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  if (process.env.GITHUB_ACTIONS === "true") return "github_actions_check_workflow";
  return "operator_export";
}

export function exportNode0CiEvidenceAttestation(options = {}) {
  const outPath = resolve(options.outPath ?? parseArg("--out", DEFAULT_OUT));
  const commit = readCommit(options.commit ?? parseArg("--commit"));
  if (!commit) {
    throw new Error(
      "export-node0-ci-evidence-attestation: commit unavailable (set --commit or GITHUB_SHA)",
    );
  }

  const rails = options.rails ?? resolveRails();
  for (const rail of CI_EVIDENCE_REQUIRED_RAILS) {
    if (!CI_EVIDENCE_RAIL_STATUSES.includes(rails[rail])) {
      throw new Error(
        `export-node0-ci-evidence-attestation: invalid rail ${rail}=${rails[rail] ?? "missing"}`,
      );
    }
  }

  const attestation = buildNode0CiEvidenceAttestation({
    commit,
    rails,
    evidence_source: options.evidence_source ?? resolveEvidenceSource(),
  });
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  if (!verified.ok) {
    throw new Error(
      `export-node0-ci-evidence-attestation: verify failed (${verified.blocked_by.join(", ")})`,
    );
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");

  return Object.freeze({
    ok: true,
    schema: NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
    truth_label: NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
    out_path: outPath,
    commit,
    rails: Object.freeze({ ...rails }),
    receipt_hash: attestation.receipt_hash,
    verified,
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const result = exportNode0CiEvidenceAttestation();
    if (JSON_MODE) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("DEMA · Node0 CI evidence attestation export (local-only)");
      console.log(`  schema: ${result.schema}`);
      console.log(`  truth: ${result.truth_label}`);
      console.log(`  out: ${result.out_path}`);
      console.log(`  commit: ${result.commit}`);
      console.log(
        `  rails: ci_matrix=${result.rails.ci_matrix} codeql=${result.rails.codeql} gitleaks=${result.rails.gitleaks}`,
      );
      console.log(`  receipt_hash: ${result.receipt_hash}`);
      console.log("  result: PASS");
    }
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}
