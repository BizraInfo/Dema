#!/usr/bin/env node
/**
 * PROOF-OF-SPEND-1A review gate — hermetic fixture seal + verify.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  buildProofOfSpendReport,
  buildProofOfSpendReceiptEnvelope,
  expectedContentReadConsent,
  verifyProofOfSpendReport,
  PROOF_OF_SPEND_TRUTH_LABEL,
} from "../../packages/core/src/proof-of-spend-1a.js";

const FIXTURE = fileURLToPath(
  new URL("../../tests/fixtures/proof-of-spend-sample.csv", import.meta.url),
);

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

const sourceText = await readFile(FIXTURE, "utf8");
const sourceSha256 = sha256Hex(sourceText);
const consent = expectedContentReadConsent(FIXTURE);

const report = buildProofOfSpendReport({
  sourceFile: FIXTURE,
  sourceSha256,
  sourceText,
  offeredConsent: consent,
  generatedAt: "2026-06-30T00:00:00.000Z",
});

if (!report.index_allowed) {
  console.error("PROOF-OF-SPEND-1A: index not allowed", report.reason_code);
  process.exit(1);
}

const verify = verifyProofOfSpendReport(report);
if (!verify.valid) {
  console.error("PROOF-OF-SPEND-1A: verify failed", verify.reason);
  process.exit(1);
}

if (report.truth_label !== PROOF_OF_SPEND_TRUTH_LABEL) {
  console.error("PROOF-OF-SPEND-1A: truth_label mismatch");
  process.exit(1);
}

buildProofOfSpendReceiptEnvelope(report, {
  generatedAt: report.generated_at,
});

console.log(
  JSON.stringify({
    gate: "PROOF-OF-SPEND-1A",
    status: "PASS",
    truth_label: PROOF_OF_SPEND_TRUTH_LABEL,
    monthly_recurring_burn_usd_cents:
      report.primary_claim?.value ?? null,
    index_hash: report.index_hash,
    no_mint: true,
    boundary:
      "No runtime execution · no model · no network · cost measured not value",
  }),
);
