#!/usr/bin/env node
// NODE0-MISSION-PILOT-COCKPIT-PREVIEW-1A — review gate. Builds a real, already-verified emission result
// (the three content-addressed mission artifacts, via the shipped emission kernel over the harness →
// pulse → composition → signature-backed genesis anchor), runs the pure read-only cockpit over it, and
// emits the verdict. Reads no file: the emission is composed in-memory; the real read/write adapter lives
// in the CLI.

import { pathToFileURL } from "node:url";

import { buildExampleEmissionInput } from "./node0-local-mission-artifact-emission-preview-check.mjs";
import { buildNode0LocalMissionArtifactEmissionPreviewPayload } from "../../packages/core/src/node0-local-mission-artifact-emission-preview.js";
import {
  runNode0MissionPilotCockpitPreview,
  node0MissionPilotCockpitPreviewBoundary,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-mission-pilot-cockpit-preview.js";

const JSON_MODE = process.argv.includes("--json");

// A real, already-verified emission result (which embeds harness → pulse → composition → genesis
// signature anchor), wrapped as the cockpit input.
export function buildExampleCockpitInput() {
  const emission = buildNode0LocalMissionArtifactEmissionPreviewPayload(buildExampleEmissionInput());
  return { emission };
}

export function runNode0MissionPilotCockpitPreviewCheck() {
  return runNode0MissionPilotCockpitPreview({
    consent: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
    input: buildExampleCockpitInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0MissionPilotCockpitPreviewCheck();
  const boundaryAllFalse = Object.values(node0MissionPilotCockpitPreviewBoundary()).every((v) => v === false);
  const view = result.cockpit_view ?? {};

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
          cockpit_view: result.cockpit_view,
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
    console.log("DEMA - NODE0-MISSION-PILOT-COCKPIT-PREVIEW-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  run_id: ${result.run_id}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  mission_status: ${view.mission_status ?? "-"}`);
    console.log(`  receipt_hash: ${view.receipt_hash ?? "-"}`);
    console.log(`  gates accepted: ${(view.gates?.accepted || []).join(", ") || "-"}`);
    console.log(`  gates rejected: ${(view.gates?.rejected || []).join(", ") || "-"}`);
    console.log(`  wsd applied: ${view.world_state_delta_preview?.applied}`);
    console.log(`  what_happened: ${view.what_happened ?? "-"}`);
    console.log(`  what_did_not_happen: ${view.what_did_not_happen ?? "-"}`);
    console.log(`  next_safe_action: ${view.next_safe_action ?? "-"}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
