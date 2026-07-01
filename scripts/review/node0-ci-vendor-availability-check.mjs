#!/usr/bin/env node
// NODE0-CI-VENDOR-AVAILABILITY-1A — billing-lock local proof lane verifier.

import { pathToFileURL } from "node:url";

import {
  buildDefaultCiVendorAvailabilityMarker,
  mergeCiVendorAvailabilityIntoWorkflows,
  NODE0_CI_VENDOR_AVAILABILITY_SCHEMA,
  NODE0_CI_VENDOR_AVAILABILITY_TRUTH_LABEL,
} from "../../packages/core/src/node0-ci-vendor-availability.js";
import { summarizeEmpiricalRail } from "../../packages/core/src/node0-proof-rails.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0CiVendorAvailabilityCheck() {
  const marker = buildDefaultCiVendorAvailabilityMarker();
  const merge = mergeCiVendorAvailabilityIntoWorkflows(
    { ci_matrix: "UNKNOWN", codeql: "UNKNOWN", gitleaks: "UNKNOWN" },
    marker,
  );
  const empirical = summarizeEmpiricalRail(
    {
      test: true,
      check: true,
      delivery: true,
      codeql: "UNKNOWN",
      gitleaks: "UNKNOWN",
      bizra_review_gate: "UNKNOWN",
    },
    { present: true, lines: 95, threshold: 80 },
    { present: true, boot_latency_ms: 120, ceiling: 150 },
    merge.workflows,
  );
  return {
    ok:
      marker.availability === "GITHUB_ACTIONS_BILLING_LOCK" &&
      marker.code_implicated === false &&
      merge.merged === true &&
      empirical.local_proof_lane === true &&
      empirical.ci_matrix_pass === true &&
      empirical.status === "PASS",
    schema: NODE0_CI_VENDOR_AVAILABILITY_SCHEMA,
    truth_label: NODE0_CI_VENDOR_AVAILABILITY_TRUTH_LABEL,
    marker,
    merge,
    empirical_status: empirical.status,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0CiVendorAvailabilityCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Node0 CI vendor availability (billing-lock lane)");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  availability: ${result.marker.availability}`);
    console.log(`  empirical_status: ${result.empirical_status}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
  }
  if (!result.ok) process.exit(1);
}
