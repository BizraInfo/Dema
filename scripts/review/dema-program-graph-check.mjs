#!/usr/bin/env node
// DEMA-PROGRAM-GRAPH-NICHE-CELL-0A — review gate. Runs the deterministic
// founder-recovery fixture loop (compile → verify → tamper battery →
// structural transition checks) and emits the verdict with the canonical
// all-false boundary. authority_delta is 0 by construction: the kernel can
// only return authority_granted:false / transition_applied:false.

import { pathToFileURL } from "node:url";

import { runProgramGraphFixture } from "../../packages/mission/src/dema-program-graph.js";
import { buildPreviewBoundary } from "../../packages/core/src/boundary-schema.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaProgramGraphCheck({ fixture: injectedFixture } = {}) {
  const blocked_by = [];
  // Production callers inject nothing → the real deterministic fixture runs.
  // A test-only injected fixture exercises the gate's own fail-closed path.
  const fixture = injectedFixture ?? runProgramGraphFixture();
  if (!fixture.ok) {
    for (const code of fixture.blocked_by ?? ["fixture_not_ok"]) {
      blocked_by.push(`fixture:${code}`);
    }
  }
  return {
    ok: blocked_by.length === 0,
    schema: fixture.schema ?? null,
    truth_label: fixture.truth_label ?? "PREVIEW_ONLY",
    program_id: fixture.program_id ?? null,
    task_count: fixture.task_count ?? 0,
    graph_valid: fixture.graph_valid ?? false,
    definition_hash: fixture.definition_hash ?? null,
    tamper_rejections: fixture.tamper_rejections ?? 0,
    transition_checks: fixture.transition_checks ?? null,
    authority_delta: 0,
    boundary: buildPreviewBoundary(),
    blocked_by,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaProgramGraphCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - PROGRAM-GRAPH-NICHE-CELL-0A (PREVIEW_ONLY)");
    console.log(`  program: ${result.program_id}`);
    console.log(`  tasks: ${result.task_count} · graph_valid: ${result.graph_valid}`);
    console.log(`  definition_hash: ${result.definition_hash}`);
    console.log(`  tamper_rejections: ${result.tamper_rejections}`);
    console.log(`  authority_delta: ${result.authority_delta}`);
    console.log(`  ok: ${result.ok}${result.ok ? "" : ` blocked_by: ${result.blocked_by.join(", ")}`}`);
  }
  if (!result.ok) process.exit(1);
}
