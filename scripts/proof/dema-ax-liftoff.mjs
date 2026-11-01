#!/usr/bin/env node
/**
 * DEMA-AX-LIFTOFF proof — read-only: T0 gate measurements → one AX strip.
 * Exit 0 when projection ok (including HOLD/NEEDS_YOU). Exit 1 on I/O failure
 * or UNKNOWN/malformed projection.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  formatAxLiftoffStrip,
  projectAxLiftoffStrip,
} from "../../packages/core/src/dema-ax-liftoff.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function main() {
  const wantJson = process.argv.includes("--json");
  const gate = spawnSync(
    process.execPath,
    ["scripts/proof/node0-t0-gate-status.mjs"],
    { cwd: REPO, encoding: "utf8", timeout: 90_000, env: process.env },
  );
  if ((gate.status ?? 1) !== 0) {
    console.error("Dema error: T0 gate-status failed; AX strip not projected.");
    process.exitCode = 1;
    return;
  }
  let measured;
  try {
    measured = JSON.parse(gate.stdout || "{}");
  } catch (err) {
    console.error(`Dema error: T0 gate JSON unreadable: ${err?.message ?? err}`);
    process.exitCode = 1;
    return;
  }

  const strip = projectAxLiftoffStrip({
    dema_face: measured?.gates?.dema_face ?? null,
    soak_runtime: measured?.gates?.soak_runtime ?? null,
    halt_gates_exact: measured?.halt_gates_exact ?? [],
    now: measured?.measured_at ?? new Date().toISOString(),
  });

  if (wantJson) {
    console.log(JSON.stringify({ preview_only: true, strip, measured_at: measured?.measured_at }, null, 2));
  } else {
    console.log(formatAxLiftoffStrip(strip));
  }
  process.exitCode = strip.ok === true ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
