#!/usr/bin/env node
// NODE0-PROOF-SNAPSHOT-ATTACHMENT-1A — gathered proof snapshot attachment gate.

import { pathToFileURL } from "node:url";
import { runNode0ProofOfTruthControlPlaneAudit } from "../audit/node0-proof-of-truth-control-plane.mjs";
import {
  runNode0ProofSnapshotAttachment,
  NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
  NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL,
} from "../../packages/core/src/node0-proof-snapshot-attachment.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0ProofSnapshotAttachmentCheck() {
  const auditResult = runNode0ProofOfTruthControlPlaneAudit({ hermetic: false });
  return runNode0ProofSnapshotAttachment({ auditResult });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0ProofSnapshotAttachmentCheck();

  if (JSON_MODE) {
    const { attachment: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node0 proof snapshot attachment check (local-only)");
    console.log(`  schema: ${NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA}`);
    console.log(`  truth: ${NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL}`);
    console.log(`  release_verdict: ${result.release_verdict}`);
    console.log(`  ready_local_eligible: ${result.ready_local_eligible}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
