#!/usr/bin/env node
// DEMA-MISSION-CORRIDOR-0A — review gate. Runs the deterministic corridor
// fixture loop (contract → full state path → derived status → tamper-reject)
// and emits the verdict with the canonical all-false boundary.

import { pathToFileURL } from "node:url";

import { runMissionCorridorFixture } from "../../packages/mission/src/mission-corridor.js";
import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
} from "../../packages/core/src/boundary-schema.js";

const JSON_MODE = process.argv.includes("--json");

export function runMissionCorridorCheck() {
  const blocked_by = [];
  const fixture = runMissionCorridorFixture();
  if (!fixture.ok) {
    for (const code of fixture.blocked_by) blocked_by.push(`fixture:${code}`);
  }
  const boundary = buildPreviewBoundary();
  const keys = Object.keys(fixture.boundary ?? {});
  if (
    keys.length !== PREVIEW_BOUNDARY_CANONICAL_KEYS.length ||
    PREVIEW_BOUNDARY_CANONICAL_KEYS.some((k) => fixture.boundary[k] !== false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: "bizra.dema.mission_corridor_check.v0.1",
    truth_label: "PREVIEW_ONLY",
    authority_delta: 0,
    boundary,
    fixture_events: fixture.events,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runMissionCorridorCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - mission corridor (control plane)");
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  fixture events: ${result.fixture_events}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
