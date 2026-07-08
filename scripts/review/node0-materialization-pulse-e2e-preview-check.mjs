#!/usr/bin/env node
// NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A — review gate. Runs a clean mission end-to-end through the
// assembled stations and asserts it SEALS with a full 5-rung green ladder, all-false boundary.

import { pathToFileURL } from "node:url";

import {
  runNode0MaterializationPulseE2ePreview,
  node0MaterializationPulseE2ePreviewBoundary,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-materialization-pulse-e2e-preview.js";
import { exampleE2eMission } from "./materialization-pulse-e2e-fixtures.mjs";

const JSON_MODE = process.argv.includes("--json");

export function runNode0MaterializationPulseE2ePreviewCheck() {
  return runNode0MaterializationPulseE2ePreview({
    consent: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
    input: { mission: exampleE2eMission() },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = runNode0MaterializationPulseE2ePreviewCheck();
  const boundaryAllFalse = Object.values(node0MaterializationPulseE2ePreviewBoundary()).every((v) => v === false);
  const ok = r.ok === true && r.pulse_status === "sealed" && r.reached_station === 5 && boundaryAllFalse;

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: r.schema,
          truth_label: r.truth_label,
          preview_only: true,
          status: r.status,
          ok,
          pulse_status: r.pulse_status,
          reached_station: r.reached_station,
          station_count: r.station_count,
          claims_public_safe: r.claims_public_safe,
          ladder: r.ladder,
          content_hash: r.content_hash,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: r.mint_allowed,
          authority_delta: r.authority_delta,
          what_this_proves: r.what_this_proves,
          what_this_does_not_prove: r.what_this_does_not_prove,
          blocked_by: r.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A (PREVIEW_ONLY · the train runs)");
    console.log(`  schema: ${NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${r.status} | PULSE: ${r.pulse_status} | reached ${r.reached_station}/${r.station_count} | claims_public_safe: ${r.claims_public_safe}`);
    for (const rung of r.ladder || []) {
      console.log(`    ${rung.ok ? "✓" : "✗"} ${rung.station.padEnd(13)} ${rung.verdict}${rung.blocked_by.length ? " · " + rung.blocked_by.join(",") : ""}`);
    }
    console.log(`  content_hash: ${r.content_hash}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${r.mint_allowed} | authority_delta: ${r.authority_delta}`);
    console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) for (const c of r.blocked_by || []) console.log(`    ${c}`);
  }

  if (!ok) process.exit(1);
}
