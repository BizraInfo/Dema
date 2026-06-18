#!/usr/bin/env node
// DATALAKE-DUAL-LOOP-PREVIEW-1A — read-only dual-loop composition check.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA,
  gatherDatalakeDualLoopPreview,
} from "../../packages/core/src/datalake-dual-loop-preview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

const preview = await gatherDatalakeDualLoopPreview({ repoRoot: REPO_ROOT });

const ok =
  preview.schema === DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA &&
  preview.face_body_alignment_status === "REFERENCE_EXPECTATION_ONLY" &&
  preview.summary.node_count > 0 &&
  preview.summary.edge_count > 0 &&
  preview.boundary.runtime_sync_performed === false &&
  preview.boundary.datalake_mutation_performed === false;

if (JSON_MODE) {
  console.log(JSON.stringify({ ok, preview }, null, 2));
} else {
  console.log("DEMA · datalake dual-loop preview (reference-only)");
  console.log(`  face stages: ${preview.loops.dema_face.stage_count}`);
  console.log(`  body stages: ${preview.loops.datalake_body.stage_count}`);
  console.log(`  boundary refs: ${preview.summary.boundary_refs_ok ? "OK" : "INCOMPLETE"}`);
  console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
}

process.exit(ok ? 0 : 1);
