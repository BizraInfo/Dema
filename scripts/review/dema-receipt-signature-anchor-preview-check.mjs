#!/usr/bin/env node
// DEMA-RECEIPT-SIGNATURE-ANCHOR-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";
import { generateKeyPairSync } from "node:crypto";

import {
  runDemaReceiptSignatureAnchorPreview,
  DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
  DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL,
  DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-receipt-signature-anchor-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaReceiptSignatureAnchorPreviewCheck() {
  // Ephemeral preview keypair — generated HERE (the gate), injected into the pure kernel. This binds
  // no live Node0 identity; the real genesis signing key is a separate, operator-consented ceremony.
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return runDemaReceiptSignatureAnchorPreview({
    consent: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_GO_PHRASE,
    input: {
      payload: { kind: "capability_receipt", capability_id: "DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_1A", registry: 41 },
      private_key: privateKey,
      public_key: publicKey,
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaReceiptSignatureAnchorPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-RECEIPT-SIGNATURE-ANCHOR-PREVIEW-1A");
    console.log(`  schema: ${DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
