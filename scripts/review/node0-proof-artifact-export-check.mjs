#!/usr/bin/env node
// NODE0-PROOF-ARTIFACT-EXPORT-1A — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  gatherNode0ProofArtifactBundle,
} from "../proof/export-node0-proof-artifact-bundle.mjs";
import {
  NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA,
  NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL,
  PROOF_ARTIFACT_WRITE_CONSENT,
  evaluateProofArtifactWrite,
  redactNode0ProofArtifactManifest,
  verifyNode0ProofArtifactManifest,
} from "../../packages/core/src/node0-proof-artifact-bundle.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0ProofArtifactExportCheck() {
  const blocked = [];

  const bundle = gatherNode0ProofArtifactBundle({ hermetic: true });
  if (!bundle.ok) blocked.push(...(bundle.verified?.blocked_by ?? ["bundle_not_ok"]));
  if (bundle.manifest.release_verdict !== "READY_LOCAL") {
    blocked.push("hermetic_release_verdict_not_ready_local");
  }
  if (!bundle.manifest.artifacts?.ci_evidence_attestation) {
    blocked.push("hermetic_attestation_missing");
  }

  const redacted = redactNode0ProofArtifactManifest(bundle.manifest);
  const redactedVerified = verifyNode0ProofArtifactManifest(redacted);
  if (!redactedVerified.ok) blocked.push(...redactedVerified.blocked_by);

  const denyWrite = evaluateProofArtifactWrite({ consent_phrase: "GO: wrong phrase" });
  if (denyWrite.allowed) blocked.push("write_consent_not_enforced");

  const allowWrite = evaluateProofArtifactWrite({
    consent_phrase: PROOF_ARTIFACT_WRITE_CONSENT,
  });
  if (!allowWrite.allowed) blocked.push("write_consent_should_allow");

  return Object.freeze({
    ok: blocked.length === 0,
    schema: NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA,
    truth_label: NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL,
    release_verdict: bundle.manifest?.release_verdict ?? "UNKNOWN",
    manifest_receipt_hash: bundle.manifest?.manifest_receipt_hash ?? null,
    blocked_by: Object.freeze(blocked),
  });
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0ProofArtifactExportCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Node0 proof artifact export check (hermetic)");
    console.log(`  schema: ${NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA}`);
    console.log(`  truth: ${NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL}`);
    console.log(`  release_verdict: ${result.release_verdict}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }
  if (!result.ok) process.exit(1);
}
