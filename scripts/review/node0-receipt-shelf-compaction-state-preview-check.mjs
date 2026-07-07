#!/usr/bin/env node
// NODE0-RECEIPT-SHELF-COMPACTION-STATE-PREVIEW-1A — review gate. Builds a REAL local URP shelf payload
// end-to-end (real harness receipts → shelf), compacts it into a hash-bound mission state, emits the verdict.

import { pathToFileURL } from "node:url";

import { buildExampleHarnessReceipt } from "./node0-mission-harness-return-review-preview-check.mjs";
import { buildNode0LocalUrpShelfIndexPreviewPayload } from "../../packages/core/src/node0-local-urp-shelf-index-preview.js";
import {
  runNode0ReceiptShelfCompactionStatePreview,
  node0ReceiptShelfCompactionStatePreviewBoundary,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-receipt-shelf-compaction-state-preview.js";

const JSON_MODE = process.argv.includes("--json");

// A real, verifiable shelf payload (not the run envelope) built from two real harness receipts.
export function buildExampleShelfPayload() {
  return buildNode0LocalUrpShelfIndexPreviewPayload({
    receipts: [buildExampleHarnessReceipt(), buildExampleHarnessReceipt()],
  });
}

export function runNode0ReceiptShelfCompactionStatePreviewCheck() {
  return runNode0ReceiptShelfCompactionStatePreview({
    consent: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE,
    input: { shelf: buildExampleShelfPayload() },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0ReceiptShelfCompactionStatePreviewCheck();
  const boundaryAllFalse = Object.values(node0ReceiptShelfCompactionStatePreviewBoundary()).every((v) => v === false);

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          truth_label: result.truth_label,
          preview_only: true,
          status: result.status,
          ok: result.ok,
          content_hash: result.content_hash,
          shelf_ok: result.shelf_ok,
          source_receipt_count: result.source_receipt_count,
          valid_receipt_count: result.valid_receipt_count,
          invalid_receipt_count: result.invalid_receipt_count,
          live_leak_count: result.live_leak_count,
          retained_signals: result.retained_signals,
          dropped_content: result.dropped_content,
          what_can_no_longer_be_claimed: result.what_can_no_longer_be_claimed,
          one_next_safe_action: result.one_next_safe_action,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          authority_delta: result.authority_delta,
          committed_live: result.committed_live,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE0-RECEIPT-SHELF-COMPACTION-STATE-PREVIEW-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status} | shelf_ok: ${result.shelf_ok}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  compacted: ${result.source_receipt_count} receipts → ${result.valid_receipt_count} valid · ${result.invalid_receipt_count} invalid · ${result.live_leak_count} live-leak`);
    console.log(`  retained: ${result.retained_signals.length} signal(s) · dropped: ${result.dropped_content.length} class(es)`);
    console.log(`  next: ${result.one_next_safe_action}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | committed_live: ${result.committed_live}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
