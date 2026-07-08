#!/usr/bin/env node
// NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A — review gate. Builds a real harness result (via the
// signature-backed composition ref), runs the pure emitter over it, and emits the verdict. Reads no file:
// the harness file_ref is an injected synthetic read result; the real read/write adapter lives in the CLI.

import { pathToFileURL } from "node:url";

import { buildExampleCompositionRef } from "./node0-first-real-local-mission-pulse-preview-check.mjs";
import {
  buildNode0LocalMissionHarnessPreviewPayload,
  exampleHarnessInput,
} from "../../packages/core/src/node0-local-mission-harness-preview.js";
import {
  runNode0LocalMissionArtifactEmissionPreview,
  node0LocalMissionArtifactEmissionPreviewBoundary,
  ARTIFACT_NAMES,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-local-mission-artifact-emission-preview.js";

const JSON_MODE = process.argv.includes("--json");

// A real, already-verified harness result (which embeds pulse → composition → genesis signature anchor),
// wrapped as the emitter input.
export function buildExampleEmissionInput() {
  const harness_result = buildNode0LocalMissionHarnessPreviewPayload(exampleHarnessInput(buildExampleCompositionRef()));
  return { harness_result };
}

export function runNode0LocalMissionArtifactEmissionPreviewCheck() {
  return runNode0LocalMissionArtifactEmissionPreview({
    consent: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE,
    input: buildExampleEmissionInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0LocalMissionArtifactEmissionPreviewCheck();
  const boundaryAllFalse = Object.values(node0LocalMissionArtifactEmissionPreviewBoundary()).every((v) => v === false);
  const artifactHashes = ARTIFACT_NAMES.map((name) => `${name}=${result.artifacts?.[name]?.content_hash ?? "-"}`);

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          truth_label: result.truth_label,
          preview_only: true,
          status: result.status,
          ok: result.ok,
          run_id: result.run_id,
          content_hash: result.content_hash,
          artifact_paths: result.artifact_paths,
          artifact_hashes: artifactHashes,
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
    console.log("DEMA - NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  run_id: ${result.run_id}`);
    console.log(`  content_hash: ${result.content_hash}`);
    for (const relpath of result.artifact_paths || []) console.log(`  artifact: ${relpath}`);
    for (const h of artifactHashes) console.log(`    ${h}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
