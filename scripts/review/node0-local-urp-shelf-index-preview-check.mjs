#!/usr/bin/env node
// NODE0-LOCAL-URP-SHELF-INDEX-PREVIEW-1A — review gate. Builds two REAL `dema mission pulse` receipts
// end-to-end, indexes them into a local URP shelf catalog, and emits the verdict.

import { pathToFileURL } from "node:url";

import { buildExampleHarnessReceipt } from "./node0-mission-harness-return-review-preview-check.mjs";
import {
  runNode0LocalUrpShelfIndexPreview,
  node0LocalUrpShelfIndexPreviewBoundary,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-local-urp-shelf-index-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0LocalUrpShelfIndexPreviewCheck() {
  const receipts = [buildExampleHarnessReceipt(), buildExampleHarnessReceipt()];
  return runNode0LocalUrpShelfIndexPreview({
    consent: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE,
    input: { receipts },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0LocalUrpShelfIndexPreviewCheck();
  const boundaryAllFalse = Object.values(node0LocalUrpShelfIndexPreviewBoundary()).every((v) => v === false);

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
          entry_count: result.entry_count,
          valid_count: result.valid_count,
          invalid_count: result.invalid_count,
          live_leak_count: result.live_leak_count,
          all_preview: result.all_preview,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          authority_delta: result.authority_delta,
          what_this_proves: result.what_this_proves,
          what_this_does_not_prove: result.what_this_does_not_prove,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE0-LOCAL-URP-SHELF-INDEX-PREVIEW-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  shelf: ${result.entry_count} entries · ${result.valid_count} valid · ${result.invalid_count} invalid · ${result.live_leak_count} live-leaks · all_preview:${result.all_preview}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
