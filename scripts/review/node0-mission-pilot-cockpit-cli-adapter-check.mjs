#!/usr/bin/env node
// NODE0-MISSION-PILOT-COCKPIT-CLI-ADAPTER-1A — review gate. Smokes `dema mission cockpit <run-id>`
// end-to-end through the REAL CLI binary: it first runs `dema mission emit` under a throwaway DEMA_HOME to
// WRITE a real run dir (three preview artifacts + emission.json envelope), then runs `dema mission cockpit`
// over that run id and asserts it renders a cockpit view with a non-empty gates ladder, holds an all-false
// boundary (committed_live false, mint false, authority_delta 0), passes every independent artifact-file
// re-check, and WRITES ZERO FILES (the run dir file set is byte-identical before and after the read). It
// also asserts a path-traversal run-id and a missing envelope are refused (non-zero exit). READ-ONLY:
// no model, network, daemon, mint. The cockpit adds no new intelligence — truth display only.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { NODE0_LOCAL_MISSION_EMIT_GO_PHRASE } from "../../apps/cli/src/commands/mission.js";
import {
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
} from "../../packages/core/src/node0-mission-pilot-cockpit-preview.js";

const JSON_MODE = process.argv.includes("--json");
const BIN = fileURLToPath(new URL("../../bin/dema", import.meta.url));

function runCli(demaHome, args, { allowFail = false } = {}) {
  try {
    const stdout = execFileSync("node", [BIN, "mission", ...args], {
      env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1", DEMA_HOME: demaHome },
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
    return { code: 0, stdout };
  } catch (err) {
    if (!allowFail) throw err;
    return { code: err.status ?? 1, stdout: (err.stdout || "").toString() };
  }
}

export function runNode0MissionPilotCockpitCliAdapterCheck() {
  const base = mkdtempSync(join(tmpdir(), "node0-mission-pilot-cockpit-check-"));
  const demaHome = join(base, "dema-home");
  const filePath = join(base, "source.txt");
  const blocked_by = [];
  let run_id = null;
  try {
    writeFileSync(filePath, "founder note: cockpit smoke.\n", "utf8");

    // 1) Emit a real run dir (three artifacts + emission.json envelope) under the throwaway DEMA_HOME.
    const emitted = runCli(demaHome, ["emit", filePath, "--consent", NODE0_LOCAL_MISSION_EMIT_GO_PHRASE, "--json"]);
    const emit = JSON.parse(emitted.stdout);
    if (emit.wrote !== true) blocked_by.push("emit_did_not_write");
    if (!/^[0-9a-f]{16}$/.test(emit.run_id || "")) blocked_by.push("emit_run_id_malformed");
    run_id = emit.run_id ?? null;

    const runDir = join(demaHome, "artifacts", "proofs", "node0-local-mission", run_id || "unknown");
    const before = readdirSync(runDir).sort();

    // 2) Read the cockpit over that run id.
    const read = runCli(demaHome, ["cockpit", run_id, "--json"]);
    const view = JSON.parse(read.stdout);
    if (view.ok !== true) blocked_by.push("cockpit_not_ok");
    if (view.run_id !== run_id) blocked_by.push("cockpit_run_id_mismatch");
    if (!Array.isArray(view.gates?.ladder) || view.gates.ladder.length === 0) blocked_by.push("cockpit_gates_ladder_empty");
    if (view.world_state_delta_preview?.applied !== false) blocked_by.push("cockpit_delta_applied_not_false");
    if (view.committed_live !== false) blocked_by.push("cockpit_committed_live_true");
    if (view.mint_allowed !== false) blocked_by.push("cockpit_mint_allowed_true");
    if (view.authority_delta !== 0) blocked_by.push("cockpit_authority_delta_nonzero");
    if (!view.boundary || !Object.values(view.boundary).every((v) => v === false)) blocked_by.push("cockpit_boundary_not_all_false");
    if (!Array.isArray(view.artifact_file_checks) || view.artifact_file_checks.length !== 3) blocked_by.push("cockpit_artifact_checks_count");
    else if (!view.artifact_file_checks.every((c) => c.ok === true)) blocked_by.push("cockpit_artifact_file_check_failed");

    // 3) READ-ONLY: the run dir file set is byte-identical before and after the read.
    const after = readdirSync(runDir).sort();
    if (before.length !== after.length || before.some((n, i) => n !== after[i])) blocked_by.push("cockpit_wrote_or_removed_files");

    // 4) Fail-closed refusals (non-zero exit): a path-traversal run-id and a missing envelope.
    const traversal = runCli(demaHome, ["cockpit", "../x", "--json"], { allowFail: true });
    if (traversal.code === 0) blocked_by.push("path_traversal_not_refused");
    const missingHome = join(base, "empty-home");
    const missing = runCli(missingHome, ["cockpit", "0123456789abcdef", "--json"], { allowFail: true });
    if (missing.code === 0) blocked_by.push("missing_envelope_not_refused");

    return {
      schema: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
      truth_label: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
      run_id,
      cockpit_ok: blocked_by.length === 0,
      gates_reached: view.gates?.reached_station ?? null,
      committed_live: view.committed_live,
      mint_allowed: view.mint_allowed,
      authority_delta: view.authority_delta,
      boundary_all_false: !!view.boundary && Object.values(view.boundary).every((v) => v === false),
      ok: blocked_by.length === 0,
      blocked_by,
    };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0MissionPilotCockpitCliAdapterCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify({ preview_only: true, ...result }, null, 2));
  } else {
    console.log("DEMA - NODE0-MISSION-PILOT-COCKPIT-CLI-ADAPTER-1A (PREVIEW_ONLY)");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  run_id: ${result.run_id}`);
    console.log(`  gates reached: ${result.gates_reached ?? "-"}`);
    console.log(`  boundary_all_false: ${result.boundary_all_false} | committed_live: ${result.committed_live} | mint_allowed: ${result.mint_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
