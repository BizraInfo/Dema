#!/usr/bin/env node
// NODE0-LOCAL-MISSION-EMIT-CLI-ADAPTER-1A — review gate. Smokes `dema mission emit <file>` end-to-end
// through the REAL CLI binary under a throwaway DEMA_HOME + a throwaway source file: it must write
// exactly the three preview artifacts (receipt, world_state_delta_preview, dema_report) under
// $DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/, hold an all-false boundary, and (fail-closed)
// write nothing without the exact operator consent phrase. PREVIEW_ONLY: no model, network, daemon, mint.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  ARTIFACT_NAMES,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
} from "../../packages/core/src/node0-local-mission-artifact-emission-preview.js";
import { NODE0_LOCAL_MISSION_EMIT_GO_PHRASE } from "../../apps/cli/src/commands/mission.js";

const JSON_MODE = process.argv.includes("--json");
const BIN = fileURLToPath(new URL("../../bin/dema", import.meta.url));

function runEmit(demaHome, file, args) {
  const out = execFileSync("node", [BIN, "mission", "emit", file, ...args], {
    env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1", DEMA_HOME: demaHome },
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString();
  return JSON.parse(out);
}

export function runNode0LocalMissionEmitCliAdapterCheck() {
  const base = mkdtempSync(join(tmpdir(), "node0-local-mission-emit-check-"));
  const demaHome = join(base, "dema-home");
  const filePath = join(base, "source.txt");
  const blocked_by = [];
  try {
    writeFileSync(filePath, "founder note: emit smoke.\n", "utf8");

    // 1) WITH consent → writes the three artifacts.
    const emitted = runEmit(demaHome, filePath, ["--consent", NODE0_LOCAL_MISSION_EMIT_GO_PHRASE, "--json"]);
    if (emitted.ok !== true) blocked_by.push("emit_not_ok");
    if (emitted.wrote !== true) blocked_by.push("emit_did_not_write");
    if (emitted.schema !== NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
    if (!/^[0-9a-f]{16}$/.test(emitted.run_id || "")) blocked_by.push("run_id_malformed");

    const runDir = join(demaHome, "artifacts", "proofs", "node0-local-mission", emitted.run_id || "unknown");
    for (const name of ARTIFACT_NAMES) {
      const p = join(runDir, `${name}.json`);
      if (!existsSync(p)) blocked_by.push(`artifact_missing:${name}`);
      else if ((statSync(p).mode & 0o777) !== 0o600) blocked_by.push(`artifact_mode_not_0600:${name}`);
    }
    if ((emitted.artifact_paths_written || []).length !== ARTIFACT_NAMES.length) blocked_by.push("written_count_mismatch");

    const boundary = emitted.boundary || {};
    if (!Object.values(boundary).every((v) => v === false)) blocked_by.push("boundary_not_all_false");
    if (emitted.mint_allowed !== false) blocked_by.push("mint_allowed_true");
    if (emitted.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");

    // 2) WITHOUT consent → writes nothing (fail-closed) in a fresh home.
    const refusedHome = join(base, "dema-home-refused");
    const refused = runEmit(refusedHome, filePath, ["--json"]);
    if (refused.wrote !== false) blocked_by.push("wrote_without_consent");
    if (existsSync(join(refusedHome, "artifacts"))) blocked_by.push("artifacts_dir_created_without_consent");

    return {
      schema: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
      truth_label: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
      run_id: emitted.run_id ?? null,
      content_hash: emitted.content_hash ?? null,
      wrote: emitted.wrote === true,
      artifact_paths_written: emitted.artifact_paths_written ?? [],
      boundary_all_false: Object.values(boundary).every((v) => v === false),
      mint_allowed: emitted.mint_allowed,
      authority_delta: emitted.authority_delta,
      ok: blocked_by.length === 0,
      blocked_by,
    };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0LocalMissionEmitCliAdapterCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify({ preview_only: true, ...result }, null, 2));
  } else {
    console.log("DEMA - NODE0-LOCAL-MISSION-EMIT-CLI-ADAPTER-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  run_id: ${result.run_id}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  wrote: ${result.wrote} · artifacts: ${result.artifact_paths_written.length}`);
    for (const p of result.artifact_paths_written) console.log(`    ${p}`);
    console.log(`  boundary_all_false: ${result.boundary_all_false} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
