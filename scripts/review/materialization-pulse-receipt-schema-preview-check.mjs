#!/usr/bin/env node
// MATERIALIZATION-PULSE-RECEIPT-SCHEMA-PREVIEW-1A — review gate. Assembles a VALID preview Pulse receipt
// (both membranes referenced, ALLOWED input, all-false boundary) and emits the content-addressed verdict.

import { pathToFileURL } from "node:url";

import {
  runMaterializationPulseReceiptSchemaPreview,
  materializationPulseReceiptSchemaPreviewBoundary,
  exampleValidPulse,
  MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
  MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
  MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/materialization-pulse-receipt-schema-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runMaterializationPulseReceiptSchemaPreviewCheck() {
  return runMaterializationPulseReceiptSchemaPreview({
    consent: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_GO_PHRASE,
    input: { pulse: exampleValidPulse() },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runMaterializationPulseReceiptSchemaPreviewCheck();
  const boundaryAllFalse = Object.values(materializationPulseReceiptSchemaPreviewBoundary()).every((v) => v === false);
  const ok = result.ok && result.receipt_ok === true;

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          truth_label: result.truth_label,
          preview_only: true,
          status: result.status,
          ok: result.ok,
          receipt_ok: result.receipt_ok,
          content_hash: result.content_hash,
          pulse_status: result.pulse_status,
          receipt: result.receipt,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          authority_delta: result.authority_delta,
          what_this_proves: result.what_this_proves,
          what_this_does_not_prove: result.what_this_does_not_prove,
          blocked_by: result.blocked_by,
          receipt_blocked_by: result.receipt_blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    const r = result.receipt;
    console.log("DEMA - MATERIALIZATION-PULSE-RECEIPT-SCHEMA-PREVIEW-1A (PREVIEW_ONLY · the missing middle)");
    console.log(`  schema: ${MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status} | pulse_status: ${result.pulse_status} | receipt_ok: ${result.receipt_ok}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  binds: input_safety[${r.input_safety.verdict}] · fate[${r.fate.verdict}] · exec[${r.execution.mode}] · claim_binding[rej ${r.claim_binding.rejected_count}/unk ${r.claim_binding.unknown_count}] · public_safe:${r.claims_public_safe}`);
    console.log(`  does_not_prove: ${r.does_not_prove.join(", ")}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
      for (const code of result.receipt_blocked_by || []) console.log(`    receipt: ${code}`);
    }
  }

  if (!ok) process.exit(1);
}
