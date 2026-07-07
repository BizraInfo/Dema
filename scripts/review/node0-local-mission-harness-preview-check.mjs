#!/usr/bin/env node
// NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — review gate. Builds a real composition verdict (signature-
// backed genesis anchor), runs the pure harness kernel over an injected synthetic file_ref + an
// operator-supplied candidate, and emits the verdict. Reads no file here — the fixture file_ref is
// injected; the real read-only adapter lives in the CLI.

import { pathToFileURL } from "node:url";

import { buildExampleCompositionRef } from "./node0-first-real-local-mission-pulse-preview-check.mjs";
import {
  runNode0LocalMissionHarnessPreview,
  exampleHarnessInput,
  node0LocalMissionHarnessPreviewBoundary,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-local-mission-harness-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0LocalMissionHarnessPreviewCheck() {
  return runNode0LocalMissionHarnessPreview({
    consent: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
    input: exampleHarnessInput(buildExampleCompositionRef()),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0LocalMissionHarnessPreviewCheck();
  const boundaryAllFalse = Object.values(node0LocalMissionHarnessPreviewBoundary()).every((v) => v === false);

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
          harness_ready: result.harness_ready,
          receipt_target_relpath: result.receipt_target_relpath,
          receipt_committed_live: result.receipt_artifact_preview?.committed_live,
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
    console.log("DEMA - NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  harness_ready: ${result.harness_ready}`);
    console.log(`  receipt_target: ${result.receipt_target_relpath} (committed_live: ${result.receipt_artifact_preview?.committed_live})`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
