#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..");

const PREVIEW_DIRS = [
  "packages/consent/src",
  "packages/core/src",
  "packages/models/src",
  "packages/tasks/src",
  "packages/verifier/src",
];

const AUTHORITY_FLAGS = new Set([
  "runtime",
  "runtime_started",
  "runtime_execution",
  "runtime_enabled",
  "federation",
  "federation_started",
  "federation_initiated",
  "federation_enabled",
  "mint",
  "mint_enabled",
  "receipt_mint",
  "receipt_minted",
  "capability_mint",
  "capability_minted",
  "step7_mint_performed",
  "step7_authorization_observed",
  "step7_authorization_recorded",
  "node_connection",
  "node_connection_enabled",
  "node_connection_attempted",
  "economic_settlement",
  "economic_claims_enabled",
  "raw_data_exchange",
  "network_used",
  "network_connection_attempted",
  "external_posting_performed",
  "approval_recorded",
  "authorization_emitted",
  "authorization_recorded",
  "execution_enabled",
  "mutation_performed",
  "filesystem_write_performed",
  "process_modified",
  "push_performed",
  "auto_fix_performed",
  "private_data_scanned",
  "ci_modified",
  "shared_urp_publish",
  "cross_node_receipt_emission",
  "sat_permit_enabled",
  "authority_imported",
  "mcp_server_invoked",
  "a2a_network_call_made",
  "hook_executed",
  "automation_run",
  "contract_executed",
  "prompt_invoked",
  "model_started",
  "secret_persisted_on_phone",
  "phone_authority_granted",
  "socket_opened",
  "credential_persisted",
  "remote_access_granted",
  "authority_transferred",
  "cross_node_handoff_executed",
  "skill_activated",
  "skill_invoked",
  "forced_transfer_executed",
  "private_memory_accessed",
  "license_issued",
  "offer_published",
  "ownership_transferred",
]);

function listPreviewModules(root = REPO_ROOT) {
  const found = [];
  for (const dir of PREVIEW_DIRS) {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute)) {
      if (entry.endsWith("-preview.js")) {
        found.push(relative(root, join(absolute, entry)).split("\\").join("/"));
      }
    }
  }
  return found.sort();
}

export function findBoundaryViolations(source, filePath) {
  const violations = [];
  const lines = source.split("\n");
  const keyTrueRe = /(?:^|[\s,{])([a-z_][a-z0-9_]*)\s*:\s*true\b/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;
    for (const match of line.matchAll(keyTrueRe)) {
      const key = match[1];
      if (AUTHORITY_FLAGS.has(key)) {
        violations.push({
          file: filePath,
          line: i + 1,
          key,
          snippet: trimmed.slice(0, 160),
        });
      }
    }
  }
  return violations;
}

export function buildBoundaryInvariantCheckReport(root = REPO_ROOT) {
  const modules = listPreviewModules(root);
  const moduleResults = [];
  const allViolations = [];
  for (const file of modules) {
    const absolute = join(root, file);
    const body = readFileSync(absolute, "utf8");
    const violations = findBoundaryViolations(body, file);
    moduleResults.push({
      file,
      violations_count: violations.length,
      ok: violations.length === 0,
    });
    for (const v of violations) allViolations.push(v);
  }
  return {
    schema: "bizra.dema.review.boundary_invariant_check.v0.1",
    mode: "READ_ONLY_AUDIT",
    ok: allViolations.length === 0,
    root,
    authority_flags_checked: AUTHORITY_FLAGS.size,
    modules_scanned: modules.length,
    modules_clean: moduleResults.filter((m) => m.ok).length,
    modules_violated: moduleResults.filter((m) => !m.ok).length,
    modules: moduleResults,
    violations: allViolations,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      mutation_performed: false,
      receipt_minted: false,
      filesystem_write_performed: false,
      ci_modified: false,
    },
    note: "Walks all packages/*/src/*-preview.js modules and asserts that no authority-flag-named key (per the conservative AUTHORITY_FLAGS allowlist) is set to `true` anywhere in the source. Pure static-source check; no runtime import, no module execution, no network, no mutation. Fails closed on any violation.",
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = buildBoundaryInvariantCheckReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
