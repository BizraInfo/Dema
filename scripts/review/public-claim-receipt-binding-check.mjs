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

const HOUR_MS = 60 * 60 * 1000;

function parseArguments(argv) {
  const json = argv.includes("--json");
  const requireClosed = argv.includes("--require-closed");
  const maxAgeArg = argv.find((arg) => arg.startsWith("--max-age-hours="));
  const fileArgs = argv.filter((arg) => !arg.startsWith("--"));
  if (fileArgs.length > 1) {
    throw new Error(
      "Usage: node scripts/review/public-claim-receipt-binding-check.mjs [--json] [--require-closed] [--max-age-hours=N] [evidence.json]",
    );
  }
  let maxObservationAgeMs = null;
  if (maxAgeArg) {
    const hours = Number(maxAgeArg.slice("--max-age-hours=".length));
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("--max-age-hours requires a positive number of hours");
    }
    maxObservationAgeMs = hours * HOUR_MS;
  }
  return {
    json,
    requireClosed,
    maxObservationAgeMs,
    evidencePath: resolve(fileArgs[0] ?? DEFAULT_EVIDENCE_PATH),
  };
}

export function runPublicClaimReceiptBindingCheck({
  evidencePath = DEFAULT_EVIDENCE_PATH,
  requireClosed = false,
  maxObservationAgeMs = null,
  now = Date.now(),
} = {}) {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const result = validatePublicClaimReceiptBindingEvidence(evidence, {
    now,
    maxObservationAgeMs,
  });

  // Inspection may read a manifest of any age. Asserting closure may not:
  // without a declared bound there is nothing distinguishing a scan taken
  // minutes ago from one taken months ago, so closure fails closed instead of
  // inheriting an arbitrary default.
  const violations = [...result.violations];
  if (requireClosed && maxObservationAgeMs === null) {
    violations.push({ code: "missing_freshness_bound", claim_id: null });
  }
  const closureReady =
    result.closure_ready && !(requireClosed && maxObservationAgeMs === null);

  return {
    schema: "bizra.dema.public_claim_receipt_binding_check.v0.1",
    evidence_schema: PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA,
    evidence_path: evidencePath,
    manifest_valid: result.ok,
    closure_ready: closureReady,
    closure_status: result.summary?.closure_status ?? "INVALID",
    observation_age_ms: result.observation_age_ms,
    max_observation_age_ms: maxObservationAgeMs,
    claim_count: result.summary?.claim_count ?? 0,
    bound_count: result.summary?.bound_count ?? 0,
    removed_count: result.summary?.removed_count ?? 0,
    unbound_count: result.summary?.unbound_count ?? 0,
    unbound_claim_ids: result.unbound_claim_ids,
    violations,
    boundary: {
      read_only: true,
      network_used: false,
      runtime_mutation_performed: false,
      receipt_issued: false,
    },
  };
}

// The printed closure line is the gate's verdict, never the manifest's own
// `closure_status` field. Those diverge exactly when a manifest declares itself
// CLOSED and the gate refuses it — the one case where echoing the payload would
// display a pass over a non-zero exit.
export function closureLabel(report) {
  if (report.closure_ready) return "CLOSED";
  if (report.closure_status === "CLOSED") return "REFUSED (manifest declares CLOSED)";
  return report.closure_status;
}

function printHuman(report) {
  const validity = report.manifest_valid ? "VALID" : "INVALID";
  const closure = closureLabel(report);
  console.log("DEMA - PUBLIC-CLAIM-RECEIPT-BINDING-1A");
  console.log(`  manifest: ${validity}`);
  console.log(`  closure:  ${closure}`);
  console.log(
    `  claims:   ${report.claim_count} total · ${report.bound_count} bound · ${report.removed_count} removed · ${report.unbound_count} unbound`,
  );
  const ageHours =
    report.observation_age_ms === null
      ? "unknown"
      : `${(report.observation_age_ms / HOUR_MS).toFixed(1)}h`;
  const bound =
    report.max_observation_age_ms === null
      ? "no bound declared"
      : `bound ${(report.max_observation_age_ms / HOUR_MS).toFixed(1)}h`;
  console.log(`  observed: ${ageHours} ago · ${bound}`);
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
