#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA,
  validatePublicClaimReceiptBindingEvidence,
} from "../audit/public-claim-receipt-binding-core.mjs";

const DEFAULT_EVIDENCE_PATH = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  "docs/audits/evidence/bizra-ai-public-claim-receipt-binding-2026-08-04.json",
);

function parseArguments(argv) {
  const json = argv.includes("--json");
  const requireClosed = argv.includes("--require-closed");
  const fileArgs = argv.filter((arg) => !arg.startsWith("--"));
  if (fileArgs.length > 1) {
    throw new Error(
      "Usage: node scripts/review/public-claim-receipt-binding-check.mjs [--json] [--require-closed] [evidence.json]",
    );
  }
  return {
    json,
    requireClosed,
    evidencePath: resolve(fileArgs[0] ?? DEFAULT_EVIDENCE_PATH),
  };
}

export function runPublicClaimReceiptBindingCheck({
  evidencePath = DEFAULT_EVIDENCE_PATH,
} = {}) {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const result = validatePublicClaimReceiptBindingEvidence(evidence);
  return {
    schema: "bizra.dema.public_claim_receipt_binding_check.v0.1",
    evidence_schema: PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA,
    evidence_path: evidencePath,
    manifest_valid: result.ok,
    closure_ready: result.closure_ready,
    closure_status: result.summary?.closure_status ?? "INVALID",
    claim_count: result.summary?.claim_count ?? 0,
    bound_count: result.summary?.bound_count ?? 0,
    removed_count: result.summary?.removed_count ?? 0,
    unbound_count: result.summary?.unbound_count ?? 0,
    unbound_claim_ids: result.unbound_claim_ids,
    violations: result.violations,
    boundary: {
      read_only: true,
      network_used: false,
      runtime_mutation_performed: false,
      receipt_issued: false,
    },
  };
}

function printHuman(report) {
  const validity = report.manifest_valid ? "VALID" : "INVALID";
  const closure = report.closure_ready ? "CLOSED" : report.closure_status;
  console.log("DEMA - PUBLIC-CLAIM-RECEIPT-BINDING-1A");
  console.log(`  manifest: ${validity}`);
  console.log(`  closure:  ${closure}`);
  console.log(
    `  claims:   ${report.claim_count} total · ${report.bound_count} bound · ${report.removed_count} removed · ${report.unbound_count} unbound`,
  );
  if (report.unbound_claim_ids.length > 0) {
    console.log(`  unbound:  ${report.unbound_claim_ids.join(", ")}`);
  }
  for (const violation of report.violations) {
    console.error(
      `  violation: ${violation.code}${violation.claim_id ? ` (${violation.claim_id})` : ""}`,
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const report = runPublicClaimReceiptBindingCheck(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (!report.manifest_valid) {
    process.exitCode = 1;
  } else if (options.requireClosed && !report.closure_ready) {
    process.exitCode = 2;
  }
}

const invokedAsScript =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  try {
    await main();
  } catch (error) {
    console.error(
      `public-claim-receipt-binding-check: ${error instanceof Error ? error.message : "failed"}`,
    );
    process.exitCode = 1;
  }
}
