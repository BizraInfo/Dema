#!/usr/bin/env node
// NODE0-CI-RAIL-AGGREGATION-1C — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  mapGithubWorkflowConclusionToRailStatus,
  mapWorkflowConclusionsToCiEvidenceRails,
  allCiEvidenceRailsPass,
  ciEvidenceAttestationReadyForReadyLocal,
  buildNode0CiEvidenceAttestation,
  CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
  NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
} from "../../packages/core/src/node0-ci-evidence-attestation.js";
import { aggregateNode0CiEvidenceAttestation } from "../ci/aggregate-node0-ci-evidence-attestation.mjs";

const JSON_MODE = process.argv.includes("--json");
const FIXTURE_COMMIT = "ci-rail-aggregation-check-fixture-commit-001";

export function runNode0CiRailAggregationCheck() {
  const blocked = [];

  if (mapGithubWorkflowConclusionToRailStatus("success") !== "PASS") {
    blocked.push("map_success_not_pass");
  }
  if (mapGithubWorkflowConclusionToRailStatus("failure") !== "FAIL") {
    blocked.push("map_failure_not_fail");
  }
  if (mapGithubWorkflowConclusionToRailStatus("in_progress") !== "UNKNOWN") {
    blocked.push("map_in_progress_not_unknown");
  }

  const allPassRails = mapWorkflowConclusionsToCiEvidenceRails({
    check: "success",
    codeql: "success",
    gitleaks: "success",
  });
  if (!allCiEvidenceRailsPass(allPassRails)) blocked.push("all_pass_mapping_failed");

  const partialRails = mapWorkflowConclusionsToCiEvidenceRails({
    check: "success",
    codeql: "failure",
    gitleaks: "success",
  });
  if (partialRails.codeql !== "FAIL") blocked.push("partial_codeql_not_fail");

  const aggregate = aggregateNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    conclusions: { check: "success", codeql: "success", gitleaks: "success" },
    outPath: `${process.env.TMPDIR ?? "/tmp"}/dema-ci-rail-aggregation-check-${process.pid}.json`,
    evidence_source: "ci_rail_aggregation_check_fixture",
  });
  if (!aggregate.ok) blocked.push("aggregate_export_failed");
  if (!aggregate.all_rails_pass) blocked.push("aggregate_all_rails_not_pass");

  const attestation = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  const readyLocal = ciEvidenceAttestationReadyForReadyLocal(attestation);
  if (!readyLocal.ok) blocked.push(...readyLocal.blocked_by);

  return Object.freeze({
    ok: blocked.length === 0,
    schema: NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
    truth_label: NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
    blocked_by: Object.freeze(blocked),
    all_rails_pass: aggregate.all_rails_pass,
    receipt_hash: aggregate.receipt_hash,
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0CiRailAggregationCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Node0 CI rail aggregation check (local-only)");
    console.log(`  schema: ${NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA}`);
    console.log(`  truth: ${NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL}`);
    console.log(`  all_rails_pass: ${result.all_rails_pass}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }
  if (!result.ok) process.exit(1);
}
