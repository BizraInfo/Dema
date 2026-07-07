#!/usr/bin/env node
// NODE0-MISSION-HARNESS-RETURN-REVIEW-PREVIEW-1A — review gate. Builds a REAL `dema mission pulse`
// receipt end-to-end (composition ref → harness run → receipt_artifact_preview), reviews it, and
// emits the verdict.

import { pathToFileURL } from "node:url";

import { buildExampleCompositionRef } from "./node0-first-real-local-mission-pulse-preview-check.mjs";
import {
  runNode0LocalMissionHarnessPreview,
  exampleHarnessInput,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-local-mission-harness-preview.js";
import {
  runNode0MissionHarnessReturnReviewPreview,
  node0MissionHarnessReturnReviewPreviewBoundary,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-mission-harness-return-review-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Produce a real harness receipt (the receipt_artifact_preview a `dema mission pulse` run emits).
export function buildExampleHarnessReceipt() {
  const harness = runNode0LocalMissionHarnessPreview({
    consent: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
    input: exampleHarnessInput(buildExampleCompositionRef()),
  });
  return harness.receipt_artifact_preview;
}

export function runNode0MissionHarnessReturnReviewPreviewCheck() {
  return runNode0MissionHarnessReturnReviewPreview({
    consent: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE,
    input: { receipt: buildExampleHarnessReceipt() },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0MissionHarnessReturnReviewPreviewCheck();
  const boundaryAllFalse = Object.values(node0MissionHarnessReturnReviewPreviewBoundary()).every((v) => v === false);

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
          receipt_ok: result.receipt_ok,
          what_was_proven: result.what_was_proven,
          what_was_not_proven: result.what_was_not_proven,
          one_next_safe_action: result.one_next_safe_action,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          authority_delta: result.authority_delta,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE0-MISSION-HARNESS-RETURN-REVIEW-PREVIEW-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status} | receipt_ok: ${result.receipt_ok}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  next: ${result.one_next_safe_action}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
