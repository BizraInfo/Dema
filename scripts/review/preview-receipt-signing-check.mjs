#!/usr/bin/env node
// PREVIEW-RECEIPT-SIGNING-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runPreviewReceiptSigning,
  PREVIEW_RECEIPT_SIGNING_SCHEMA,
  PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL,
  PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
} from "../../packages/core/src/preview-receipt-signing.js";
import { generateEd25519Keypair } from "../../packages/receipts/src/authorship-signature.js";
import { buildPeakSelfLoopPreview } from "../../packages/core/src/peak-self-loop-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runPreviewReceiptSigningCheck() {
  // Canonical fixture: the real peak-self-loop preview report, signed through the
  // existing authorship rail with an ephemeral gate-local keypair.
  return runPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: buildPeakSelfLoopPreview(),
    generateKeypair: generateEd25519Keypair,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runPreviewReceiptSigningCheck();

  if (JSON_MODE) {
    // The envelopes embed the whole peak preview — keep the JSON verdict lean.
    const { unsigned_envelope, signed_envelope, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - PREVIEW-RECEIPT-SIGNING-1A");
    console.log(`  schema: ${PREVIEW_RECEIPT_SIGNING_SCHEMA}`);
    console.log(`  truth: ${PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
