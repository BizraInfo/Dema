#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  ARTIFACT_FILES,
  contentHash,
  verifyProofArtifacts,
} from "../node0-local-urp-proof.mjs";
import { verifySelfCheckReports } from "../node0-self-check.mjs";

const PROOF_DIR = "artifacts/proofs/node0-local-urp";

async function readJson(file) {
  return JSON.parse(await readFile(join(PROOF_DIR, file), "utf8"));
}

function assertFalse(value, label) {
  if (value !== false) throw new Error(`${label} must be false`);
}

const proof = await verifyProofArtifacts();
if (!proof.ok)
  throw new Error("U1 proof artifacts do not verify byte-for-byte.");

const selfCheck = await verifySelfCheckReports();
if (!selfCheck.ok)
  throw new Error("U1 self-check reports do not verify byte-for-byte.");

for (const file of ARTIFACT_FILES) {
  const artifact = await readJson(file);
  if (artifact.content_sha256 !== contentHash(artifact)) {
    throw new Error(
      `${file} content_sha256 does not match canonical content hash.`,
    );
  }
  assertFalse(artifact.token_value_claim, `${file} token_value_claim`);
  assertFalse(artifact.node1_handshake, `${file} node1_handshake`);
  assertFalse(
    artifact.raw_private_data_included,
    `${file} raw_private_data_included`,
  );
  assertFalse(artifact.federation_claim, `${file} federation_claim`);
}

const status = await readJson("node0_local_urp_status.json");
if (status.truth_label !== "URP_LOCAL_ACTIVE")
  throw new Error("truth_label must be URP_LOCAL_ACTIVE.");
if (status.pat_count !== 7) throw new Error("pat_count must equal 7.");
if (status.sat_count !== 5) throw new Error("sat_count must equal 5.");
assertFalse(status.public_network, "status public_network");

const sat = await readJson("sat5_urp_registration.json");
if (
  !sat.roles.every(
    (role) => role.verdict_authority === "placeholder_only_never_permit",
  )
) {
  throw new Error("SAT-5 roles must not claim PERMIT authority.");
}

const selfCheckReport = await readJson("self_check_report.json");
const criticReport = await readJson("critic_report_001.json");
if (selfCheckReport.mission_id !== "node0.self_check.001") {
  throw new Error("self_check_report mission_id mismatch.");
}
if (criticReport.mode !== "review_only_no_auto_fix") {
  throw new Error("critic_report_001 must remain review-only.");
}
assertFalse(
  criticReport.boundary.sat_permit_claimed,
  "critic sat_permit_claimed",
);

const checkGate = await readFile("scripts/check.mjs", "utf8");
if (!checkGate.includes('"scripts/node0-self-check.mjs", "--verify"')) {
  throw new Error("npm run check must enforce node0 self-check verification.");
}

console.log(
  JSON.stringify(
    {
      schema: "bizra.dema.review.receipt_integrity.v0.1",
      ok: true,
      proof_verified: proof.ok,
      self_check_verified: selfCheck.ok,
      artifacts_checked: ARTIFACT_FILES,
    },
    null,
    2,
  ),
);
