#!/usr/bin/env node
// NODE0-FIRST-REAL-LOCAL-MISSION-PULSE-PREVIEW-1A — review gate. Builds a real composition-gate verdict
// (which carries a signature-backed genesis anchor), runs one mission pulse over it, and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  buildExampleGenesisRootPacket,
} from "./node0-urp-genesis-root-composition-gate-preview-check.mjs";
import {
  buildNode0UrpGenesisRootCompositionGatePreviewPayload,
  exampleCompositionInput,
} from "../../packages/core/src/node0-urp-genesis-root-composition-gate-preview.js";
import {
  runNode0FirstRealLocalMissionPulsePreview,
  exampleMissionInput,
  node0FirstRealLocalMissionPulsePreviewBoundary,
  PULSE_STAGES,
  NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
  NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
  NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-first-real-local-mission-pulse-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Build a real composition verdict: genesis descriptor (ephemeral signed anchor, generated in this gate)
// composed with the example URP resource-family surfaces.
export function buildExampleCompositionRef() {
  return buildNode0UrpGenesisRootCompositionGatePreviewPayload(exampleCompositionInput(buildExampleGenesisRootPacket()));
}

export function runNode0FirstRealLocalMissionPulsePreviewCheck() {
  return runNode0FirstRealLocalMissionPulsePreview({
    consent: NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_GO_PHRASE,
    input: exampleMissionInput(buildExampleCompositionRef()),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0FirstRealLocalMissionPulsePreviewCheck();
  const boundaryAllFalse = Object.values(node0FirstRealLocalMissionPulsePreviewBoundary()).every((v) => v === false);

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          status: result.status,
          ok: result.ok,
          content_hash: result.content_hash,
          pulse_ready: result.pulse_ready,
          stage_count: result.stage_count,
          pulse_stages: PULSE_STAGES,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          authority_delta: result.authority_delta,
          dema_report: result.dema_report,
          what_this_proves: result.what_this_proves,
          what_this_does_not_prove: result.what_this_does_not_prove,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE0-FIRST-REAL-LOCAL-MISSION-PULSE-PREVIEW-1A");
    console.log(`  schema: ${NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  pulse_ready: ${result.pulse_ready} | stages: ${result.stage_count}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
