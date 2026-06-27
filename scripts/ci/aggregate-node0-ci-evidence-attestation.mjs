#!/usr/bin/env node
// NODE0-CI-RAIL-AGGREGATION-1C — map peer workflow conclusions → attestation rails → export JSON.
//
// I/O boundary: reads env/JSON conclusions, writes verified attestation. Core mapping stays pure.

import { pathToFileURL } from "node:url";
import {
  mapWorkflowConclusionsToCiEvidenceRails,
  allCiEvidenceRailsPass,
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
  NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
} from "../../packages/core/src/node0-ci-evidence-attestation.js";
import { exportNode0CiEvidenceAttestation } from "./export-node0-ci-evidence-attestation.mjs";

const JSON_MODE = process.argv.includes("--json");
const DEFAULT_OUT = "node0-ci-evidence-attestation-aggregated.json";

function parseArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function readWorkflowConclusions() {
  const inline = process.env.NODE0_CI_WORKFLOW_CONCLUSIONS_JSON;
  if (inline != null && String(inline).trim() !== "") {
    return JSON.parse(inline);
  }
  return {
    check: process.env.NODE0_CI_WORKFLOW_CONCLUSION_CHECK,
    codeql: process.env.NODE0_CI_WORKFLOW_CONCLUSION_CODEQL,
    gitleaks: process.env.NODE0_CI_WORKFLOW_CONCLUSION_GITLEAKS,
  };
}

export function aggregateNode0CiEvidenceAttestation(options = {}) {
  const conclusions = options.conclusions ?? readWorkflowConclusions();
  const rails = options.rails ?? mapWorkflowConclusionsToCiEvidenceRails(conclusions);
  const evidence_source =
    options.evidence_source ??
    (process.env.GITHUB_ACTIONS === "true"
      ? "github_actions_rail_aggregation"
      : "operator_rail_aggregation");

  const exportResult = exportNode0CiEvidenceAttestation({
    ...options,
    rails,
    evidence_source,
    outPath: options.outPath ?? parseArg("--out", DEFAULT_OUT),
  });

  return Object.freeze({
    ...exportResult,
    workflow_conclusions: Object.freeze({ ...conclusions }),
    all_rails_pass: allCiEvidenceRailsPass(rails),
    proactive_self: Object.freeze({
      self_critique: Object.freeze([
        allCiEvidenceRailsPass(rails)
          ? "All required workflow conclusions mapped to PASS rails."
          : "One or more rails are not PASS; READY_LOCAL promotion requires verified PASS on all rails.",
      ]),
      micro_compliance: Object.freeze({
        no_ready_remote_claim: true,
        no_public_safe_claim: true,
        max_auto_verdict_ready_local: true,
      }),
      micro_consent: Object.freeze({
        required_phrase: "GO: apply aggregated CI evidence attestation locally",
        note: "Operator must download artifact and set DEMA_CI_EVIDENCE_ATTESTATION_PATH explicitly.",
      }),
    }),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const result = aggregateNode0CiEvidenceAttestation();
    if (JSON_MODE) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("DEMA · Node0 CI rail aggregation export (local-only)");
      console.log(`  schema: ${NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA}`);
      console.log(`  truth: ${NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL}`);
      console.log(`  out: ${result.out_path}`);
      console.log(`  commit: ${result.commit}`);
      console.log(
        `  rails: ci_matrix=${result.rails.ci_matrix} codeql=${result.rails.codeql} gitleaks=${result.rails.gitleaks}`,
      );
      console.log(`  all_rails_pass: ${result.all_rails_pass}`);
      console.log(`  receipt_hash: ${result.receipt_hash}`);
      console.log("  result: PASS");
    }
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}
