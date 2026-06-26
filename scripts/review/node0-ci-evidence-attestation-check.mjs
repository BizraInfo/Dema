#!/usr/bin/env node
// NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  buildNode0CiEvidenceAttestation,
  verifyNode0CiEvidenceAttestation,
  ciEvidenceAttestationReadyForReadyLocal,
  mergeCiEvidenceAttestationIntoGatheredInput,
  buildGatheredAuditResultWithCiEvidenceAttestation,
  runNode0CiEvidenceAttestation,
  CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
  NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
} from "../../packages/core/src/node0-ci-evidence-attestation.js";
import { GATHERED_ADVISORY_SNAPSHOT_INPUT } from "../../packages/core/src/node0-proof-snapshot-attachment.js";
import { runNode0ProofSnapshotAttachment } from "../../packages/core/src/node0-proof-snapshot-attachment.js";

const JSON_MODE = process.argv.includes("--json");
const FIXTURE_COMMIT = "ci-evidence-attestation-check-fixture-commit-001";

export function runNode0CiEvidenceAttestationCheck() {
  const blocked = [];

  const overclaim = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
    claimed_release_verdict: "READY_REMOTE",
  });
  const overclaimVerified = verifyNode0CiEvidenceAttestation(overclaim);
  if (overclaimVerified.ok) blocked.push("overclaim_not_blocked");

  const attestation = buildNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  if (!verified.ok) blocked.push(...verified.blocked_by);

  const readyLocal = ciEvidenceAttestationReadyForReadyLocal(attestation);
  if (!readyLocal.ok) blocked.push(...readyLocal.blocked_by);

  const baseInput = {
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit: FIXTURE_COMMIT,
    checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
    workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
    risks: [],
  };
  const merge = mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation);
  if (!merge.merged) blocked.push("attestation_merge_failed");

  const audit = buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation);
  if (audit.ledger.release_verdict !== "READY_LOCAL") {
    blocked.push("attestation_did_not_promote_ready_local");
  }

  const attachment = runNode0ProofSnapshotAttachment({ auditResult: audit });
  if (!attachment.ready_local_eligible) blocked.push("attachment_not_ready_local_eligible");

  const kernel = runNode0CiEvidenceAttestation({
    commit: FIXTURE_COMMIT,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  if (!kernel.ok) blocked.push("kernel_run_failed");

  return {
    ok: blocked.length === 0,
    schema: NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
    truth_label: NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
    blocked_by: Object.freeze(blocked),
    attestation_receipt_hash: attestation.receipt_hash,
    ready_local_eligible: attachment.ready_local_eligible,
    release_verdict: audit.ledger.release_verdict,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0CiEvidenceAttestationCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Node0 CI evidence attestation check (local-only)");
    console.log(`  schema: ${NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA}`);
    console.log(`  truth: ${NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL}`);
    console.log(`  release_verdict: ${result.release_verdict}`);
    console.log(`  ready_local_eligible: ${result.ready_local_eligible}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
